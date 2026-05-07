/**
 * 국회의원 입법·표결 성향 분석 파이프라인
 *
 * 외부 LLM 미사용 — 키워드 매칭 + 가중 집계 방식으로 자체 구현
 */

import { db } from "./db";
import { assemblyBills, assemblyVotes } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

// ============================================================
// 1. 출력 타입 정의
// ============================================================

export type BillCategory =
  | "경제/산업"
  | "사회/복지"
  | "교육/문화"
  | "환경/에너지"
  | "국방/안전"
  | "기타";

export interface CategoryBreakdown {
  category: BillCategory;
  /** 전체 유효 표결 중 해당 카테고리의 가중치 비율 (0-100) */
  percentage: number;
  billCount: number;
  weightedCount: number;
}

export interface ValueAxis {
  id: "economy" | "government";
  label: string;
  /** -1.0(부정 끝) ~ +1.0(긍정 끝) */
  score: number;
  leftLabel: string;
  rightLabel: string;
  description: string;
}

export interface KeyBill {
  billId: string;
  billName: string;
  committee: string;
  /** 0.0 ~ 1.0 — 쟁점도 기반 가중치 */
  controversyWeight: number;
  vote: "찬성" | "반대";
  category: BillCategory;
  /** controversyWeight × |가치 기여도| */
  impactScore: number;
  date: string;
}

export interface LegislatorAnalysisResult {
  legislatorId: string;
  analyzedAt: string;
  /** DB에서 가져온 원시 표결 수 */
  totalVotesConsidered: number;
  /** 필터링·가중치 적용 후 실제 분석된 표결 수 */
  meaningfulVotesCount: number;
  /** TOP 3 관심 분야 (비율 %) */
  topCategories: CategoryBreakdown[];
  /** 이념 성향 축 (경제, 정부 역할) */
  valueAxes: ValueAxis[];
  /** 자동 생성된 1~2줄 성향 요약 */
  summaryText: string;
  /** 분석에 가장 큰 영향을 미친 대표 법안 TOP 3 */
  keyBills: KeyBill[];
  confidence: "high" | "medium" | "low";
}

// ============================================================
// 2. LLM 프롬프트 템플릿 (외부 API 연동 시 활용)
// ============================================================
//
// 현재는 키워드 매칭으로 대체 구현. 추후 Gemini/Claude API 연동 시
// 아래 템플릿을 그대로 사용해 정확도를 높일 수 있음.

export const BILL_ANALYSIS_PROMPT_TEMPLATE = `
당신은 대한민국 국회 법안을 분석하는 전문 정치학자입니다.
다음 법안의 정책적 성향을 분석하여 JSON으로만 응답하세요.

[법안 정보]
- 법안명: {billName}
- 소관 위원회: {committee}
- 제안 이유: {summary}
- 표결 결과: 찬성 {yesCount}표, 반대 {noCount}표, 기권 {abstainCount}표

[분류 기준]
1. category: "경제/산업" | "사회/복지" | "교육/문화" | "환경/에너지" | "국방/안전" | "기타"
2. econValue: 친기업·규제완화=+1, 친노동·시장개입=-1, 중립=0 (소수점 허용)
3. govValue: 작은정부·감세=+1, 큰정부·복지확대=-1, 중립=0 (소수점 허용)
4. reasoning: 분류 근거 (50자 이내)

[응답 형식 — JSON만 출력]
{"category": "경제/산업", "econValue": 0.6, "govValue": 0.4, "reasoning": "..."}
`.trim();

// ============================================================
// 3. 키워드 사전
// ============================================================

