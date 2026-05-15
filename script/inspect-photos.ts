/**
 * legislators 테이블의 photo_url 분포를 점검해 의심스러운 항목을 찾는다.
 * - 호스트별 카운트
 * - 같은 photo_url을 공유하는 의원 그룹 (동명이인 잘못 매핑 가능성)
 * - 의심 호스트(daum/kakao/news 등) 잔존 여부 확인
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { legislators } from "../shared/schema.js";

async function main() {
  const rows = await db
    .select({
      monaCd: legislators.monaCd,
      name: legislators.name,
      photoUrl: legislators.photoUrl,
    })
    .from(legislators);

  // 1) 호스트 분포
  const hostCount = new Map<string, number>();
  for (const r of rows) {
    const url = r.photoUrl ?? "";
    if (!url) {
      hostCount.set("(empty)", (hostCount.get("(empty)") ?? 0) + 1);
      continue;
    }
    try {
      const host = new URL(url).hostname;
      hostCount.set(host, (hostCount.get(host) ?? 0) + 1);
    } catch {
      hostCount.set("(invalid url)", (hostCount.get("(invalid url)") ?? 0) + 1);
    }
  }
  console.log("\n=== 호스트 분포 ===");
  [...hostCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([h, c]) => {
    console.log(`  ${c.toString().padStart(4)}  ${h}`);
  });

  // 2) photo_url 중복 — 같은 URL 두 명 이상이면 의심
  const urlToNames = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.photoUrl) continue;
    const arr = urlToNames.get(r.photoUrl) ?? [];
    arr.push(`${r.name}(${r.monaCd})`);
    urlToNames.set(r.photoUrl, arr);
  }
  const dupes = [...urlToNames.entries()].filter(([, names]) => names.length > 1);
  console.log(`\n=== 같은 photo_url을 공유하는 그룹: ${dupes.length}건 ===`);
  for (const [url, names] of dupes) {
    console.log(`  • ${names.join(", ")}`);
    console.log(`    → ${url.slice(0, 100)}`);
  }

  // 3) 의심 호스트 잔존 여부
  const suspicious = rows.filter((r) => {
    const u = (r.photoUrl ?? "").toLowerCase();
    return (
      u.includes("daum") ||
      u.includes("kakao") ||
      u.includes("news") ||
      u.includes("c32x32") ||
      u.includes("harmony_static") ||
      u.includes("expire=") ||
      u.includes("%10") // 인코딩 깨짐 의심
    );
  });
  console.log(`\n=== 의심 호스트/패턴 보유: ${suspicious.length}건 ===`);
  suspicious.slice(0, 30).forEach((r) =>
    console.log(`  • ${r.name} (${r.monaCd}) → ${r.photoUrl?.slice(0, 120)}`)
  );

  // 4) profileImg(UUID) 없이 type=n 만 사용하는 항목 — 안정성 낮음
  const oldFormatNaver = rows.filter((r) => {
    const u = r.photoUrl ?? "";
    return u.includes("search.pstatic.net") && !u.includes("profileImg");
  });
  console.log(`\n=== Naver 구형(/people/NN/) 포맷: ${oldFormatNaver.length}건 ===`);
  oldFormatNaver.slice(0, 10).forEach((r) =>
    console.log(`  • ${r.name} (${r.monaCd}) → ${r.photoUrl?.slice(0, 120)}`)
  );

  console.log("\n=== 요약 ===");
  console.log(`  legislators 총 ${rows.length}명`);
  console.log(`  의심 가능 항목: 중복 ${dupes.length}그룹, 의심 패턴 ${suspicious.length}건, 구형 네이버 ${oldFormatNaver.length}건`);
}

main().catch(console.error).finally(() => process.exit(0));
