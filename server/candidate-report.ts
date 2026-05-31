/**
 * candidate-report.ts
 *
 * 후보(대선/지선) "객관 평가 리포트" 생성기.
 *
 * 원칙: LLM은 사실을 창작하지 않는다. 본 모듈이 앱 DB에서 검증 가능한 1차 데이터만
 * 수집해 facts 페이로드로 넘기고, LLM은 그 facts 안에서만 서술한다. DB에 근거가
 * 없는 항목은 추정 없이 dataGaps 에 "검증 가능한 데이터 미보유" 로 표기한다.
 *
 * 데이터 소스:
 *   - 국회 경력자: legislators + assembly_votes/assembly_bills (표결·대표발의·소속위)
 *   - 비국회(행정가·법조인 등): election_candidates(선관위 등록 경력·공약) + candidate_statements
 *
 * 두 소스 모두 보유한 인물(예: 전직 의원 출신 대선 후보)은 양쪽을 합산한다.
 */

import { db } from "./db.js";
import {
  legislators,
  assemblyBills,
  assemblyVotes,
  electionCandidates,
  candidateStatements,
} from "../shared/schema.js";
import { eq, ilike, sql, desc, inArray } from "drizzle-orm";
import { analyzeLegislator } from "./legislator-analysis.js";
import { callLLMJson, LLMParseError } from "./utils/llm-wrapper.js";
import { getAiCache, setAiCache } from "./utils/ai-cache.js";

export interface CandidateReport {
  candidateName: string;
  hasLegislativeExperience: boolean;
  legislative: {
    votingAnalysis: string;
    keyVotes: { bill: string; vote: string; note: string }[];
    proposedBills: { bill: string; purpose: string }[];
    committeeFocus: string;
  } | null;
  administrative: {
    records: { role: string; policy: string; outcome: string }[];
    majorActivities: { title: string; fact: string }[];
  } | null;
  dataGaps: string[];
  keywords: [string, string, string] | string[];
}

export interface CandidateReportEnvelope {
  report: CandidateReport;
  sources: {
    legislatorMatched: boolean;
    voteRecords: number;
    proposedBills: number;
    electionCandidateMatched: boolean;
    pledges: number;
    statements: number;
  };
  generatedAt: string;
}

export class CandidateNotFoundError extends Error {}
export class InsufficientDataError extends Error {}

// 모듈 레벨 캐시 — 동일 인물 재요청은 LLM 재호출 없이 즉시 반환. 키: 소문자 이름.
const reportCache = new Map<string, CandidateReportEnvelope>();
export function clearCandidateReportCache(): void {
  reportCache.clear();
}

interface GatheredFacts {
  identity: { name: string; party?: string };
  legislative?: {
    monaCd: string;
    party: string;
    district: string;
    committees: string;
    careerRaw: string;
    voteTally: Record<string, number>;
    topCategories: { category: string; percentage: number; billCount: number }[];
    valueAxes: { label: string; score: number; leftLabel: string; rightLabel: string }[];
    meaningfulVotesCount: number;
    confidence: string;
    keyVotes: { billName: string; vote: string; committee: string; result: string }[];
    proposedBills: { billName: string; proposeDate: string; result: string; committee: string }[];
  };
  administrative?: {
    job: string;
    edu: string;
    careerLines: string[];
    pledges: { title: string; detail: string }[];
    statements: { type: string; title: string; content: string }[];
  };
}

function normalizePledges(raw: unknown): { title: string; detail: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === "string") return { title: p, detail: "" };
      if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        return {
          title: String(o.title ?? o.name ?? o.realmName ?? "").trim(),
          detail: String(o.description ?? o.detail ?? o.content ?? "").trim(),
        };
      }
      return { title: "", detail: "" };
    })
    .filter((p) => p.title.length > 0)
    .slice(0, 15);
}

