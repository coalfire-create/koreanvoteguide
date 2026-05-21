/**
 * stance-analyst.ts — LLM 기반 "이유있는 점수" 정책 성향 분석가
 *
 * 결정론적 stance.ts(법안별 표결 수학)와 legislator-analysis.ts(쟁점도·분야 분류)를
 * 토대로, 실제 표결 기록에 근거(grounded)한 1~10 정책 성향 점수와 결정적 법안 TOP 3을
 * 생성한다. LLM 은 "제공된 법안 목록" 안에서만 근거를 선택하도록 제약되어 환각을 배제한다.
 *
 * 흐름:
 *   1. 의원 표결 기록 + 법안 메타 조회
 *   2. 기권/불참·만장일치 제외 → 쟁점 가중치로 결정적 법안 선별 (해당 차원 분야 우선)
 *   3. 결정적 법안 3건 미만 → "데이터 부족" 리포트 (LLM 미호출)
 *   4. 결정론적 stance 점수를 1~10 앵커로 환산(데이터 있을 때만)
 *   5. 분석가 프롬프트 + 차원별 루브릭으로 LLM 호출 → 정형 리포트 반환
 */

import { db } from "./db";
import { assemblyBills, assemblyVotes } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { calculatePoliticianStance, toAnalystScale, type StanceAxis } from "./stance";
import {
  computeControversyWeight,
  classifyBillCategory,
  type BillCategory,
} from "./legislator-analysis";
import { callLLMJson, LLMConfigError } from "./utils/llm-wrapper";

// ============================================================
// 타입
// ============================================================

export type PolicyDimension = "econ" | "welfare" | "social" | "env" | "justice";

export const POLICY_DIMENSIONS: PolicyDimension[] = [
  "econ",
  "welfare",
  "social",
  "env",
  "justice",
];

export function isPolicyDimension(v: string): v is PolicyDimension {
  return (POLICY_DIMENSIONS as string[]).includes(v);
}

export interface EvidenceBill {
  billName: string;
  /** 이 법안이 무엇을 의미하는지 (예: "공공주택 확대·국가개입 법안") */
  billNature: string;
  vote: "찬성" | "반대" | "기권";
  /** 이 표결이 점수를 어느 방향으로 이동시켰는지에 대한 논리 설명 */
  impact: string;
}

export interface StanceAnalystReport {
  dimension: PolicyDimension;
  dimensionLabel: string;
  /** 7~10점이 의미하는 극(極) */
  highPole: string;
  /** 1~3점이 의미하는 극(極) */
  lowPole: string;
  /** 1~10 정수. 데이터 부족 시 null */
  overallScore: number | null;
  dataInsufficient: boolean;
  tendencySummary: string;
  evidenceBills: EvidenceBill[];
  /** LLM 에 투입된 결정적(쟁점) 표결 수 */
  scoredBillCount: number;
  /** stance.ts 결정론적 점수를 1~10 으로 환산한 참고 앵커 (DB 점수 미적재 시 null) */
  deterministicAnchor: number | null;
  confidence: "high" | "medium" | "low";
}

// ============================================================
// 차원별 설정 (축 매핑 · 극 라벨 · 루브릭 · 관련 분야)
// ============================================================

interface DimensionConfig {
  label: string;
  axis: StanceAxis;
  highPole: string;
  lowPole: string;
  rubric: string;
  relevantCategories: BillCategory[];
}

