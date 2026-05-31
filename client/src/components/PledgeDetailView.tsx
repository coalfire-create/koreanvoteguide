import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { ArrowLeft, CheckCircle2, MessageCircle, ThumbsUp, Sparkles, AlertCircle, Loader2, ChevronDown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getPartyHex } from "@/lib/utils";

function formatTime(pubDate: string): string {
  if (!pubDate) return "";
  try {
    const date = new Date(pubDate);
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "방금";
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch {
    return "";
  }
}

// ─── 공약 텍스트 가독성 향상 포매터 (목표, 이행 방법 등) ─────────
function FormattedText({ text, size = "sm" }: { text: string; size?: "sm" | "base" }) {
  if (!text) return null;
  const lines = text.split("\n");
  
  const textClass = size === "sm" ? "text-[13px] text-gray-800 font-medium" : "text-[15px] text-gray-800 font-medium";
  const spacingClass = size === "sm" ? "mb-1.5" : "mb-2.5";
  const lineHClass = size === "sm" ? "leading-relaxed" : "leading-[1.8]";

  return (
    <div className={`space-y-0.5 ${textClass} ${lineHClass} break-words`}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className={size === "sm" ? "h-1" : "h-1.5"} />;
        
        // 글머리 기호 감지 (○, □, -, *, ①, ②, 1., 2. 등)
        const match = trimmed.match(/^([○□\-\*①②③④⑤⑥⑦⑧⑨⑩]|\d+\.)\s*(.*)/);
        
        if (match) {
          const [, bullet, content] = match;
          return (
            <div key={i} className={`flex items-start gap-1.5 ${spacingClass}`}>
              <span className={`shrink-0 font-bold ${size === "sm" ? "mt-[2px]" : "mt-[3px]"}`}>{bullet}</span>
              <span className="flex-1">{content}</span>
            </div>
          );
        }
        
        return <p key={i} className={spacingClass}>{trimmed}</p>;
      })}
    </div>
  );
}

// ─── 단독 공약 실현가능성 초기 추정 (로딩 중 표시용 키워드 기반) ─────────
export function analyzeFeasibility(
  title: string,
  description: string,
  opts?: { method?: string; funding?: string; duration?: string; realmName?: string; content?: string },
): {
  score: number; label: string; color: string; bg: string; reasons: string[]; concerns: string[];
} {
  const method = opts?.method ?? "";
  const funding = opts?.funding ?? "";
  const duration = opts?.duration ?? "";
  const content = opts?.content ?? "";

  // 전체 텍스트를 종합적으로 분석
  const text = [title, description, method, funding, duration, content].join(" ").toLowerCase();
  let score = 35; // 기본 점수를 낮게 시작 — 구체성이 있어야 올라가도록
  const reasons: string[] = [];
  const concerns: string[] = [];

  // ── 1) 구조적 정보 존재 여부 (가장 큰 차별화 요인) ──
  const hasMethod = method.trim().length > 10;
  const hasFunding = funding.trim().length > 10;
  const hasDuration = duration.trim().length > 5;
  const hasContent = content.trim().length > 20 || description.trim().length > 20;

  if (hasMethod) { score += 12; reasons.push("이행 방법 제시"); }
  else { concerns.push("이행 방법 미기재"); }

  if (hasFunding) { score += 15; reasons.push("재원 조달 방안 제시"); }
  else { concerns.push("재원 조달 방안 미기재"); }

  if (hasDuration) { score += 8; reasons.push("이행 기간 명시"); }
  else { concerns.push("이행 기간 미기재"); }

  if (hasContent) { score += 5; }

  // ── 2) 재원 조달 구체성 (금액·출처 언급 시 가산) ──
  const fundingText = funding.toLowerCase();
  if (fundingText && (/\d/.test(fundingText) || fundingText.includes("억") || fundingText.includes("조"))) {
    score += 5; reasons.push("구체적 금액 명시");
  }
  if (fundingText && (fundingText.includes("국비") || fundingText.includes("지방비") || fundingText.includes("민자"))) {
    score += 3;
  }

  // ── 3) 이행 방법 구체성 ──
  const methodText = method.toLowerCase();
  if (methodText && methodText.length > 50) { score += 3; }
  if (methodText && (methodText.includes("조례") || methodText.includes("법률") || methodText.includes("개정"))) {
    score += 4; reasons.push("법적 근거 마련 계획");
  }

  // ── 4) 이행 기간 구체성 ──
  const durationText = duration.toLowerCase();
  if (durationText && (durationText.includes("년") || durationText.includes("단계") || /\d/.test(durationText))) {
    score += 3;
  }

  // ── 5) 키워드 기반 보정 (기존 로직 유지하되 비중 축소) ──
  if (text.includes("예산") || text.includes("재원")) { score += 2; }
  if (text.includes("단계") || text.includes("순차") || text.includes("점진")) { score += 3; reasons.push("단계적 실현 방안"); }
  if (text.includes("확대") || text.includes("강화") || text.includes("개선")) { score += 2; }
  if (text.includes("무상") || text.includes("전면")) { score -= 5; concerns.push("전면 시행 시 재정 부담"); }
  if (text.includes("즉시") || text.includes("바로") || text.includes("당장")) { score -= 4; concerns.push("단기 실현 가능성 불투명"); }
  if (text.includes("혁신") || text.includes("대전환") || text.includes("전면개편")) { score -= 3; concerns.push("구조적 변화 수반"); }

  score = Math.max(10, Math.min(95, score));
  if (reasons.length === 0) reasons.push("공약 내용 검토 중");
  if (concerns.length === 0) concerns.push("세부 이행 계획 추가 확인 필요");

  let label = "보통"; let color = "text-amber-600"; let bg = "bg-amber-50";
  if (score >= 75) { label = "높음"; color = "text-emerald-600"; bg = "bg-emerald-50"; }
  else if (score >= 55) { label = "중간"; color = "text-blue-600"; bg = "bg-blue-50"; }
  else if (score < 40) { label = "낮음"; color = "text-red-500"; bg = "bg-red-50"; }

  return { score, label, color, bg, reasons, concerns };
}