async function gatherFacts(name: string, partyHint?: string): Promise<GatheredFacts> {
  const facts: GatheredFacts = { identity: { name, party: partyHint } };

  // ── 1) 국회 경력 조회 ──────────────────────────────────────────
  const legRows = await db
    .select()
    .from(legislators)
    .where(eq(legislators.name, name));
  const leg =
    legRows.length > 1 && partyHint
      ? legRows.find((r) => r.party?.includes(partyHint)) ?? legRows[0]
      : legRows[0];

  if (leg) {
    const monaCd = leg.monaCd;

    const tallyRows = await db
      .select({ voteResult: assemblyVotes.voteResult, c: sql<number>`count(*)::int` })
      .from(assemblyVotes)
      .where(eq(assemblyVotes.legislatorId, monaCd))
      .groupBy(assemblyVotes.voteResult);
    const voteTally: Record<string, number> = {};
    for (const r of tallyRows) voteTally[r.voteResult] = r.c;

    const keyVoteRows = await db
      .select({
        billName: assemblyBills.billName,
        committee: assemblyBills.committee,
        result: assemblyBills.result,
        voteResult: assemblyVotes.voteResult,
      })
      .from(assemblyVotes)
      .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
      .where(eq(assemblyVotes.legislatorId, monaCd))
      .orderBy(desc(assemblyBills.proposeDate))
      .limit(30);

    // 대표발의: assembly_bills.proposer 가 "{이름}의원 …" 으로 시작하는 법안
    const proposed = await db
      .select({
        billName: assemblyBills.billName,
        proposeDate: assemblyBills.proposeDate,
        result: assemblyBills.result,
        committee: assemblyBills.committee,
      })
      .from(assemblyBills)
      .where(ilike(assemblyBills.proposer, `${name}%`))
      .orderBy(desc(assemblyBills.proposeDate))
      .limit(20);

    let analysis: Awaited<ReturnType<typeof analyzeLegislator>> | null = null;
    try {
      analysis = await analyzeLegislator(monaCd);
    } catch {
      analysis = null;
    }

    facts.legislative = {
      monaCd,
      party: leg.party,
      district: leg.district,
      committees: leg.committees || leg.committee || leg.memTitle || "",
      careerRaw: leg.career || "",
      voteTally,
      topCategories:
        analysis?.topCategories?.map((c) => ({
          category: c.category,
          percentage: c.percentage,
          billCount: c.billCount,
        })) ?? [],
      valueAxes:
        analysis?.valueAxes?.map((a) => ({
          label: a.label,
          score: a.score,
          leftLabel: a.leftLabel,
          rightLabel: a.rightLabel,
        })) ?? [],
      meaningfulVotesCount: analysis?.meaningfulVotesCount ?? 0,
      confidence: analysis?.confidence ?? "low",
      keyVotes: keyVoteRows
        .filter((r) => r.billName)
        .map((r) => ({
          billName: r.billName as string,
          vote: r.voteResult,
          committee: r.committee || "",
          result: r.result || "",
        })),
      proposedBills: proposed.map((b) => ({
        billName: b.billName,
        proposeDate: b.proposeDate || "",
        result: b.result || "",
        committee: b.committee || "",
      })),
    };
  }

  // ── 2) 선관위 등록 후보 데이터 (행정/경력/공약) ───────────────────
  const candRows = await db
    .select()
    .from(electionCandidates)
    .where(eq(electionCandidates.name, name));
  // 데이터가 가장 풍부한 등록 건 선택 (공약 보유 우선 → 최신 등록)
  const cand =
    candRows
      .slice()
      .sort((a, b) => {
        const ap = Array.isArray(a.pledges) ? (a.pledges as unknown[]).length : 0;
        const bp = Array.isArray(b.pledges) ? (b.pledges as unknown[]).length : 0;
        if (bp !== ap) return bp - ap;
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      })[0] ?? null;

  let statements: { type: string; title: string; content: string }[] = [];
  if (candRows.length > 0) {
    const ids = candRows.map((c) => c.id);
    const stRows = await db
      .select({
        type: candidateStatements.type,
        title: candidateStatements.title,
        content: candidateStatements.content,
      })
      .from(candidateStatements)
      .where(inArray(candidateStatements.candidateId, ids))
      .limit(40);
    statements = stRows.map((s) => ({ type: s.type, title: s.title, content: s.content }));
  }

  if (cand || statements.length > 0) {
    const careerLines = [cand?.career1, cand?.career2, cand?.career]
      .filter((x): x is string => !!x && x.trim().length > 0)
      .flatMap((x) => x.split(/\r?\n|·|;|；/))
      .map((s) => s.trim())
      .filter((s) => s.length > 1)
      .slice(0, 20);

    facts.administrative = {
      job: cand?.job?.trim() || "",
      edu: cand?.edu?.trim() || "",
      careerLines,
      pledges: normalizePledges(cand?.pledges),
      statements,
    };
    if (cand?.party && !facts.identity.party) facts.identity.party = cand.party;
  }

  if (!facts.legislative && !facts.administrative) {
    throw new CandidateNotFoundError(`'${name}' 에 대한 검증 가능한 데이터를 앱 DB에서 찾지 못했습니다.`);
  }

  return facts;
}