const CATEGORY_KEYWORDS: Record<Exclude<BillCategory, "기타">, string[]> = {
  "경제/산업": [
    "경제", "산업", "무역", "기업", "창업", "투자", "금융", "세금", "세제", "관세",
    "수출", "수입", "제조", "중소기업", "벤처", "스타트업", "주식", "증권", "부동산",
    "공정거래", "소비자", "물가", "고용", "일자리", "임금", "최저임금", "근로", "노동",
    "은행", "재정", "예산", "국세", "지방세", "세율", "법인세", "소득세", "부가가치세",
    "유통", "물류", "운송", "항만", "항공", "농업", "수산업", "축산", "제약",
    "반도체", "디지털", "인공지능", "플랫폼", "전자상거래", "자영업", "임대료",
    "규제", "시장", "경쟁", "독점", "민영화", "감세",
  ],
  "사회/복지": [
    "복지", "의료", "건강", "병원", "의약품", "장애", "노인", "아동", "청소년",
    "여성", "임신", "출산", "육아", "보육", "저출산", "주거", "빈곤", "취약계층",
    "기초생활", "연금", "사회보장", "지원금", "사회서비스", "요양", "돌봄",
    "가족", "다문화", "인권", "차별", "성평등", "공중보건", "정신건강",
    "건강보험", "국민연금", "기초연금", "청년수당", "자살예방", "중독",
    "의사", "간호사", "약사", "비급여",
  ],
  "교육/문화": [
    "교육", "학교", "대학", "학생", "입시", "교원", "교사", "교수",
    "문화", "예술", "체육", "스포츠", "관광", "언론", "방송", "미디어", "출판",
    "저작권", "역사", "문화재", "유산", "종교", "박물관", "도서관", "공연",
    "영화", "음악", "게임", "유아교육", "특수교육", "평생교육",
    "직업훈련", "장학금", "사교육",
  ],
  "환경/에너지": [
    "환경", "기후", "탄소", "온실", "미세먼지", "공해", "재생에너지", "태양광",
    "풍력", "원전", "핵발전", "수소", "전기차", "폐기물", "재활용", "생태",
    "에너지", "전력", "가스", "석유", "산림", "토양", "해양",
    "수질", "대기", "화학물질", "유해물질", "홍수", "가뭄",
  ],
  "국방/안전": [
    "국방", "군", "안보", "병역", "군인", "경찰", "치안", "범죄", "형사", "수사",
    "재난", "안전", "소방", "교통사고", "핵", "미사일", "테러", "사이버보안",
    "방위산업", "방산", "군사", "민방위", "예비군", "해경", "식품안전",
  ],
};

interface ValueKeywords {
  positive: string[];
  negative: string[];
}

/** 경제 성향: +1 = 친기업·규제완화, -1 = 친노동·시장개입 */
const ECON_VALUE_KEYWORDS: ValueKeywords = {
  positive: [
    "규제완화", "규제 완화", "규제 개선", "기업 지원", "기업지원",
    "세금 감면", "감세", "세율 인하", "세율인하", "법인세 인하",
    "영업 자유", "민영화", "시장 자율", "자유무역", "FTA",
    "투자 촉진", "투자촉진", "규제 철폐", "시장경쟁 촉진",
    "기업 부담 완화", "친기업", "사업자 지원",
  ],
  negative: [
    "최저임금 인상", "노동권", "근로자 보호", "노동조합", "노조",
    "해고 제한", "고용 보호", "임금 보장", "근로시간 단축",
    "산업재해", "비정규직 보호", "노동 보호", "직장 내 괴롭힘",
    "근로감독", "고용 안정", "불공정 계약", "갑질 금지",
    "노동착취", "임금체불",
  ],
};

/** 정부 역할: +1 = 작은 정부·감세, -1 = 큰 정부·복지 확대 */
const GOV_ROLE_KEYWORDS: ValueKeywords = {
  positive: [
    "감세", "세금 인하", "재정 건전성", "재정건전성", "민영화",
    "규제 철폐", "정부 효율화", "규제 개혁", "행정 간소화",
    "부채 감축", "재정 절약", "공공부문 효율", "작은 정부",
    "세출 절감", "예산 삭감",
  ],
  negative: [
    "복지 확대", "지원 확대", "예산 증액", "공공서비스 확대",
    "국가 책임", "보편적 복지", "공공의료", "무상",
    "지원금 확대", "공공주택", "공공임대", "국가보조",
    "사회안전망", "재정 지출 확대", "복지 강화",
    "저소득층 지원", "국가 지원 강화",
  ],
};

// ============================================================
// 4. 쟁점도(Controversy) 가중치 계산
// ============================================================