const DIMENSION_CONFIG: Record<PolicyDimension, DimensionConfig> = {
  econ: {
    label: "경제",
    axis: "econScore",
    highPole: "친시장 · 규제완화 · 감세",
    lowPole: "시장개입 · 규제강화 · 증세",
    rubric:
      "7~10(친시장): 법인세 감면·규제완화·재정건전성·민영화·시장자율에 '찬성', 시장개입·중과세에 '반대'. " +
      "4~6(중도): 혼재된 표결 또는 쟁점 법안에서의 잦은 기권. " +
      "1~3(시장개입): 공공지출 확대·부동산 규제강화·법인세 인상·노동권 강화에 '찬성', 사회복지 축소·노동유연화에 '반대'.",
    relevantCategories: ["경제/산업"],
  },
  welfare: {
    label: "복지",
    axis: "welfareScore",
    highPole: "복지 억제 · 재정건전성 · 시장원리",
    lowPole: "복지 확대 · 국가책임 · 보편복지",
    rubric:
      "7~10(복지 억제): 복지 지출 억제·선별복지·재정건전성·민간 위탁에 '찬성'. " +
      "4~6(중도): 혼재된 표결 또는 잦은 기권. " +
      "1~3(복지 확대): 보편적 복지·공공의료·공공주택·기초연금/수당 확대·국가책임 강화에 '찬성'.",
    relevantCategories: ["사회/복지"],
  },
  social: {
    label: "사회",
    axis: "socialScore",
    highPole: "개인 자유 · 다양성 · 사회개혁",
    lowPole: "전통질서 · 국가규율 · 현상유지",
    rubric:
      "7~10(자유·개혁): 개인의 권리 확대·소수자 보호·차별금지·사회개혁 법안에 '찬성'. " +
      "4~6(중도): 혼재 또는 기권. " +
      "1~3(질서·전통): 전통적 가치·국가의 사회규율 강화·현상유지 법안에 '찬성', 사회개혁 법안에 '반대'.",
    relevantCategories: ["사회/복지", "교육/문화"],
  },
  env: {
    label: "환경",
    axis: "envScore",
    highPole: "성장 · 개발 우선 (규제 최소)",
    lowPole: "환경보호 · 기후대응 (규제 강화)",
    rubric:
      "7~10(개발 우선): 개발·산업 활동 보장, 환경규제 완화에 '찬성'. " +
      "4~6(중도): 혼재 또는 기권. " +
      "1~3(환경보호): 탄소중립·재생에너지·환경규제 강화·생태보호 법안에 '찬성'.",
    relevantCategories: ["환경/에너지"],
  },
  justice: {
    label: "정의·안전",
    axis: "justiceScore",
    highPole: "법질서 · 공권력 · 처벌강화",
    lowPole: "인권 · 절차적 권리 · 교정중심",
    rubric:
      "7~10(법질서): 처벌 강화·공권력/안보 강화·엄정질서 법안에 '찬성'. " +
      "4~6(중도): 혼재 또는 기권. " +
      "1~3(인권): 인권 보장·절차적 권리·교정중심·과잉처벌 완화 법안에 '찬성'.",
    relevantCategories: ["국방/안전"],
  },
};

export function getDimensionMeta(dimension: PolicyDimension): {
  label: string;
  highPole: string;
  lowPole: string;
} {
  const c = DIMENSION_CONFIG[dimension];
  return { label: c.label, highPole: c.highPole, lowPole: c.lowPole };
}

// ============================================================
// 결정적 법안 선별
// ============================================================

const DECISIVE_LIMIT = 12; // LLM 에 투입할 최대 결정적 법안 수
const MIN_DECISIVE = 3; // 이보다 적으면 데이터 부족

interface DecisiveBill {
  billName: string;
  committee: string;
  vote: "찬성" | "반대";
  controversyWeight: number;
  category: BillCategory;
  relevant: boolean;
}

async function selectDecisiveBills(
  legislatorId: string,
  config: DimensionConfig,
): Promise<DecisiveBill[]> {
  const rawVotes = await db
    .select({ billId: assemblyVotes.billId, voteResult: assemblyVotes.voteResult })
    .from(assemblyVotes)
    .where(eq(assemblyVotes.legislatorId, legislatorId));

  if (rawVotes.length === 0) return [];

  const billIds = rawVotes.map((v) => v.billId);
  const billRows = await db
    .select({
      billId: assemblyBills.billId,
      billName: assemblyBills.billName,
      committee: assemblyBills.committee,
      yesCount: assemblyBills.yesCount,
      noCount: assemblyBills.noCount,
      abstainCount: assemblyBills.abstainCount,
    })
    .from(assemblyBills)
    .where(inArray(assemblyBills.billId, billIds));

  const billMap = new Map(billRows.map((b) => [b.billId, b]));
  const relevantSet = new Set(config.relevantCategories);

  const decisive: DecisiveBill[] = [];
  for (const vote of rawVotes) {
    if (vote.voteResult !== "찬성" && vote.voteResult !== "반대") continue;
    const bill = billMap.get(vote.billId);
    if (!bill) continue;

    const weight = computeControversyWeight(
      bill.yesCount,
      bill.noCount,
      bill.abstainCount,
      bill.billName,
    );
    if (weight === 0) continue; // 만장일치 일부개정 — 성향 판단 무의미

    const category = classifyBillCategory(bill.billName, bill.committee);
    decisive.push({
      billName: bill.billName,
      committee: bill.committee,
      vote: vote.voteResult,
      controversyWeight: weight,
      category,
      relevant: relevantSet.has(category),
    });
  }

  // 차원 관련 분야를 우선, 그 안에서 쟁점도 높은 순으로 정렬
  decisive.sort((a, b) => {
    if (a.relevant !== b.relevant) return a.relevant ? -1 : 1;
    return b.controversyWeight - a.controversyWeight;
  });

  return decisive.slice(0, DECISIVE_LIMIT);
}