const SYSTEM_PROMPT =
  "당신은 데이터와 사실에 근거해서만 정치인을 평가하는 최고 수준의 '객관적 정치 데이터 분석가'입니다. " +
  "특정 정당·정파의 논리에서 완전히 자유로운 절대 중립을 유지하십시오.\n\n" +
  "[엄격 제약]\n" +
  "1. 아래 user 메시지의 FACTS JSON 안에 있는 사실만 사용하십시오. FACTS에 없는 표결·법안명·정책·성과를 절대 지어내지 마십시오.\n" +
  "2. '우수' '실망' '논란' '훌륭' 같은 주관적 가치판단 형용사를 절대 쓰지 마십시오. 건조한 객관적 사실만 기술하십시오 " +
  "(예: \"A법안에 찬성표결\", \"B정책 시행 및 C예산 확보\").\n" +
  "3. 법안명·정책명을 가능한 한 구체적으로 적어 유권자가 직접 사실 확인할 수 있게 하십시오.\n" +
  "4. 근거 데이터가 없는 항목은 추정하지 말고 dataGaps 배열에 '<항목>: 검증 가능한 데이터 미보유' 형태로 명시하십시오.\n" +
  "5. 결론 keywords 는 제공된 데이터에서만 도출한 핵심 키워드 정확히 3개.\n" +
  "6. votingAnalysis 는 FACTS.legislative 의 voteTally(찬성/반대/기권/불참 건수), topCategories(분야별 비중), " +
  "valueAxes(가치축 점수), keyVotes 를 실제로 읽어 '무엇에 몇 건 찬성/반대했고 어느 분야 비중이 높다'는 식의 " +
  "구체적 사실로 3~5문장 작성하십시오. 스키마 설명문을 그대로 베껴 쓰지 마십시오.\n" +
  "7. 아래 스키마의 값들은 형식 예시일 뿐입니다. 반드시 FACTS의 실제 수치/법안명으로 대체하십시오.\n\n" +
  "[출력] 아래 JSON 스키마만 출력하고 다른 텍스트는 절대 포함하지 마십시오. 모든 서술은 한국어.\n" +
  JSON.stringify({
    candidateName: "예) 홍길동",
    hasLegislativeExperience: true,
    legislative: {
      votingAnalysis:
        "예) 총 532건 중 찬성 410건·반대 78건·기권 12건. 경제/산업 분야 비중이 29%로 가장 높고, 교육/문화 25%. 'OO법'에 찬성, 'XX법'에 반대.",
      keyVotes: [{ bill: "예) 중대재해처벌법 일부개정법률안", vote: "찬성", note: "본회의 수정가결" }],
      proposedBills: [{ bill: "예) 인천바이오과학기술원법안", purpose: "인천바이오과학기술원 설립 근거 마련" }],
      committeeFocus: "예) 기획재정위원회에서 조세·예산 관련 법안에 집중",
    },
    administrative: {
      records: [{ role: "예) OO도지사", policy: "예) OO 정책", outcome: "예) OO 시행/예산 확보 기록" }],
      majorActivities: [{ title: "예) OO 사건 대응", fact: "예) 남긴 구체적 법적·사회적 발자취" }],
    },
    dataGaps: ["예) 행정 성과 수치: 검증 가능한 데이터 미보유"],
    keywords: ["예)경제", "예)교육", "예)재정"],
  }) +
  "\n\n국회 경력이 없으면 legislative 를 null, 행정/경력 데이터가 없으면 administrative 를 null 로 두십시오. " +
  "'예)' 접두어는 출력에 절대 포함하지 마십시오.";