// ─── AI 5축 정밀 평가 타입 ───────────────────────────────────────────
interface DetailedAxis {
  score: number;   // 1~5
  analysis: string; // 한국어 평가 텍스트
}

interface DetailedAxes {
  internalConsistency: DetailedAxis;
  planSpecificity: DetailedAxis;
  financialFeasibility: DetailedAxis;
  economicViability: DetailedAxis;
  precedentVerification: DetailedAxis;
}

// ─── AI 단독 공약 분석 결과 타입 ─────────────────────────────────────
interface PledgeAnalysisResult {
  feasibilityScore: number;
  feasibilityLabel: string;
  authorityScore?: number;
  fundingScore?: number;
  timelineScore?: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  /** 짧고 직설적인 실현가능성 비판 — 신규 엄격 프롬프트 결과 */
  feasibilityCritique?: string;
  voterTip: string;
  /** 5축 정밀 평가 (신규) */
  detailedAxes?: DetailedAxes | null;
  /** 핵심 취약점 (신규) */
  keyVulnerability?: string;
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface Pledge {
  id: string;
  title: string;
  description?: string;
  /** 선관위 공보 표준 구조 — LLM 엄격 채점 입력 */
  realmName?: string;
  content?: string;
  method?: string;
  funding?: string;
  duration?: string;
}

export interface CompareWith {
  candidateId: string;
  name: string;
  party: string;
  pledge: Pledge;
  /** 후보 추가 컨텍스트 (DB 동기화 후 LLM 분석 정확도 향상용) */
  job?: string;
  career1?: string;
}

interface PledgeDetailViewProps {
  candidateId: string;
  candidateName?: string;
  candidateParty?: string;
  /** 현직(job) — DB 후보의 추가 컨텍스트 */
  candidateJob?: string;
  /** 주요 경력(career1) — DB 후보의 추가 컨텍스트 */
  candidateCareer1?: string;
  promise: Pledge | null;
  open: boolean;
  onClose: () => void;
  /** 비교 모드 (election-home에서 전달) */
  compareWith?: CompareWith | null;
}

// ─── 공약 개별 실현가능성 평가 섹션 (비교 뷰 내 삽입용) ───────────────────
function PledgeFeasibilitySection({
  promise,
  candidateName = "",
  candidateParty = "",
  candidateJob = "",
  candidateCareer1 = "",
}: {
  promise: Pledge;
  candidateName?: string;
  candidateParty?: string;
  candidateJob?: string;
  candidateCareer1?: string;
}) {
  const fallback = analyzeFeasibility(promise.title, promise.description || "", { method: promise.method, funding: promise.funding, duration: promise.duration, content: promise.content, realmName: promise.realmName });
  const pledgeText = promise.title + (promise.description ? ` — ${promise.description}` : "");

  const { data: ai, isLoading, isError } = useQuery<PledgeAnalysisResult>({
    queryKey: ["pledge-analyze", promise.id, promise.title, promise.method, promise.funding, promise.duration],
    queryFn: async () => {
      const res = await fetch("/api/candidates/analyze-pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidateName,
          party: candidateParty,
          job: candidateJob,
          career1: candidateCareer1,
          pledge: pledgeText,
          title: promise.title,
          realmName: promise.realmName,
          content: promise.content ?? promise.description,
          method: promise.method,
          funding: promise.funding,
          duration: promise.duration,
        }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const json = await res.json();
      // 서버가 rate limit으로 fallback 응답을 보냈으면 재시도
      if (json?._isFallback) throw new Error("AI_RATE_LIMITED");
      return {
        feasibilityScore: typeof json?.feasibilityScore === "number" ? json.feasibilityScore : fallback.score,
        feasibilityLabel: json?.feasibilityLabel ?? fallback.label,
        authorityScore: typeof json?.authorityScore === "number" ? json.authorityScore : undefined,
        fundingScore: typeof json?.fundingScore === "number" ? json.fundingScore : undefined,
        timelineScore: typeof json?.timelineScore === "number" ? json.timelineScore : undefined,
        summary: json?.summary ?? "",
        strengths: Array.isArray(json?.strengths) ? json.strengths : [],
        concerns: Array.isArray(json?.concerns) ? json.concerns : [],
        feasibilityCritique:
          typeof json?.feasibilityCritique === "string"
            ? json.feasibilityCritique
            : typeof json?.feasibility_critique === "string"
            ? json.feasibility_critique
            : undefined,
        voterTip: json?.voterTip ?? "",
        detailedAxes: json?.detailedAxes ?? null,
        keyVulnerability: json?.keyVulnerability ?? null,
      } as PledgeAnalysisResult;
    },
    staleTime: 60 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(5000 * Math.pow(3, attempt), 30000), // 5s, 15s, 30s
  });

  const axesAvgScore = (() => {
    const axes = ai?.detailedAxes;
    if (!axes) return null;
    const vals = Object.values(axes)
      .map((a) => a?.score)
      .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((sum, s) => sum + s, 0) / vals.length) * 20);
  })();
  const score = axesAvgScore ?? ai?.feasibilityScore ?? fallback.score;
  const label = score >= 75 ? "높음" : score >= 55 ? "중간" : score >= 35 ? "보통" : "낮음";
  const scoreColor =
    score >= 75 ? "text-emerald-600" :
    score >= 55 ? "text-blue-600" :
    score >= 40 ? "text-amber-600" : "text-red-500";
  const scoreBg =
    score >= 75 ? "bg-emerald-50" :
    score >= 55 ? "bg-blue-50" :
    score >= 40 ? "bg-amber-50" : "bg-red-50";
  const barColor =
    score >= 75 ? "#10b981" : score >= 55 ? "#3b82f6" : "#f59e0b";

  return (
    <div className="mt-3 pt-3 md:mt-6 md:pt-6 border-t border-gray-100 space-y-3 md:space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 md:gap-1.5">
          <Sparkles className="w-3 md:w-3.5 h-3 md:h-3.5 text-indigo-600" />
          <span className="text-[10px] md:text-[12px] font-black text-gray-800">AI 실현가능성</span>
        </div>
        {isLoading && <Loader2 className="w-3 md:w-3.5 h-3 md:h-3.5 text-indigo-400 animate-spin" />}
      </div>

      {isError && (
        <div className="flex items-center gap-1.5 p-2 bg-red-50 rounded-xl text-[10px] md:text-[11px] text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          평가 로드 실패
        </div>
      )}

      {/* 종합 점수 카드 */}
      <div className={`rounded-xl p-2.5 md:p-4 ${scoreBg}`}>
        <div className="flex items-center justify-between mb-1.5 md:mb-2">
          <span className="text-[10px] md:text-[12px] font-bold text-gray-700">종합 평가</span>
          <div className="flex items-center gap-1 md:gap-2">
            <span className={`text-[11px] md:text-[13px] font-black ${scoreColor}`}>{label}</span>
            <div className="text-[9px] md:text-[11px] font-bold text-white px-1.5 md:px-2 py-0.5 rounded-full"
              style={{ backgroundColor: barColor }}>
              {score}점
            </div>
          </div>
        </div>

        <div className="h-1.5 md:h-2 bg-white/60 rounded-full overflow-hidden mb-1 shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* 5축 차트 - 모바일에서는 숨김 */}
      {ai?.detailedAxes && (
        <div className="mt-3 hidden md:block">
          <DetailedAxesChart axes={ai.detailedAxes} />
        </div>
      )}

      {/* 핵심 취약점 */}
      {ai?.keyVulnerability && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-100 rounded-xl p-2 md:p-3 text-[10px] md:text-[12px] text-red-700 leading-relaxed break-words"
        >
          <div className="flex items-center gap-1 mb-1">
            <Shield className="w-3 h-3 text-red-600 shrink-0" />
            <span className="font-black">핵심 취약점</span>
          </div>
          <p>{ai.keyVulnerability}</p>
        </motion.div>
      )}
    </div>
  );
}


