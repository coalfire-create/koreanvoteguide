"""
Korean National Assembly Member Data Fetcher  (열린국회정보 공공 API)
======================================================================
Outputs:
  members_full.json  – fully-nested JSON, one object per member
  members_total.csv  – flat CSV, one row per member  (Excel-friendly)

Endpoints
---------
  nwvrqwxyaytdsfvhu  의원 기본정보 + photo (JPG_LINK)
  npffdutiapkzbfyvr  의원 경력 (학력 + 주요경력)
  nqybsprvzmxkerbvn  재산신고 현황

Join key: MONA_CD

Why AGE caused 400 errors
--------------------------
The member-info endpoint accepts AGE=22 to filter by assembly term, but the
career and asset endpoints do NOT accept AGE.  Sending it causes a 400 Bad
Request from the server.  This script now sends AGE only where it is accepted
and retries *without* AGE automatically when it receives a 400.

Usage
-----
  pip install aiohttp pandas
  python fetch_assembly_members.py               # normal run → ./output/
  python fetch_assembly_members.py --probe       # inspect raw fields, then exit
  python fetch_assembly_members.py --out-dir /tmp
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Any

import aiohttp
import pandas as pd

# ═══════════════════════════════════════════════════════════════
# ① CONFIGURATION
# ═══════════════════════════════════════════════════════════════

API_KEY      = os.environ.get("OPEN_ASSEMBLY_API_KEY", "")
API_BASE     = "https://open.assembly.go.kr/portal/openapi"
PAGE_SIZE    = 100      # rows per page (API hard limit is 100)
CONCURRENCY  = 4        # simultaneous page requests per endpoint
PAGE_DELAY   = 0.4      # seconds between page fetches (politeness)
HTTP_TIMEOUT = 30       # seconds per individual request

OUTPUT_JSON = "members_full.json"
OUTPUT_CSV  = "members_total.csv"

# ── Per-endpoint settings ───────────────────────────────────────────────────
# 'age'  : send AGE=22 to filter by assembly term.
#           True  → member endpoint (confirmed to accept it)
#           False → career / asset endpoints (400 if sent)
# 'label': human-readable name used in log lines
# ─────────────────────────────────────────────────────────────────────────────
ENDPOINTS: dict[str, dict] = {
    "nwvrqwxyaytdsfvhu": {"label": "의원 기본정보", "age": True},
    "npffdutiapkzbfyvr": {"label": "의원 경력",     "age": False},
    "nqybsprvzmxkerbvn": {"label": "재산신고",      "age": False},
}

# ═══════════════════════════════════════════════════════════════
# ② LOGGING
# ═══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("assembly")


# ═══════════════════════════════════════════════════════════════
# ③ DATA CLASSES
# ═══════════════════════════════════════════════════════════════

@dataclass
class CareerEntry:
    category: str   # "학력" | "경력"
    detail:   str   # "서울대학교 법학과 졸업"
    period:   str   # "1990 ~ 1994"


@dataclass
class AssetEntry:
    """Amounts are in 만원 (10,000 KRW)."""
    year:      str
    total:     int
    land:      int = 0
    building:  int = 0
    financial: int = 0
    debt:      int = 0


@dataclass
class Member:
    mona_cd:      str
    name:         str
    party:        str
    district:     str
    committee:    str
    photo_url:    str
    elected_term: int
    birth_date:   str
    gender:       str
    email:        str
    homepage:     str
    career_raw:   str                      = ""   # embedded career text from member API
    careers:      list[CareerEntry]        = field(default_factory=list)
    assets:       list[AssetEntry]         = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════
# ④ LOW-LEVEL HTTP  (with body-logging on errors + AGE retry)
# ═══════════════════════════════════════════════════════════════

def _make_params(
    p_index:     int,
    include_age: bool,
    extra:       dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build the query-string dict for one page request."""
    params: dict[str, Any] = {
        "Key":    API_KEY,
        "Type":   "json",
        "pIndex": str(p_index),
        "pSize":  str(PAGE_SIZE),
    }
    if include_age:
        params["AGE"] = "22"
    if extra:
        params.update(extra)
    return params