// ============================================================
// 프롬프트 빌더
// ============================================================

function buildSystemPrompt(config: DimensionConfig): string {
  return (
    "당신은 정밀한 정치 데이터 분석가이자 표결(roll-call) 정량 연구자입니다. " +
    "주어진 표결 기록에만 근거하여 의원의 정책 성향을 채점하며, 주관적 편향이나 환각을 일절 배제합니다.\n\n" +
    `[분석 대상 정책 차원] ${config.label}\n` +
    `[채점 척도 — 1~10 정수]\n${config.rubric}\n` +
    `  · 10에 가까울수록: ${config.highPole}\n` +
    `  · 1에 가까울수록: ${config.lowPole}\n\n` +
    "[제약]\n" +
    "1. 모든 점수는 제공된 표결 기록과 직접적 인과로 연결되어야 한다.\n" +
    "2. evidenceBills 의 billName 은 반드시 제공된 표결 목록에 실제로 존재하는 법안만 사용한다. 새 법안 창작 금지.\n" +
    "3. evidenceBills 는 점수를 가른 가장 결정적인 법안 정확히 3개. (목록이 3개 미만이면 가능한 만큼)\n" +
    "4. tendencySummary 는 최대 2문장, 건조한 사실 위주. '훌륭한'·'실망스러운' 같은 감정 형용사 금지.\n" +
    "5. 이 정책 차원과 직접 연관된 결정적 법안이 전혀 없으면 dataInsufficient=true 로 설정한다.\n\n" +
    "반드시 아래 JSON 스키마만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.\n" +
    JSON.stringify({
      overallScore: 7,
      dataInsufficient: false,
      tendencySummary: "이 의원은 …에 일관되게 찬성표를 던졌다. …",
      evidenceBills: [
        {
          billName: "제공된 목록의 정확한 법안명",
          billNature: "이 법안이 무엇을 의미하는지 (예: 공공주택 확대·국가개입 법안)",
          vote: "찬성",
          impact: "이 표결이 점수를 어느 방향으로 이동시켰는지에 대한 논리",
        },
      ],
    })
  );
}

function buildUserContent(
  memberName: string,
  party: string,
  committee: string,
  decisive: DecisiveBill[],
  anchor: number | null,
): string {
  const billLines = decisive
    .map((b, i) => {
      const tag = b.relevant ? "★관련" : "참고";
      const oppPct = Math.round(b.controversyWeight * 100);
      return `[${i + 1}] ${b.vote} | ${b.billName} | 위원회:${b.committee || "미상"} | 쟁점도:${oppPct}% | 분야:${b.category} | ${tag}`;
    })
    .join("\n");

  const anchorLine =
    anchor != null
      ? `\n[참고 정량 앵커] 결정론적 표결 계산상 이 차원 점수는 약 ${anchor}/10 입니다. 단, 최종 점수는 아래 실제 표결에 부합해야 합니다.\n`
      : "";

  return (
    `의원: ${memberName} (${party} / ${committee || "위원회 미상"})\n` +
    anchorLine +
    `\n[결정적 표결 기록 — ★관련 표시는 해당 정책 차원 직접 연관]\n${billLines}`
  );
}

// ============================================================
// 메인
// ============================================================

interface LegislatorMeta {
  name: string;
  party: string;
  committee: string;
}