/**
 * 반대·기권 비율을 기반으로 쟁점 가중치를 산출.
 *
 * - 만장일치(反+棄 < 5%) 일부개정법률안 → 0 (분석 제외)
 * - 만장일치에 가까운 기타 법안             → 0.1 (최소값)
 * - 쟁점 법안 (反+棄 ≥ 5%)               → 0.1 ~ 1.0 선형 스케일
 */
function computeControversyWeight(
  yesCount: number,
  noCount: number,
  abstainCount: number,
  billName: string
): number {
  const total = yesCount + noCount + abstainCount;
  if (total === 0) return 0.1;

  const oppositionRatio = (noCount + abstainCount) / total;

  if (oppositionRatio < 0.05 && billName.includes("일부개정법률안")) {
    return 0; // 만장일치 소소한 개정안 — 성향 분석 무의미
  }

  if (oppositionRatio < 0.05) {
    return 0.1;
  }

  // [0.05, 1.0] → [0.1, 1.0] 선형 정규화
  const scaled = 0.1 + ((oppositionRatio - 0.05) / 0.95) * 0.9;
  return Math.min(1.0, Math.max(0.1, +scaled.toFixed(4)));
}

// ============================================================
// 5. 법안 카테고리 분류 (키워드 매칭)
// ============================================================