// ─── 공약 분석 공용 훅 — analyze-pledge 호출 + 종합 점수 계산 ────────────────
// 단독 뷰/비교 뷰가 동일 queryKey를 공유하므로 React Query가 네트워크 호출을 dedupe 한다.
function usePledgeAnalysis(
  promise: Pledge,
  candidate: { name?: string; party?: string; job?: string; career1?: string },
) {
  const fallback = analyzeFeasibility(promise.title, promise.description || "", { method: promise.method, funding: promise.funding, duration: promise.duration, content: promise.content, realmName: promise.realmName });
  const pledgeText = promise.title + (promise.description ? ` — ${promise.description}` : "");

  const query = useQuery<PledgeAnalysisResult>({
    queryKey: ["pledge-analyze", promise.id, promise.title, promise.method, promise.funding, promise.duration],
    queryFn: async () => {
      const res = await fetch("/api/candidates/analyze-pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.name ?? "",
          party: candidate.party ?? "",
          job: candidate.job ?? "",
          career1: candidate.career1 ?? "",
          pledge: pledgeText,
          title: promise.title,
          realmName: promise.realmName,
          content: promise.content ?? promise.description,
          method: promise.method,
          funding: promise.funding,
          duration: promise.duration,
        }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const json = await res.json();
      if (json?._isFallback) throw new Error("AI_RATE_LIMITED");
      return {
        feasibilityScore: typeof json?.feasibilityScore === "number" ? json.feasibilityScore : fallback.score,
        feasibilityLabel: json?.feasibilityLabel ?? fallback.label,
        summary: json?.summary ?? "",
        strengths: Array.isArray(json?.strengths) ? json.strengths : [],
        concerns: Array.isArray(json?.concerns) ? json.concerns : [],
        feasibilityCritique:
          typeof json?.feasibilityCritique === "string" ? json.feasibilityCritique
          : typeof json?.feasibility_critique === "string" ? json.feasibility_critique
          : undefined,
        voterTip: json?.voterTip ?? "",
        detailedAxes: json?.detailedAxes ?? null,
        keyVulnerability: json?.keyVulnerability ?? null,
      } as PledgeAnalysisResult;
    },
    staleTime: 60 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(5000 * Math.pow(3, attempt), 30000),
  });

  const ai = query.data;
  const axesAvgScore = (() => {
    const axes = ai?.detailedAxes;
    if (!axes) return null;
    const vals = Object.values(axes)
      .map((a) => a?.score)
      .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((sum, s) => sum + s, 0) / vals.length) * 20);
  })();
  const score = axesAvgScore ?? ai?.feasibilityScore ?? fallback.score;
  const label = score >= 75 ? "높음" : score >= 55 ? "중간" : score >= 35 ? "보통" : "낮음";
  const scoreColor = score >= 75 ? "text-emerald-600" : score >= 55 ? "text-blue-600" : score >= 40 ? "text-amber-600" : "text-red-500";
  const scoreBg = score >= 75 ? "bg-emerald-50" : score >= 55 ? "bg-blue-50" : score >= 40 ? "bg-amber-50" : "bg-red-50";
  const barColor = score >= 75 ? "#10b981" : score >= 55 ? "#3b82f6" : "#f59e0b";

  return { ...query, ai, score, label, scoreColor, scoreBg, barColor };
}