def _parse_payload(
    service_id: str,
    data:       dict,
    p_index:    int,
) -> tuple[list[dict], int]:
    """
    Extract (rows, total_count) from the API JSON envelope.

    Envelope shape:
      { "<service_id>": [
          { "head": [ {"list_total_count": N}, {"RESULT": {"CODE": "INFO-000"}} ] },
          { "row":  [ {...}, ... ] }
      ] }
    """
    payload = data.get(service_id)
    if not isinstance(payload, list) or not payload:
        return [], 0

    head = payload[0].get("head") or []
    if len(head) >= 2:
        result = head[1].get("RESULT", {})
        code   = result.get("CODE", "INFO-000")
        if code != "INFO-000":
            log.warning(
                "[%s] p%d – API result code %s: %s",
                service_id, p_index, code, result.get("MESSAGE", ""),
            )
            return [], 0

    total: int = int((head[0].get("list_total_count") if head else None) or 0)
    rows: list[dict] = []
    if len(payload) >= 2:
        rows = payload[1].get("row") or []

    return rows, total


async def _get_page(
    session:     aiohttp.ClientSession,
    service_id:  str,
    p_index:     int,
    include_age: bool,
    extra:       dict[str, str] | None = None,
) -> tuple[list[dict], int, int]:
    """
    Fetch one page.  Returns (rows, total_count, http_status).

    http_status is exposed so the caller can detect 400 and retry
    without the AGE parameter.
    """
    url    = f"{API_BASE}/{service_id}"
    params = _make_params(p_index, include_age, extra)

    try:
        async with session.get(
            url, params=params,
            timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT),
        ) as resp:
            status = resp.status

            # Always read the body — needed for error diagnosis
            body_text = await resp.text()

            if status == 400:
                # Log a snippet of the response so we can see WHY it failed
                log.warning(
                    "[%s] p%d – HTTP 400  age=%s  snippet: %s",
                    service_id, p_index, include_age, body_text[:300].replace("\n", " "),
                )
                return [], 0, 400

            if status != 200:
                log.warning(
                    "[%s] p%d – HTTP %d  snippet: %s",
                    service_id, p_index, status, body_text[:300].replace("\n", " "),
                )
                return [], 0, status

            try:
                data = json.loads(body_text)
            except json.JSONDecodeError as exc:
                log.warning("[%s] p%d – JSON decode error: %s", service_id, p_index, exc)
                return [], 0, status

            rows, total = _parse_payload(service_id, data, p_index)
            return rows, total, 200

    except aiohttp.ClientError as exc:
        log.warning("[%s] p%d – network error: %s", service_id, p_index, exc)
        return [], 0, -1


async def _get_page_with_age_fallback(
    session:    aiohttp.ClientSession,
    service_id: str,
    p_index:    int,
    want_age:   bool,
    extra:      dict[str, str] | None = None,
) -> tuple[list[dict], int]:
    """
    Fetch one page.  If want_age=True and the server returns 400,
    automatically retry *without* AGE.  Returns (rows, total_count).
    """
    rows, total, status = await _get_page(session, service_id, p_index, want_age, extra)

    # Retry without AGE when:
    #   • we tried with AGE and the server rejected it (400)
    #   • OR we're told not to use AGE in the first place (already False)
    if status == 400 and want_age:
        log.info(
            "[%s] p%d – retrying WITHOUT AGE parameter …", service_id, p_index
        )
        rows, total, status = await _get_page(
            session, service_id, p_index, include_age=False, extra=extra
        )
        if status == 400:
            log.error(
                "[%s] p%d – still 400 without AGE. "
                "The endpoint ID may be wrong. Run --probe to inspect.",
                service_id, p_index,
            )

    return rows, total


# ═══════════════════════════════════════════════════════════════
# ⑤ PAGINATION
# ═══════════════════════════════════════════════════════════════