function classifyBillCategory(billName: string, committee: string): BillCategory {
  const text = `${billName} ${committee}`;

  const scores = new Map<Exclude<BillCategory, "기타">, number>([
    ["경제/산업", 0],
    ["사회/복지", 0],
    ["교육/문화", 0],
    ["환경/에너지", 0],
    ["국방/안전", 0],
  ]);

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    Exclude<BillCategory, "기타">,
    string[]
  ][]) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        scores.set(cat, (scores.get(cat) ?? 0) + 1);
      }
    }
  }

  let best: Exclude<BillCategory, "기타"> = "경제/산업";
  let bestScore = -1;
  for (const [cat, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  return bestScore === 0 ? "기타" : best;
}

// ============================================================
// 6. 가치 지향성 스코어링
// ============================================================

interface BillValueScore {
  /** -1.0(친노동) ~ +1.0(친기업) */
  econValue: number;
  /** -1.0(큰 정부) ~ +1.0(작은 정부) */
  govValue: number;
}

function scoreBillValue(billName: string, committee: string): BillValueScore {
  const text = `${billName} ${committee}`;

  let econPos = 0, econNeg = 0;
  let govPos = 0, govNeg = 0;

  for (const kw of ECON_VALUE_KEYWORDS.positive)  if (text.includes(kw)) econPos++;
  for (const kw of ECON_VALUE_KEYWORDS.negative)  if (text.includes(kw)) econNeg++;
  for (const kw of GOV_ROLE_KEYWORDS.positive)    if (text.includes(kw)) govPos++;
  for (const kw of GOV_ROLE_KEYWORDS.negative)    if (text.includes(kw)) govNeg++;

  // 양쪽 키워드가 모두 없으면 0; 충돌 시 차이의 비율로 결정
  const econTotal = econPos + econNeg;
  const govTotal  = govPos  + govNeg;

  return {
    econValue: econTotal === 0 ? 0 : (econPos - econNeg) / econTotal,
    govValue:  govTotal  === 0 ? 0 : (govPos  - govNeg)  / govTotal,
  };
}

// ============================================================
// 7. 요약 텍스트 자동 생성
// ============================================================

function generateSummaryText(
  econScore: number,
  govScore: number,
  topCategory: BillCategory,
  meaningfulVotes: number
): string {
  const dataNote =
    meaningfulVotes < 10
      ? "제한된 표결 데이터를 바탕으로 분석한 결과, "
      : "";

  const econDesc =
    econScore > 0.4  ? "친기업·규제완화 성향이 뚜렷" :
    econScore > 0.15 ? "시장 자율을 선호" :
    econScore < -0.4 ? "친노동·시장개입 성향이 뚜렷" :
    econScore < -0.15? "노동·복지를 우선시" :
    "경제 분야에서 중도적 입장";

  const govDesc =
    govScore > 0.4  ? "재정 건전성과 작은 정부를 강하게 지지" :
    govScore > 0.15 ? "정부 효율화를 중시" :
    govScore < -0.4 ? "공공서비스·복지 확대를 강하게 지지" :
    govScore < -0.15? "사회안전망 강화를 선호" :
    "정부 역할에서 균형적 시각을 보임";

  return (
    `${dataNote}이 의원은 ${topCategory} 분야에 가장 높은 관심을 보이며, ${econDesc}입니다. ` +
    `정부 역할에 있어서는 ${govDesc}하는 경향이 있습니다.`
  );
}

// ============================================================
// 8. 메인 분석 파이프라인
// ============================================================

export async function analyzeLegislator(
  legislatorId: string
): Promise<LegislatorAnalysisResult> {
  const now = new Date().toISOString();

  // ── 표결 기록 조회 ──
  const rawVotes = await db
    .select({ billId: assemblyVotes.billId, voteResult: assemblyVotes.voteResult })
    .from(assemblyVotes)
    .where(eq(assemblyVotes.legislatorId, legislatorId));

  if (rawVotes.length === 0) return emptyResult(legislatorId, now);

  // ── 법안 메타데이터 배치 조회 ──
  const billIds = rawVotes.map((v) => v.billId);
  const billRows = await db
    .select({
      billId:       assemblyBills.billId,
      billName:     assemblyBills.billName,
      committee:    assemblyBills.committee,
      yesCount:     assemblyBills.yesCount,
      noCount:      assemblyBills.noCount,
      abstainCount: assemblyBills.abstainCount,
      proposeDate:  assemblyBills.proposeDate,
    })
    .from(assemblyBills)
    .where(inArray(assemblyBills.billId, billIds));

  const billMap = new Map(billRows.map((b) => [b.billId, b]));

  // ── 내부 처리 구조체 ──
  interface ScoredVote {
    billId: string;
    billName: string;
    committee: string;
    controversyWeight: number;
    voteMultiplier: 1 | -1;
    category: BillCategory;
    econValue: number;
    govValue: number;
    impactScore: number;
    date: string;
  }

  const scoredVotes: ScoredVote[] = [];

  for (const vote of rawVotes) {
    // 기권·불출석·미참석 제외 (성향 판단 불가)
    if (vote.voteResult !== "찬성" && vote.voteResult !== "반대") continue;

    const bill = billMap.get(vote.billId);
    if (!bill) continue;

    const weight = computeControversyWeight(
      bill.yesCount,
      bill.noCount,
      bill.abstainCount,
      bill.billName
    );
    if (weight === 0) continue; // 만장일치 일부개정 — 제외

    const category                 = classifyBillCategory(bill.billName, bill.committee);
    const { econValue, govValue }  = scoreBillValue(bill.billName, bill.committee);
    const voteMultiplier: 1 | -1   = vote.voteResult === "찬성" ? 1 : -1;

    // 영향력 점수 = 쟁점도 × (|경제 기여| + |정부 기여|)
    const impactScore = weight * (Math.abs(econValue) + Math.abs(govValue));

    scoredVotes.push({
      billId: vote.billId,
      billName: bill.billName,
      committee: bill.committee,
      controversyWeight: weight,
      voteMultiplier,
      category,
      econValue,
      govValue,
      impactScore,
      date: bill.proposeDate,
    });
  }

  if (scoredVotes.length === 0) return emptyResult(legislatorId, now);

  // ── 카테고리별 가중치 합산 ──
  const catWeightMap = new Map<BillCategory, number>();
  for (const sv of scoredVotes) {
    catWeightMap.set(sv.category, (catWeightMap.get(sv.category) ?? 0) + sv.controversyWeight);
  }
  const totalCatWeight = [...catWeightMap.values()].reduce((a, b) => a + b, 0);

  const topCategories: CategoryBreakdown[] = [...catWeightMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, wSum]) => ({
      category,
      percentage: totalCatWeight > 0 ? Math.round((wSum / totalCatWeight) * 100) : 0,
      billCount:  scoredVotes.filter((sv) => sv.category === category).length,
      weightedCount: +wSum.toFixed(1),
    }));

  // ── 가중 평균 이념 스코어 ──
  let totalWeight = 0, econSum = 0, govSum = 0;
  for (const sv of scoredVotes) {
    totalWeight += sv.controversyWeight;
    econSum     += sv.controversyWeight * sv.econValue * sv.voteMultiplier;
    govSum      += sv.controversyWeight * sv.govValue  * sv.voteMultiplier;
  }

  const clamp  = (v: number) => Math.max(-1, Math.min(1, v));
  const r2     = (v: number) => Math.round(v * 100) / 100;

  const finalEcon = totalWeight > 0 ? r2(clamp(econSum / totalWeight)) : 0;
  const finalGov  = totalWeight > 0 ? r2(clamp(govSum  / totalWeight)) : 0;

  const valueAxes: ValueAxis[] = [
    {
      id: "economy",
      label: "경제 성향",
      score: finalEcon,
      leftLabel: "친노동·시장개입",
      rightLabel: "친기업·규제완화",
      description: econAxisDesc(finalEcon),
    },
    {
      id: "government",
      label: "정부 역할",
      score: finalGov,
      leftLabel: "큰정부·복지확대",
      rightLabel: "작은정부·감세",
      description: govAxisDesc(finalGov),
    },
  ];

  // ── 대표 법안 TOP 3 ──
  const keyBills: KeyBill[] = [...scoredVotes]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3)
    .map((sv) => ({
      billId:             sv.billId,
      billName:           sv.billName,
      committee:          sv.committee,
      controversyWeight:  r2(sv.controversyWeight),
      vote:               sv.voteMultiplier === 1 ? "찬성" : "반대",
      category:           sv.category,
      impactScore:        r2(sv.impactScore),
      date:               sv.date,
    }));

  // ── 요약 텍스트 ──
  const summaryText = generateSummaryText(
    finalEcon,
    finalGov,
    topCategories[0]?.category ?? "기타",
    scoredVotes.length
  );

  // ── 신뢰도: 분석된 표결 수 기준 ──
  const confidence: "high" | "medium" | "low" =
    scoredVotes.length >= 50 ? "high" :
    scoredVotes.length >= 15 ? "medium" : "low";

  return {
    legislatorId,
    analyzedAt: now,
    totalVotesConsidered: rawVotes.length,
    meaningfulVotesCount: scoredVotes.length,
    topCategories,
    valueAxes,
    summaryText,
    keyBills,
    confidence,
  };
}