export async function generateCandidateReport(
  rawName: string,
  partyHint?: string,
): Promise<CandidateReportEnvelope> {
  const name = rawName.trim();
  if (!name) throw new CandidateNotFoundError("후보명이 비어 있습니다.");

  const cacheKey = `candidate-report::${name.toLowerCase()}::${(partyHint ?? "").toLowerCase()}`;
  const l1 = reportCache.get(cacheKey);
  if (l1) return l1;

  // L2: DB 영속 캐시
  const l2 = await getAiCache<CandidateReportEnvelope>(cacheKey);
  if (l2) { reportCache.set(cacheKey, l2); return l2; }

  const facts = await gatherFacts(name, partyHint);

  const sources = {
    legislatorMatched: !!facts.legislative,
    voteRecords: facts.legislative
      ? Object.values(facts.legislative.voteTally).reduce((a, b) => a + b, 0)
      : 0,
    proposedBills: facts.legislative?.proposedBills.length ?? 0,
    electionCandidateMatched: !!facts.administrative,
    pledges: facts.administrative?.pledges.length ?? 0,
    statements: facts.administrative?.statements.length ?? 0,
  };

  // 양쪽 소스 모두 사실상 비어 있으면 LLM 호출 없이 거부 (환각 방지)
  if (sources.voteRecords === 0 && sources.proposedBills === 0 && sources.pledges === 0 && sources.statements === 0 && !facts.administrative?.careerLines.length) {
    throw new InsufficientDataError(
      `'${name}' 의 검증 가능한 표결·발의·공약·경력 데이터가 부족해 객관 리포트를 생성할 수 없습니다.`,
    );
  }

  const report = await callLLMJson<CandidateReport>({
    system: SYSTEM_PROMPT,
    user: `대상 후보: ${name}${partyHint ? ` (${partyHint})` : ""}\n\nFACTS:\n${JSON.stringify(facts, null, 1)}`,
    temperature: 0.1,
    maxTokens: 1800,
    label: "candidates/evaluation-report",
    provider: "groq",
    // 추론 무거운 플래그십 분석 — 기본 8B 대신 70B로 품질 우선.
    model: "llama-3.3-70b-versatile",
  });

  // 키워드 정확히 3개 보정 (모델이 초과/미만 반환 시 방어)
  if (Array.isArray(report.keywords)) {
    report.keywords = report.keywords.slice(0, 3);
  }

  const envelope: CandidateReportEnvelope = {
    report,
    sources,
    generatedAt: new Date().toISOString(),
  };
  reportCache.set(cacheKey, envelope);
  // L2: DB 영속 저장 (백그라운드)
  setAiCache(cacheKey, "candidate-report", envelope).catch((e: unknown) =>
    console.error("[candidate-report] DB 캐시 저장 실패:", (e as Error).message),
  );
  return envelope;
}