async def fetch_all_pages(
    session:    aiohttp.ClientSession,
    service_id: str,
) -> list[dict]:
    """
    Fetch every page for *service_id*, respecting the per-endpoint AGE setting.
    Pages 2-N are fetched concurrently (limited by CONCURRENCY semaphore).
    """
    cfg       = ENDPOINTS[service_id]
    label     = cfg["label"]
    want_age  = cfg["age"]

    log.info("[%s] %s – fetching page 1 (age=%s) …", service_id, label, want_age)
    first_rows, total = await _get_page_with_age_fallback(
        session, service_id, 1, want_age
    )

    if total == 0:
        log.info("[%s] %s – %d row(s) returned", service_id, label, len(first_rows))
        return first_rows

    total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    log.info("[%s] %s – %d records across %d page(s)", service_id, label, total, total_pages)

    if total_pages == 1:
        return first_rows

    semaphore = asyncio.Semaphore(CONCURRENCY)
    all_rows  = list(first_rows)

    async def _safe_page(p: int) -> list[dict]:
        async with semaphore:
            await asyncio.sleep(PAGE_DELAY)
            rows, _ = await _get_page_with_age_fallback(
                session, service_id, p, want_age
            )
            log.info("[%s] %s – page %d/%d → %d rows", service_id, label, p, total_pages, len(rows))
            return rows

    results = await asyncio.gather(
        *[_safe_page(p) for p in range(2, total_pages + 1)],
        return_exceptions=True,
    )
    for r in results:
        if isinstance(r, Exception):
            log.warning("[%s] page task failed: %s", service_id, r)
        elif isinstance(r, list):
            all_rows.extend(r)

    log.info("[%s] %s – collected %d total rows", service_id, label, len(all_rows))
    return all_rows


# ═══════════════════════════════════════════════════════════════
# ⑥ PROBE MODE  – raw-field inspector
# ═══════════════════════════════════════════════════════════════

async def probe_endpoints() -> None:
    """
    Fetch one row from each endpoint (trying with and without AGE) and print
    all field names + sample values.  Use this to verify the endpoint IDs and
    field names before a full run.
    """
    connector = aiohttp.TCPConnector(limit=3)
    async with aiohttp.ClientSession(connector=connector) as session:
        for svc_id, cfg in ENDPOINTS.items():
            print(f"\n{'═'*64}")
            print(f"  {cfg['label']}   ({svc_id})")
            print(f"{'═'*64}")

            for use_age in ([True, False] if not cfg["age"] else [True]):
                rows, total, status = await _get_page(
                    session, svc_id, 1, include_age=use_age
                )
                tag = "with AGE" if use_age else "without AGE"
                if status == 200 and rows:
                    print(f"\n  ✓  {tag}  |  total: {total}")
                    print(json.dumps(rows[0], ensure_ascii=False, indent=4))
                    break
                elif status == 400:
                    print(f"  ✗  {tag}  → HTTP 400  (parameter rejected)")
                else:
                    print(f"  ✗  {tag}  → status {status}, rows={len(rows)}")

            if not rows:
                print(
                    "\n  ⚠  No data returned from this endpoint.\n"
                    "     Possible causes:\n"
                    "       1. The service ID is wrong.\n"
                    "       2. The API key doesn't have access to this dataset.\n"
                    "       3. This dataset requires a different parameter set.\n"
                    "     Browse https://open.assembly.go.kr/portal/data/service/selectServicePage.do\n"
                    "     to find the correct service ID."
                )


# ═══════════════════════════════════════════════════════════════
# ⑦ PARSERS
# ═══════════════════════════════════════════════════════════════

def _safe_int(v: Any) -> int:
    try:
        return int(str(v or "0").replace(",", "").strip() or 0)
    except (ValueError, TypeError):
        return 0


def _photo_url(row: dict) -> str:
    """
    Priority:
      1. JPG_LINK  – full URL provided directly by the API
      2. HG_NM_A   – filename only; we prepend the known base path
    """
    link = (row.get("JPG_LINK") or "").strip()
    if link:
        return link

    filename = (row.get("HG_NM_A") or "").strip()
    if filename:
        return f"https://open.assembly.go.kr/portal/assm/assmpic/{filename}"

    return ""


def _elected_term(row: dict) -> int:
    # UNITS is a plain integer; REELE_GBN_NM looks like "3선"
    units = _safe_int(row.get("UNITS"))
    if units:
        return units
    raw = str(row.get("REELE_GBN_NM") or "").replace("선", "").strip()
    return _safe_int(raw) or 1