// ============================================================
// 9. 헬퍼 함수
// ============================================================

function econAxisDesc(score: number): string {
  if (score >  0.4)  return "강한 친기업·규제완화 성향";
  if (score >  0.15) return "시장 자율 선호";
  if (score < -0.4)  return "강한 친노동·시장개입 성향";
  if (score < -0.15) return "노동·복지 우선";
  return "중도 균형";
}

function govAxisDesc(score: number): string {
  if (score >  0.4)  return "강한 작은정부·감세 지향";
  if (score >  0.15) return "재정 건전화 선호";
  if (score < -0.4)  return "강한 복지국가·공공서비스 확대";
  if (score < -0.15) return "사회안전망 강화 지향";
  return "중도 균형";
}

function emptyResult(legislatorId: string, analyzedAt: string): LegislatorAnalysisResult {
  return {
    legislatorId,
    analyzedAt,
    totalVotesConsidered: 0,
    meaningfulVotesCount: 0,
    topCategories: [],
    valueAxes: [
      {
        id: "economy",
        label: "경제 성향",
        score: 0,
        leftLabel: "친노동·시장개입",
        rightLabel: "친기업·규제완화",
        description: "데이터 없음",
      },
      {
        id: "government",
        label: "정부 역할",
        score: 0,
        leftLabel: "큰정부·복지확대",
        rightLabel: "작은정부·감세",
        description: "데이터 없음",
      },
    ],
    summaryText: "표결 데이터가 충분하지 않아 성향 분석을 진행할 수 없습니다.",
    keyBills: [],
    confidence: "low",
  };
}