function emptyReport(
  dimension: PolicyDimension,
  config: DimensionConfig,
  scoredBillCount: number,
  anchor: number | null,
): StanceAnalystReport {
  return {
    dimension,
    dimensionLabel: config.label,
    highPole: config.highPole,
    lowPole: config.lowPole,
    overallScore: null,
    dataInsufficient: true,
    tendencySummary:
      "이 정책 차원에 대한 결정적(쟁점) 표결 기록이 충분하지 않아 분석할 수 없습니다.",
    evidenceBills: [],
    scoredBillCount,
    deterministicAnchor: anchor,
    confidence: "low",
  };
}

/** LLM 응답의 느슨한 검증 + 정규화 */
function normalizeLLMResult(
  raw: unknown,
  decisive: DecisiveBill[],
): { overallScore: number | null; dataInsufficient: boolean; tendencySummary: string; evidenceBills: EvidenceBill[] } {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const dataInsufficient = obj.dataInsufficient === true;

  let overallScore: number | null = null;
  if (typeof obj.overallScore === "number" && Number.isFinite(obj.overallScore)) {
    overallScore = Math.max(1, Math.min(10, Math.round(obj.overallScore)));
  }

  const tendencySummary =
    typeof obj.tendencySummary === "string" && obj.tendencySummary.trim()
      ? obj.tendencySummary.trim()
      : "표결 기록 기반 성향 요약을 생성하지 못했습니다.";

  // 환각 방지: 제공된 목록에 실제 존재하는 법안명만 채택
  const validNames = new Set(decisive.map((d) => d.billName));
  const rawBills = Array.isArray(obj.evidenceBills) ? obj.evidenceBills : [];
  const evidenceBills: EvidenceBill[] = [];
  for (const item of rawBills) {
    const b = (item ?? {}) as Record<string, unknown>;
    const billName = typeof b.billName === "string" ? b.billName.trim() : "";
    if (!validNames.has(billName)) continue; // 목록 밖 법안 폐기
    const vote =
      b.vote === "찬성" || b.vote === "반대" || b.vote === "기권" ? b.vote : "찬성";
    evidenceBills.push({
      billName,
      billNature: typeof b.billNature === "string" ? b.billNature.trim() : "",
      vote,
      impact: typeof b.impact === "string" ? b.impact.trim() : "",
    });
    if (evidenceBills.length >= 3) break;
  }

  return { overallScore, dataInsufficient, tendencySummary, evidenceBills };
}

/**
 * 의원의 특정 정책 차원에 대한 "이유있는 점수" 분석가 리포트를 생성한다.
 * GROQ_API_KEY 미설정 시 LLMConfigError 를 throw (상위에서 503 처리).
 */
export async function analyzePolicyStance(
  legislatorId: string,
  dimension: PolicyDimension,
  meta: LegislatorMeta,
): Promise<StanceAnalystReport> {
  const config = DIMENSION_CONFIG[dimension];

  // 1) 결정론적 stance → 1~10 앵커 (DB 점수 미적재 시 null)
  const stance = await calculatePoliticianStance(legislatorId);
  const anchor = toAnalystScale(stance[config.axis], stance.hasData);

  // 2) 결정적 법안 선별
  const decisive = await selectDecisiveBills(legislatorId, config);
  if (decisive.length < MIN_DECISIVE) {
    return emptyReport(dimension, config, decisive.length, anchor);
  }

  // 3) LLM 분석
  const result = await callLLMJson<unknown>({
    system: buildSystemPrompt(config),
    user: buildUserContent(meta.name, meta.party, meta.committee, decisive, anchor),
    temperature: 0.2,
    maxTokens: 900,
    label: `stance-analyst/${dimension}`,
  });

  const norm = normalizeLLMResult(result, decisive);

  // LLM 이 데이터 부족 판정했거나 근거 법안을 하나도 못 고른 경우
  if (norm.dataInsufficient || norm.evidenceBills.length === 0) {
    return emptyReport(dimension, config, decisive.length, anchor);
  }

  const confidence: "high" | "medium" | "low" =
    decisive.length >= 30 ? "high" : decisive.length >= 10 ? "medium" : "low";

  return {
    dimension,
    dimensionLabel: config.label,
    highPole: config.highPole,
    lowPole: config.lowPole,
    overallScore: norm.overallScore,
    dataInsufficient: false,
    tendencySummary: norm.tendencySummary,
    evidenceBills: norm.evidenceBills,
    scoredBillCount: decisive.length,
    deterministicAnchor: anchor,
    confidence,
  };
}