def parse_member_rows(rows: list[dict]) -> list[Member]:
    members = []
    for row in rows:
        mona_cd = (row.get("MONA_CD") or "").strip()
        if not mona_cd:
            continue

        # Some API versions embed a career summary string directly.
        # We store it as career_raw and use it as fallback later.
        career_raw = (
            row.get("CAREER")
            or row.get("CAREER_NM")
            or ""
        ).strip()

        members.append(Member(
            mona_cd      = mona_cd,
            name         = (row.get("HG_NM")       or "").strip(),
            party        = (row.get("POLY_NM")      or "").strip(),
            district     = (row.get("ORIG_NM")      or "비례대표").strip(),
            committee    = (row.get("CMIT_NM")      or "").strip(),
            photo_url    = _photo_url(row),
            elected_term = _elected_term(row),
            birth_date   = (row.get("BTH_DATE")     or "").strip(),
            gender       = (row.get("SEX_GBN_NM")   or "").strip(),
            email        = (row.get("E_MAIL")        or "").strip(),
            homepage     = (row.get("HOMEPAGE")      or "").strip(),
            career_raw   = career_raw,
        ))
    return members


def parse_career_rows(rows: list[dict]) -> dict[str, list[CareerEntry]]:
    """
    Groups career rows by MONA_CD.

    Field mapping (열린국회정보 의원경력 API)
    -----------------------------------------
    MONA_CD     → join key
    CAREER_GBN  → category  ("학력" | "경력")
    CAREER_NM   → detail text
    CAREER_DATE → period string
    """
    by_mona: dict[str, list[CareerEntry]] = {}
    for row in rows:
        mona_cd = (row.get("MONA_CD") or "").strip()
        if not mona_cd:
            continue
        by_mona.setdefault(mona_cd, []).append(CareerEntry(
            category = (row.get("CAREER_GBN")  or "경력").strip(),
            detail   = (row.get("CAREER_NM")   or "").strip(),
            period   = (row.get("CAREER_DATE") or "").strip(),
        ))
    return by_mona


def parse_asset_rows(rows: list[dict]) -> dict[str, list[AssetEntry]]:
    """
    Groups asset rows by MONA_CD, sorted newest-first.

    Field mapping (열린국회정보 재산신고 API)
    -----------------------------------------
    MONA_CD         → join key
    DECL_YEAR       → declaration year
    TOTAL_PRICE     → total net worth  (만원)
    LAND_PRICE      → land value
    BUILDING_PRICE  → building value
    FINANCIAL_PRICE → financial assets
    DEBT_PRICE      → total debt / liabilities
    """
    by_mona: dict[str, list[AssetEntry]] = {}
    for row in rows:
        mona_cd = (row.get("MONA_CD") or "").strip()
        if not mona_cd:
            continue
        by_mona.setdefault(mona_cd, []).append(AssetEntry(
            year      = str(row.get("DECL_YEAR")        or "").strip(),
            total     = _safe_int(row.get("TOTAL_PRICE")),
            land      = _safe_int(row.get("LAND_PRICE")),
            building  = _safe_int(row.get("BUILDING_PRICE")),
            financial = _safe_int(row.get("FINANCIAL_PRICE")),
            debt      = _safe_int(row.get("DEBT_PRICE")),
        ))

    # sort each member's list by year descending (latest first)
    for mona_cd in by_mona:
        by_mona[mona_cd].sort(key=lambda a: a.year, reverse=True)

    return by_mona


def _career_fallback(member: Member) -> list[CareerEntry]:
    """
    If the separate career endpoint returned nothing, convert the embedded
    career_raw text (a single string from the member API) into one CareerEntry.
    """
    if not member.career_raw:
        return []
    return [CareerEntry(category="경력", detail=member.career_raw, period="")]


# ═══════════════════════════════════════════════════════════════
# ⑧ ORCHESTRATION  – fetch → parse → merge
# ═══════════════════════════════════════════════════════════════

async def fetch_and_merge() -> list[Member]:
    svc_members, svc_careers, svc_assets = list(ENDPOINTS.keys())

    connector = aiohttp.TCPConnector(limit=CONCURRENCY * 3)
    async with aiohttp.ClientSession(connector=connector) as session:
        log.info("══  Fetching all endpoints concurrently  ══")
        member_rows, career_rows, asset_rows = await asyncio.gather(
            fetch_all_pages(session, svc_members),
            fetch_all_pages(session, svc_careers),
            fetch_all_pages(session, svc_assets),
        )

    log.info(
        "Raw rows → members: %d   careers: %d   assets: %d",
        len(member_rows), len(career_rows), len(asset_rows),
    )

    members    = parse_member_rows(member_rows)
    careers_by = parse_career_rows(career_rows)
    assets_by  = parse_asset_rows(asset_rows)

    used_career_fallback = 0
    for m in members:
        m.careers = careers_by.get(m.mona_cd) or _career_fallback(m)
        m.assets  = assets_by.get(m.mona_cd, [])
        if not careers_by.get(m.mona_cd) and m.career_raw:
            used_career_fallback += 1

    if used_career_fallback:
        log.info(
            "Career fallback used for %d member(s) "
            "(embedded 'CAREER' field from member API)",
            used_career_fallback,
        )

    log.info(
        "Merged %d members | with careers: %d | with assets: %d",
        len(members),
        sum(1 for m in members if m.careers),
        sum(1 for m in members if m.assets),
    )
    return members