// ─── 비교 뷰용 — 후보별 5축 정밀 평가 패널 ─────────────────────────────────
function CandidatePledgeAxes({ analysis }: { analysis: ReturnType<typeof usePledgeAnalysis> }) {
  const { ai, isLoading, score, label, scoreColor, scoreBg, barColor } = analysis;

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <div className="animate-pulse h-10 bg-gray-100 rounded-xl" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-3">
            <div className="h-3 bg-gray-100 rounded-full flex-1" style={{ maxWidth: `${90 - i * 6}%` }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 종합 평가 */}
      <div className={`rounded-xl p-3 ${scoreBg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-gray-700">종합 평가</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[12px] font-black ${scoreColor}`}>{label}</span>
            <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: barColor }}>
              {score}점
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-white/60 rounded-full overflow-hidden shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* 5축 차트 */}
      {ai?.detailedAxes && <DetailedAxesChart axes={ai.detailedAxes} />}
    </div>
  );
}

// ============================================================
// 비교 모드 뷰
// ============================================================

function ComparisonView({
  candidateA,
  candidateB,
  onClose,
}: {
  candidateA: { candidateId: string; name: string; party: string; pledge: Pledge; job?: string; career1?: string };
  candidateB: CompareWith;
  onClose: () => void;
}) {
  const colorA = getPartyHex(candidateA.party);
  const colorB = getPartyHex(candidateB.party);

  // 두 후보의 5축 분석을 한 번씩만 호출(별도 compare-pledges LLM 호출 제거).
  // 하단 5축 차트도 이 결과를 그대로 재사용한다.
  const analysisA = usePledgeAnalysis(candidateA.pledge, candidateA);
  const analysisB = usePledgeAnalysis(candidateB.pledge, candidateB);

  const comparing = analysisA.isLoading || analysisB.isLoading;
  const scoreGap = Math.abs(analysisA.score - analysisB.score);
  const leaderName =
    analysisA.score === analysisB.score
      ? null
      : analysisA.score > analysisB.score
      ? candidateA.name
      : candidateB.name;
  const leaderColor = leaderName === candidateA.name ? colorA : colorB;

  return (
    <div>
      {/* AI 분석 */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-[16px] font-black text-gray-900">AI 공약 비교 분석</h3>
          <span className="text-[10px] font-bold text-[#6D28D9] bg-indigo-50 px-2 py-0.5 rounded-full">AI 분석</span>
        </div>

        {comparing ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-gray-100 rounded-full mb-2" style={{ width: `${90 - i * 10}%` }} />
                <div className="h-3 bg-gray-100 rounded-full" style={{ width: `${70 - i * 5}%` }} />
              </div>
            ))}
            <p className="text-[12px] text-gray-400 text-center pt-2">AI가 공약을 분석하고 있습니다...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 종합 점수 대결 */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3 text-center">종합 실현가능성 점수</p>
              <div className="flex items-stretch justify-between gap-2">
                <div className="flex-1 text-center">
                  <div className="text-[12px] font-black mb-1 break-words" style={{ color: colorA }}>{candidateA.name}</div>
                  <div className="text-[32px] font-black leading-none" style={{ color: colorA }}>{analysisA.score}</div>
                  <div className="text-[11px] font-bold text-gray-400 mt-0.5">{analysisA.label}</div>
                </div>
                <div className="flex items-center text-[12px] font-black text-gray-300">VS</div>
                <div className="flex-1 text-center">
                  <div className="text-[12px] font-black mb-1 break-words" style={{ color: colorB }}>{candidateB.name}</div>
                  <div className="text-[32px] font-black leading-none" style={{ color: colorB }}>{analysisB.score}</div>
                  <div className="text-[11px] font-bold text-gray-400 mt-0.5">{analysisB.label}</div>
                </div>
              </div>
              <p className="text-[12px] text-center font-bold mt-3 pt-3 border-t border-gray-200">
                {leaderName ? (
                  <>
                    <span style={{ color: leaderColor }}>{leaderName}</span>
                    <span className="text-gray-600"> 공약이 종합 {scoreGap}점 우세</span>
                  </>
                ) : (
                  <span className="text-gray-600">두 공약의 종합 점수가 동일합니다 (박빙)</span>
                )}
              </p>
            </div>

            {/* 후보별 요약 + 핵심 취약점 */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              {([
                [candidateA, analysisA, colorA],
                [candidateB, analysisB, colorB],
              ] as const).map(([cand, analysis, color], idx) => (
                <div key={idx} className="rounded-xl md:rounded-2xl p-2.5 md:p-4" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}25` }}>
                  <p className="text-[10px] md:text-[11px] font-black mb-1.5 md:mb-2 break-words" style={{ color }}>{cand.name}</p>
                  {analysis.ai?.summary && (
                    <p className="text-[11px] md:text-[12px] text-gray-700 leading-relaxed mb-2">{analysis.ai.summary}</p>
                  )}
                  {analysis.ai?.keyVulnerability && (
                    <div className="flex items-start gap-1 mt-2">
                      <Shield className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-[10px] md:text-[11px] text-red-600 leading-relaxed">{analysis.ai.keyVulnerability}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-400 text-center italic">
              * AI가 각 공약을 독립적으로 채점한 결과를 비교한 것입니다
            </p>
          </div>
        )}
      </div>

      {/* 5축 정밀 평가 */}
      <div className="px-4 pb-8 pt-2 border-t border-gray-100 mt-2">
        <p className="text-[12px] font-black text-gray-400 uppercase tracking-wider pt-4 mb-4">5축 정밀 평가</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorA }} />
              <span className="text-[14px] font-black" style={{ color: colorA }}>{candidateA.name}</span>
            </div>
            <CandidatePledgeAxes analysis={analysisA} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorB }} />
              <span className="text-[14px] font-black" style={{ color: colorB }}>{candidateB.name}</span>
            </div>
            <CandidatePledgeAxes analysis={analysisB} />
          </div>
        </div>
      </div>

      {/* 두 후보 공약 카드 */}
      <div className="grid grid-cols-2 gap-2 border-t border-b border-gray-100 p-2 md:gap-4 md:p-4">
        <div className="p-3 md:p-5 border border-gray-100 rounded-2xl flex flex-col justify-between" style={{ borderTop: `4px solid ${colorA}` }}>
          <div>
            <div className="text-[10px] md:text-[11px] font-black mb-1 md:mb-2 uppercase tracking-wider" style={{ color: colorA }}>
              {candidateA.party}
            </div>
            <div className="text-[13px] md:text-[15px] font-black text-gray-900 mb-0.5 md:mb-1 break-words">{candidateA.name}</div>
            <p className="text-[12px] md:text-[13px] text-gray-700 leading-relaxed font-medium break-words">{candidateA.pledge.title}</p>
            {candidateA.pledge.description && (
              <p className="text-[11px] md:text-[12px] text-gray-400 mt-1 md:mt-2 leading-relaxed break-words">{candidateA.pledge.description}</p>
            )}
            {(candidateA.pledge.content || candidateA.pledge.method || candidateA.pledge.funding || candidateA.pledge.duration) && (
              <div className="mt-3 pt-3 md:mt-4 md:pt-4 border-t border-gray-100 space-y-3 md:space-y-4">
                {candidateA.pledge.content && (
                  <div className="bg-indigo-50/40 rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-indigo-100 shadow-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-indigo-100/50 flex items-center justify-center border border-indigo-200/50">
                        <CheckCircle2 className="w-3 md:w-3.5 h-3 md:h-3.5 text-indigo-600" />
                      </div>
                      <span className="text-[10px] md:text-[12px] font-black text-indigo-700 uppercase tracking-wider">목표</span>
                    </div>
                    <FormattedText text={candidateA.pledge.content} size="sm" />
                  </div>
                )}
                {candidateA.pledge.method && (
                  <div className="bg-emerald-50/40 rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-emerald-100/50 flex items-center justify-center border border-emerald-200/50">
                        <span className="text-[10px] md:text-[12px]">📋</span>
                      </div>
                      <span className="text-[10px] md:text-[12px] font-black text-emerald-700 uppercase tracking-wider">이행 방법</span>
                    </div>
                    <FormattedText text={candidateA.pledge.method} size="sm" />
                  </div>
                )}
                {candidateA.pledge.funding && (
                  <div className="bg-amber-50/40 rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-amber-100 shadow-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-amber-100/50 flex items-center justify-center border border-amber-200/50">
                        <span className="text-[10px] md:text-[12px]">💰</span>
                      </div>
                      <span className="text-[10px] md:text-[12px] font-black text-amber-700 uppercase tracking-wider">재원 조달</span>
                    </div>
                    <FormattedText text={candidateA.pledge.funding} size="sm" />
                  </div>
                )}
                {candidateA.pledge.duration && (
                  <div className="bg-sky-50/40 rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-sky-100 shadow-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-sky-100/50 flex items-center justify-center border border-sky-200/50">
                        <span className="text-[10px] md:text-[12px]">⏱️</span>
                      </div>
                      <span className="text-[10px] md:text-[12px] font-black text-sky-700 uppercase tracking-wider">이행 기간</span>
                    </div>
                    <FormattedText text={candidateA.pledge.duration} size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
        <div className="p-3 md:p-5 border border-gray-100 rounded-2xl flex flex-col justify-between" style={{ borderTop: `4px solid ${colorB}` }}>
          <div>
            <div className="text-[10px] md:text-[11px] font-black mb-1 md:mb-2 uppercase tracking-wider" style={{ color: colorB }}>
              {candidateB.party}
            </div>
            <div className="text-[13px] md:text-[15px] font-black text-gray-900 mb-0.5 md:mb-1 break-words">{candidateB.name}</div>
            <p className="text-[12px] md:text-[13px] text-gray-700 leading-relaxed font-medium break-words">{candidateB.pledge.title}</p>
            {candidateB.pledge.description && (
              <p className="text-[11px] md:text-[12px] text-gray-400 mt-1 md:mt-2 leading-relaxed break-words">{candidateB.pledge.description}</p>
            )}
            {(candidateB.pledge.content || candidateB.pledge.method || candidateB.pledge.funding || candidateB.pledge.duration) && (
              <div className="mt-3 pt-3 md:mt-4 md:pt-4 border-t border-gray-100 space-y-3 md:space-y-4">
                {candidateB.pledge.content && (
                  <div className="bg-indigo-50/40 rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-indigo-100 shadow-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-indigo-100/50 flex items-center justify-center border border-indigo-200/50">
                        <CheckCircle2 className="w-3 md:w-3.5 h-3 md:h-3.5 text-indigo-600" />
                      </div>
                      <span className="text-[10px] md:text-[12px] font-black text-indigo-700 uppercase tracking-wider">목표</span>
                    </div>
                    <FormattedText text={candidateB.pledge.content} size="sm" />
                  </div>
                )}
                {candidateB.pledge.method && (
                  <div className="bg-emerald-50/40 rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-emerald-100/50 flex items-center justify-center border border-emerald-200/50">
                        <span className="text-[10px] md:text-[12px]">📋</span>
                      </div>
                      <span className="text-[10px] md:text-[12px] font-black text-emerald-700 uppercase tracking-wider">이행 방법</span>
                    </div>
                    <FormattedText text={candidateB.pledge.method} size="sm" />
                  </div>
                )}
                {candidateB.pledge.funding && (
                  <div className="bg-amber-50/40 rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-amber-100 shadow-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-amber-100/50 flex items-center justify-center border border-amber-200/50">
                        <span className="text-[10px] md:text-[12px]">💰</span>
                      </div>
                      <span className="text-[10px] md:text-[12px] font-black text-amber-700 uppercase tracking-wider">재원 조달</span>
                    </div>
                    <FormattedText text={candidateB.pledge.funding} size="sm" />
                  </div>
                )}
                {candidateB.pledge.duration && (
                  <div className="bg-sky-50/40 rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-sky-100 shadow-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-sky-100/50 flex items-center justify-center border border-sky-200/50">
                        <span className="text-[10px] md:text-[12px]">⏱️</span>
                      </div>
                      <span className="text-[10px] md:text-[12px] font-black text-sky-700 uppercase tracking-wider">이행 기간</span>
                    </div>
                    <FormattedText text={candidateB.pledge.duration} size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 5축 정밀 평가 차트 컴포넌트
// ============================================================

const AXIS_META: Record<string, { label: string; emoji: string; color: string; bgColor: string; barColor: string }> = {
  internalConsistency: { label: "내부 정합성", emoji: "🔗", color: "text-violet-700", bgColor: "bg-violet-50", barColor: "#7c3aed" },
  planSpecificity: { label: "이행계획 구체성", emoji: "📋", color: "text-blue-700", bgColor: "bg-blue-50", barColor: "#2563eb" },
  financialFeasibility: { label: "재정 실현가능성", emoji: "💰", color: "text-amber-700", bgColor: "bg-amber-50", barColor: "#d97706" },
  economicViability: { label: "경제적 타당성", emoji: "📊", color: "text-emerald-700", bgColor: "bg-emerald-50", barColor: "#059669" },
  precedentVerification: { label: "선례 검증", emoji: "🔍", color: "text-rose-700", bgColor: "bg-rose-50", barColor: "#e11d48" },
};

function DetailedAxesChart({ axes }: { axes: DetailedAxes }) {
  const [expandedAxis, setExpandedAxis] = useState<string | null>(null);

  const axisEntries = Object.entries(axes).filter(
    ([key]) => key in AXIS_META
  ) as [string, DetailedAxis][];

  const avgScore = axisEntries.length > 0
    ? (axisEntries.reduce((sum, [, v]) => sum + v.score, 0) / axisEntries.length).toFixed(1)
    : "–";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mb-6"
    >
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] font-black text-gray-500 uppercase tracking-wider">5축 정밀 평가</p>
        <span className="text-[13px] font-bold text-gray-500">평균 {avgScore} / 5.0</span>
      </div>

      <div className="space-y-3">
        {axisEntries.map(([key, axis], idx) => {
          const meta = AXIS_META[key];
          if (!meta) return null;
          const pct = (axis.score / 5) * 100;
          const isExpanded = expandedAxis === key;

          return (
            <div key={key}>
              <button
                onClick={() => setExpandedAxis(isExpanded ? null : key)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-[15px]">{meta.emoji}</span>
                  <span className={`text-[13px] font-bold ${meta.color} flex-1`}>{meta.label}</span>
                  <span className={`text-[14px] font-black ${meta.color}`}>{axis.score}</span>
                  <span className="text-[11px] text-gray-400 font-medium">/ 5</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
                <div className="h-3 bg-white/80 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * idx, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: meta.barColor }}
                  />
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && axis.analysis && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className={`mt-2 ${meta.bgColor} rounded-xl p-4 border border-gray-100`}>
                      <p className="text-[14px] text-gray-700 leading-[1.8] break-words">{axis.analysis}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================================
// 단독 공약 뷰 (candidate-detail.tsx 호환)
// ============================================================

function SinglePledgeView({
  promise,
  candidateName = "",
  candidateParty = "",
  candidateJob = "",
  candidateCareer1 = "",
}: {
  promise: Pledge;
  candidateName?: string;
  candidateParty?: string;
  candidateJob?: string;
  candidateCareer1?: string;
}) {
  const fallback = analyzeFeasibility(promise.title, promise.description || "", { method: promise.method, funding: promise.funding, duration: promise.duration, content: promise.content, realmName: promise.realmName });

  const pledgeText = promise.title + (promise.description ? ` — ${promise.description}` : "");

  const { data: ai, isLoading, isError } = useQuery<PledgeAnalysisResult>({
    queryKey: ["pledge-analyze", promise.id, promise.title, promise.method, promise.funding, promise.duration],
    queryFn: async () => {
      const res = await fetch("/api/candidates/analyze-pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidateName,
          party: candidateParty,
          job: candidateJob,
          career1: candidateCareer1,
          // 레거시 호환용 합쳐진 문자열
          pledge: pledgeText,
          // 구조화된 선관위 공보 필드 — 엄격 채점기 입력
          title: promise.title,
          realmName: promise.realmName,
          content: promise.content ?? promise.description,
          method: promise.method,
          funding: promise.funding,
          duration: promise.duration,
        }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const json = await res.json();
      // 서버가 rate limit으로 fallback 응답을 보냈으면 재시도
      if (json?._isFallback) throw new Error("AI_RATE_LIMITED");
      return {
        feasibilityScore: typeof json?.feasibilityScore === "number" ? json.feasibilityScore : fallback.score,
        feasibilityLabel: json?.feasibilityLabel ?? fallback.label,
        authorityScore: typeof json?.authorityScore === "number" ? json.authorityScore : undefined,
        fundingScore: typeof json?.fundingScore === "number" ? json.fundingScore : undefined,
        timelineScore: typeof json?.timelineScore === "number" ? json.timelineScore : undefined,
        summary: json?.summary ?? "",
        strengths: Array.isArray(json?.strengths) ? json.strengths : [],
        concerns: Array.isArray(json?.concerns) ? json.concerns : [],
        feasibilityCritique:
          typeof json?.feasibilityCritique === "string"
            ? json.feasibilityCritique
            : typeof json?.feasibility_critique === "string"
            ? json.feasibility_critique
            : undefined,
        voterTip: json?.voterTip ?? "",
        detailedAxes: json?.detailedAxes ?? null,
        keyVulnerability: json?.keyVulnerability ?? null,
      } as PledgeAnalysisResult;
    },
    staleTime: 60 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(5000 * Math.pow(3, attempt), 30000), // 5s, 15s, 30s
  });

  // 종합 점수: AI 응답(공약별로 다른 LLM 채점)을 우선, 로딩/실패 시에만 키워드 fallback.
  // detailedAxes가 있으면 5축 평균(×20)으로 보정해 헤드라인과 차트가 항상 일치하도록 한다.
  const axesAvgScore = (() => {
    const axes = ai?.detailedAxes;
    if (!axes) return null;
    const vals = Object.values(axes)
      .map((a) => a?.score)
      .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((sum, s) => sum + s, 0) / vals.length) * 20);
  })();
  const score = axesAvgScore ?? ai?.feasibilityScore ?? fallback.score;
  const label = score >= 75 ? "높음" : score >= 55 ? "중간" : score >= 35 ? "보통" : "낮음";
  const scoreColor =
    score >= 75 ? "text-emerald-600" :
    score >= 55 ? "text-blue-600" :
    score >= 40 ? "text-amber-600" : "text-red-500";
  const scoreBg =
    score >= 75 ? "bg-emerald-50" :
    score >= 55 ? "bg-blue-50" :
    score >= 40 ? "bg-amber-50" : "bg-red-50";
  const barColor =
    score >= 75 ? "#10b981" : score >= 55 ? "#3b82f6" : "#f59e0b";

  return (
    <div>
      <div className="px-4 py-6 bg-gradient-to-b from-indigo-50/50 to-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          {promise.realmName && (
            <span className="inline-block text-[11px] font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
              {promise.realmName}
            </span>
          )}
        </div>
        <h1 className="text-[20px] md:text-[22px] font-black text-gray-900 leading-[1.4] mb-4 break-words">{promise.title}</h1>
        {promise.description && (
          <div className="bg-white rounded-2xl p-4 border border-indigo-100/50 shadow-sm">
            <p className="text-[14px] text-gray-700 leading-[1.7] font-medium break-words">{promise.description}</p>
          </div>
        )}

        {/* AI 실현 가능성 분석 (위로 이동됨) */}
        <div className="mt-5 space-y-4">
          {/* 헤더 */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6D28D9] to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-[16px] md:text-lg font-black text-gray-900">AI 실현 가능성 분석</h3>
            <span className="text-[10px] font-bold text-[#6D28D9] bg-indigo-50 px-2 py-0.5 rounded-full">자체 AI</span>
            {isLoading && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin ml-1" />}
          </div>

          {/* AI 요약 (로드된 경우) */}
          {ai?.summary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[#6D28D9]/5 to-indigo-50 rounded-2xl p-4 border border-indigo-100"
            >
              <p className="text-[13px] md:text-[14px] text-gray-700 leading-[1.7] break-words font-medium">{ai.summary}</p>
            </motion.div>
          )}

          {/* 종합 점수 카드 */}
          <div className={`rounded-2xl p-5 ${scoreBg} shadow-sm border border-black/5`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[14px] font-black text-gray-800">종합 평가</span>
              <div className="flex items-center gap-2">
                <span className={`text-[16px] md:text-[18px] font-black ${scoreColor}`}>{label}</span>
                <div className="text-[12px] font-bold text-white px-3 py-1 rounded-full shadow-sm"
                  style={{ backgroundColor: barColor }}>
                  {score}점
                </div>
              </div>
            </div>

            <div className="h-3 md:h-4 bg-white/60 rounded-full overflow-hidden mb-6 shadow-inner">
              <motion.div
                key={score}
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${barColor} 0%, #fff 200%)` }}
              />
            </div>

            {/* ─── 5축 정밀 평가 차트 ─── */}
            {ai?.detailedAxes && (
              <DetailedAxesChart axes={ai.detailedAxes} />
            )}

            {/* ─── 핵심 취약점 카드 ─── */}
            {ai?.keyVulnerability && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <span className="text-[12px] font-black text-red-700 uppercase tracking-wider">핵심 취약점</span>
                </div>
                <p className="text-[13px] text-red-800 leading-[1.7] font-medium break-words">{ai.keyVulnerability}</p>
              </motion.div>
            )}

            {/* ─── 비판적 평가 (feasibilityCritique) ─── */}
            {ai?.feasibilityCritique && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <span className="text-[12px] font-black text-amber-700 uppercase tracking-wider">실현가능성 비판</span>
                </div>
                <p className="text-[13px] text-amber-900 leading-[1.7] font-medium break-words">{ai.feasibilityCritique}</p>
              </motion.div>
            )}

            {/* ─── 긍정/우려 요인 ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="bg-white/50 rounded-2xl p-4 shadow-sm border border-white/60">
                <p className="text-[13px] font-bold text-emerald-600 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">✓</span>
                  긍정 요인
                </p>
                <div className="space-y-2">
                  {(ai?.strengths ?? fallback.reasons).map((r, i) => (
                    <p key={i} className="text-[12px] text-gray-700 leading-relaxed flex gap-2 break-words">
                      <span className="text-emerald-400 mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" /> {r}
                    </p>
                  ))}
                </div>
              </div>
              <div className="bg-white/50 rounded-2xl p-4 shadow-sm border border-white/60">
                <p className="text-[13px] font-bold text-red-500 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[10px]">!</span>
                  우려 요인
                </p>
                <div className="space-y-2">
                  {(ai?.concerns ?? fallback.concerns).map((c, i) => (
                    <p key={i} className="text-[12px] text-gray-700 leading-relaxed flex gap-2 break-words">
                      <span className="text-red-300 mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-red-300" /> {c}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* 유권자 팁 */}
            {ai?.voterTip && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 p-5 bg-white/60 rounded-[20px] border border-white"
              >
                <p className="text-[11px] font-black text-[#6D28D9] uppercase tracking-wider mb-2">유권자 체크포인트</p>
                <p className="text-[15px] text-gray-700 leading-[1.7] break-words font-medium">{ai.voterTip}</p>
              </motion.div>
            )}

            {isError && (
              <div className="mt-4 flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                AI 분석을 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.
              </div>
            )}

            <p className="text-[12px] text-gray-400 mt-6 text-center italic font-medium">
              {ai ? "* 자체 AI가 공약 텍스트를 기반으로 중립적으로 분석한 결과입니다" : "* 공약 텍스트 기반 자동 추정값입니다"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* 구조화 공약 정보 패널 — 선관위 공보 원문 기반 */}
        {(promise.content || promise.method || promise.funding || promise.duration) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {promise.content && (
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm md:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[13px] font-black text-indigo-600 uppercase tracking-wider">목표</span>
                </div>
                <FormattedText text={promise.content} size="sm" />
              </div>
            )}
            {promise.method && (
              <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-emerald-100/50 flex items-center justify-center border border-emerald-200/50 shrink-0">
                    <span className="text-[12px]">📋</span>
                  </div>
                  <span className="text-[13px] font-black text-emerald-700 uppercase tracking-wider">이행 방법</span>
                </div>
                <FormattedText text={promise.method} size="sm" />
              </div>
            )}
            {promise.funding && (
              <div className="bg-amber-50/40 rounded-2xl p-4 border border-amber-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-amber-100/50 flex items-center justify-center border border-amber-200/50 shrink-0">
                    <span className="text-[12px]">💰</span>
                  </div>
                  <span className="text-[13px] font-black text-amber-700 uppercase tracking-wider">재원 조달 방안</span>
                </div>
                <FormattedText text={promise.funding} size="sm" />
              </div>
            )}
            {promise.duration && (
              <div className="bg-sky-50/40 rounded-2xl p-4 border border-sky-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-sky-100/50 flex items-center justify-center border border-sky-200/50 shrink-0">
                    <span className="text-[12px]">⏱️</span>
                  </div>
                  <span className="text-[13px] font-black text-sky-700 uppercase tracking-wider">이행 기간</span>
                </div>
                <FormattedText text={promise.duration} size="sm" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 메인 컴포넌트
// ============================================================

export default function PledgeDetailView({
  candidateId,
  candidateName = "",
  candidateParty = "",
  candidateJob = "",
  candidateCareer1 = "",
  promise,
  open,
  onClose,
  compareWith,
}: PledgeDetailViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentContent, setCommentContent] = useState("");

  const isCompareMode = !!compareWith;

  const { data: comments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ["pledge_comments", candidateId, promise?.id],
    queryFn: () =>
      apiRequest("GET", `/api/candidates/${candidateId}/pledges/${promise!.id}/comments`).then((r) => r.json()),
    enabled: open && !!promise,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/candidates/${candidateId}/pledges/${promise!.id}/comments`, { content }),
    onSuccess: () => { setCommentContent(""); refetchComments(); toast({ title: "댓글 등록 완료" }); },
    onError: (e: Error) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  if (!promise) return null;

  // 전체화면 모달을 document.body로 포털 — 사이드바(z-50) 등 상위 요소 위에 확실히 덮이도록.
  // (부모의 transform/opacity 스태킹 컨텍스트에 갇혀 좌측이 사이드바에 가려지던 문제 해결)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden"
        >
          {/* 헤더 */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-10">
            <button onClick={onClose} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h2 className="text-[17px] font-black text-gray-900">
              {isCompareMode ? "공약 비교 분석" : "공약 상세 분석"}
            </h2>
            <div className="w-10" />
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col w-full">
            {isCompareMode ? (
              <ComparisonView
                candidateA={{
                  candidateId,
                  name: candidateName,
                  party: candidateParty,
                  job: candidateJob,
                  career1: candidateCareer1,
                  pledge: promise,
                }}
                candidateB={compareWith!}
                onClose={onClose}
              />
            ) : (
              <SinglePledgeView
                promise={promise}
                candidateName={candidateName}
                candidateParty={candidateParty}
                candidateJob={candidateJob}
                candidateCareer1={candidateCareer1}
              />
            )}

            {/* 시민 토론 */}
            <div className="px-6 py-12 bg-gray-50/50">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                  <h3 className="text-xl font-black text-gray-900">공약에 대한 의견</h3>
                </div>
                <span className="text-[14px] font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full ring-1 ring-indigo-100">
                  의견 {comments.length}개
                </span>
              </div>

              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-10">
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="이 공약에 대해 어떻게 생각하시나요? (비로그인 사용자도 익명으로 참여 가능합니다)"
                  rows={4}
                  className="w-full text-[15px] px-2 py-2 rounded-2xl border-none outline-none focus:ring-0 resize-none disabled:bg-transparent placeholder:text-gray-400"
                />
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={() => { if (commentContent.trim()) commentMutation.mutate(commentContent); }}
                    disabled={commentMutation.isPending || !commentContent.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-8 py-3 font-bold text-[15px] shadow-xl shadow-indigo-100"
                  >
                    {commentMutation.isPending ? "전송 중..." : "의견 남기기"}
                  </Button>
                </div>
              </div>

              <div className="space-y-5">
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-6 text-gray-300">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-10 h-10 opacity-20" />
                    </div>
                    <p className="text-[15px] font-bold text-center leading-relaxed">
                      아직 토론이 시작되지 않았습니다.<br />
                      <span className="text-indigo-400">첫 번째 의견을 남기고 토론을 이끌어보세요!</span>
                    </p>
                  </div>
                ) : (
                  comments.map((c: any) => (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={c.id}
                      className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center ring-4 ring-white shadow-sm">
                            <span className="text-[14px] font-black text-indigo-600">
                              {(c.anonNickname || "익명").charAt(0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[15px] font-black text-gray-800 block">{c.anonNickname || "익명의 유권자"}</span>
                            <span className="text-[12px] text-gray-400 font-bold">{formatTime(c.createdAt)}</span>
                          </div>
                        </div>
                        <button className="text-gray-300 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-all">
                          <ThumbsUp className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-[15px] text-gray-700 leading-relaxed pl-1">{c.content}</p>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