# ═══════════════════════════════════════════════════════════════
# ⑨ EXPORT
# ═══════════════════════════════════════════════════════════════

def export_json(members: list[Member], path: str) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump([asdict(m) for m in members], fh, ensure_ascii=False, indent=2)
    log.info("JSON  → %s  (%d members)", path, len(members))


def export_csv(members: list[Member], path: str) -> None:
    """
    Flat CSV — one row per member.
    List-valued fields (careers, all asset years) are JSON-serialised strings.
    The latest asset year's amounts are also flattened into individual columns.
    Encoded utf-8-sig so Excel opens Korean text without a BOM issue.
    """
    records = []
    for m in members:
        latest = m.assets[0] if m.assets else None
        records.append({
            # identity
            "mona_cd":              m.mona_cd,
            "name":                 m.name,
            "party":                m.party,
            "district":             m.district,
            "committee":            m.committee,
            "elected_term":         m.elected_term,
            "birth_date":           m.birth_date,
            "gender":               m.gender,
            "email":                m.email,
            "homepage":             m.homepage,
            # photo
            "photo_url":            m.photo_url,
            # career – full list as JSON, count as convenience column
            "career_count":         len(m.careers),
            "career_raw":           m.career_raw,
            "careers_json":         json.dumps(
                                        [asdict(c) for c in m.careers],
                                        ensure_ascii=False,
                                    ),
            # latest asset year – flattened columns
            "asset_year":           latest.year      if latest else "",
            "asset_total_만원":     latest.total     if latest else None,
            "asset_land_만원":      latest.land      if latest else None,
            "asset_building_만원":  latest.building  if latest else None,
            "asset_financial_만원": latest.financial if latest else None,
            "asset_debt_만원":      latest.debt      if latest else None,
            # all years as JSON (for pivot tables etc.)
            "assets_json":          json.dumps(
                                        [asdict(a) for a in m.assets],
                                        ensure_ascii=False,
                                    ),
        })

    df = pd.DataFrame(records)
    df.to_csv(path, index=False, encoding="utf-8-sig")
    log.info("CSV   → %s  (%d rows × %d cols)", path, len(df), len(df.columns))


# ═══════════════════════════════════════════════════════════════
# ⑩ CLI
# ═══════════════════════════════════════════════════════════════

def _args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Fetch Korean National Assembly member data (열린국회정보 API)",
    )
    p.add_argument(
        "--probe",
        action="store_true",
        help="Fetch one row from each endpoint and print all field names, then exit.",
    )
    p.add_argument(
        "--out-dir",
        default="output",
        help="Directory for output files  (default: ./output)",
    )
    return p.parse_args()


async def main() -> None:
    args = _args()

    if args.probe:
        await probe_endpoints()
        return

    os.makedirs(args.out_dir, exist_ok=True)
    json_path = os.path.join(args.out_dir, OUTPUT_JSON)
    csv_path  = os.path.join(args.out_dir, OUTPUT_CSV)

    t0      = time.monotonic()
    members = await fetch_and_merge()

    if not members:
        log.error(
            "No members were fetched.\n"
            "  • Run  python fetch_assembly_members.py --probe  to diagnose.\n"
            "  • Verify the API key is active on open.assembly.go.kr\n"
            "  • Check your network / firewall."
        )
        sys.exit(1)

    export_json(members, json_path)
    export_csv(members,  csv_path)

    log.info(
        "══  Done in %.1f s  —  %d members  ══",
        time.monotonic() - t0, len(members),
    )


if __name__ == "__main__":
    asyncio.run(main())
