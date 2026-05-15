import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, MessageCircle, ThumbsUp, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

// ─── 단독 공약 실현가능성 초기 추정 (로딩 중 표시용 키워드 기반) ─────────
export function analyzeFeasibility(title: string, description: string): {
  score: number; label: string; color: string; bg: string; reasons: string[]; concerns: string[];
} {
  const text = (title + " " + (description || "")).toLowerCase();
  let score = 50;
  const reasons: string[] = [];
  const concerns: string[] = [];

  if (text.includes("예산") || text.includes("재원")) { score += 5; reasons.push("재원 조달 계획 언급"); }
  if (text.includes("단계") || text.includes("순차") || text.includes("점진")) { score += 10; reasons.push("단계적 실현 방안 제시"); }
  if (text.includes("법안") || text.includes("입법") || text.includes("개정")) { score += 8; reasons.push("입법 기반 마련 필요"); }
  if (text.includes("확대") || text.includes("강화") || text.includes("개선")) { score += 5; reasons.push("기존 제도 개선 방향"); }
  if (text.includes("무상") || text.includes("전면")) { score -= 10; concerns.push("전면 시행 시 재정 부담"); }
  if (text.includes("즉시") || text.includes("바로") || text.includes("당장")) { score -= 8; concerns.push("단기 실현 가능성 불투명"); }
  if (text.includes("혁신") || text.includes("대전환") || text.includes("전면개편")) { score -= 5; concerns.push("구조적 변화 수반, 장기간 소요"); }
  if (text.includes("연구") || text.includes("검토")) { score -= 5; concerns.push("구체적 방안 미확정"); }
  if (text.includes("지원") || text.includes("보조금")) { score += 5; reasons.push("지원 중심 정책, 시행 용이"); }

  score = Math.max(10, Math.min(95, score));
  if (reasons.length === 0) reasons.push("공약 내용 검토 중");
  if (concerns.length === 0) concerns.push("세부 이행 계획 추가 확인 필요");

  let label = "보통"; let color = "text-amber-600"; let bg = "bg-amber-50";
  if (score >= 75) { label = "높음"; color = "text-emerald-600"; bg = "bg-emerald-50"; }
  else if (score >= 55) { label = "중간"; color = "text-blue-600"; bg = "bg-blue-50"; }
  else if (score < 40) { label = "낮음"; color = "text-red-500"; bg = "bg-red-50"; }

  return { score, label, color, bg, reasons, concerns };
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

// ─── AI 비교 분석 결과 타입 ────────────────────────────────────────────────

interface CompareResult {
  coreContrast: string;
  candidateAHighlights: string[];
  candidateBHighlights: string[];
  voterGuide: string;
}

// ─── 정당 색상 ────────────────────────────────────────────────────────────────
function partyColor(party: string): string {
  if (party?.includes("더불어민주당")) return "#3A6BFF";
  if (party?.includes("국민의힘")) return "#FF3B3B";
  if (party?.includes("조국혁신당")) return "#1e3a8a";
  if (party?.includes("개혁신당")) return "#FF8C00";
  if (party?.includes("진보당")) return "#D60024";
  return "#6D28D9";
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
  const colorA = partyColor(candidateA.party);
  const colorB = partyColor(candidateB.party);

  const { data: result, isLoading, isError } = useQuery<CompareResult>({
    queryKey: ["pledge-compare", candidateA.pledge.title, candidateB.pledge.title],
    queryFn: async () => {
      const res = await fetch("/api/candidates/compare-pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateA: {
            name: candidateA.name,
            party: candidateA.party,
            job: candidateA.job ?? "",
            career1: candidateA.career1 ?? "",
            pledge: candidateA.pledge.title + (candidateA.pledge.description ? ` — ${candidateA.pledge.description}` : ""),
          },
          candidateB: {
            name: candidateB.name,
            party: candidateB.party,
            job: candidateB.job ?? "",
            career1: candidateB.career1 ?? "",
            pledge: candidateB.pledge.title + (candidateB.pledge.description ? ` — ${candidateB.pledge.description}` : ""),
          },
        }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const json = await res.json();
      // 백엔드 폴백 응답을 그대로 받아도 화면이 채워지도록 모든 필드를 보장
      return {
        coreContrast: json?.coreContrast ?? "AI 분석을 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.",
        candidateAHighlights: Array.isArray(json?.candidateAHighlights) ? json.candidateAHighlights : [],
        candidateBHighlights: Array.isArray(json?.candidateBHighlights) ? json.candidateBHighlights : [],
        voterGuide: json?.voterGuide ?? "",
      } as CompareResult;
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  return (
    <div>
      {/* 두 후보 공약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100 p-4">
        <div className="p-5 border border-gray-100 rounded-2xl" style={{ borderTop: `4px solid ${colorA}` }}>
          <div className="text-[11px] font-black mb-2 uppercase tracking-wider" style={{ color: colorA }}>
            {candidateA.party}
          </div>
          <div className="text-[15px] font-black text-gray-900 mb-1">{candidateA.name}</div>
          <p className="text-[13px] text-gray-700 leading-relaxed font-medium">{candidateA.pledge.title}</p>
          {candidateA.pledge.description && (
            <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">{candidateA.pledge.description}</p>
          )}
        </div>
        <div className="p-5 border border-gray-100 rounded-2xl" style={{ borderTop: `4px solid ${colorB}` }}>
          <div className="text-[11px] font-black mb-2 uppercase tracking-wider" style={{ color: colorB }}>
            {candidateB.party}
          </div>
          <div className="text-[15px] font-black text-gray-900 mb-1">{candidateB.name}</div>
          <p className="text-[13px] text-gray-700 leading-relaxed font-medium">{candidateB.pledge.title}</p>
          {candidateB.pledge.description && (
            <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">{candidateB.pledge.description}</p>
          )}
        </div>
      </div>

      {/* AI 분석 */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-[16px] font-black text-gray-900">AI 공약 비교 분석</h3>
          <span className="text-[10px] font-bold text-[#6D28D9] bg-indigo-50 px-2 py-0.5 rounded-full">Groq AI</span>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-gray-100 rounded-full mb-2" style={{ width: `${90 - i * 10}%` }} />
                <div className="h-3 bg-gray-100 rounded-full" style={{ width: `${70 - i * 5}%` }} />
              </div>
            ))}
            <p className="text-[12px] text-gray-400 text-center pt-2">AI가 공약을 분석하고 있습니다...</p>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl text-[13px] text-red-600">
            <AlertCircle className="w-5 h-5 shrink-0" />
            AI 분석을 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* 핵심 차이점 */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">핵심 차이점</p>
              <p className="text-[14px] text-gray-800 leading-relaxed font-medium">{result.coreContrast}</p>
            </div>

            {/* 후보별 분석 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ backgroundColor: `${colorA}10`, border: `1px solid ${colorA}25` }}>
                <p className="text-[11px] font-black mb-2" style={{ color: colorA }}>{candidateA.name} 공약</p>
                <ul className="space-y-1.5">
                  {(result.candidateAHighlights || []).map((h, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed flex gap-1.5">
                      <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: colorA }} />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: `${colorB}10`, border: `1px solid ${colorB}25` }}>
                <p className="text-[11px] font-black mb-2" style={{ color: colorB }}>{candidateB.name} 공약</p>
                <ul className="space-y-1.5">
                  {(result.candidateBHighlights || []).map((h, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed flex gap-1.5">
                      <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: colorB }} />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 유권자 가이드 */}
            {result.voterGuide && (
              <div className="bg-gradient-to-r from-[#6D28D9]/5 to-indigo-50 rounded-2xl p-4 border border-indigo-100">
                <p className="text-[11px] font-black text-[#6D28D9] uppercase tracking-wider mb-2">유권자 가이드</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{result.voterGuide}</p>
              </div>
            )}

            <p className="text-[11px] text-gray-400 text-center italic">
              * AI가 공약 텍스트를 기반으로 중립적으로 분석한 결과입니다
            </p>
          </div>
        )}
      </div>
    </div>
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
  const fallback = analyzeFeasibility(promise.title, promise.description || "");

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
      } as PledgeAnalysisResult;
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  // 외부 카드와 동일한 결과를 보여주기 위해 항상 fallback 점수/라벨 사용
  const score = fallback.score;
  const label = fallback.label;
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
      <div className="px-6 py-10 bg-gradient-to-b from-indigo-50/50 to-white">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-6 shadow-xl shadow-indigo-200">
          <CheckCircle2 className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 leading-tight mb-6">{promise.title}</h1>
        {promise.description && (
          <div className="bg-white rounded-2xl p-5 border border-indigo-100/50 shadow-sm">
            <p className="text-[16px] text-gray-600 leading-relaxed font-medium">{promise.description}</p>
          </div>
        )}
      </div>

      <div className="px-6 py-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xl font-black text-gray-900">AI 실현 가능성 분석</h3>
          <span className="text-[10px] font-bold text-[#6D28D9] bg-indigo-50 px-2 py-0.5 rounded-full">Groq AI</span>
          {isLoading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin ml-1" />}
        </div>

        {/* AI 요약 (로드된 경우) */}
        {ai?.summary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#6D28D9]/5 to-indigo-50 rounded-2xl p-4 border border-indigo-100"
          >
            <p className="text-[13px] text-gray-700 leading-relaxed">{ai.summary}</p>
          </motion.div>
        )}

        {/* 점수 카드 */}
        <div className={`rounded-[2.5rem] p-8 ${scoreBg} shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <span className="text-[16px] font-black text-gray-800">종합 평가</span>
            <div className="flex items-center gap-3">
              <span className={`text-[20px] font-black ${scoreColor}`}>{label}</span>
              <div className="text-[14px] font-bold text-white px-4 py-1.5 rounded-full shadow-sm"
                style={{ backgroundColor: barColor }}>
                {score}점
              </div>
            </div>
          </div>

          <div className="h-5 bg-white/60 rounded-full overflow-hidden mb-8 shadow-inner">
            <motion.div
              key={score}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${barColor} 0%, #fff 200%)` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/50 rounded-3xl p-6 shadow-sm">
              <p className="text-[14px] font-bold text-emerald-600 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[11px]">✓</span>
                긍정 요인
              </p>
              <div className="space-y-3">
                {(ai?.strengths ?? fallback.reasons).map((r, i) => (
                  <p key={i} className="text-[14px] text-gray-700 leading-relaxed flex gap-2">
                    <span className="text-emerald-400 mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" /> {r}
                  </p>
                ))}
              </div>
            </div>
            <div className="bg-white/50 rounded-3xl p-6 shadow-sm">
              <p className="text-[14px] font-bold text-red-500 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[11px]">!</span>
                우려 요인
              </p>
              <div className="space-y-3">
                {(ai?.concerns ?? fallback.concerns).map((c, i) => (
                  <p key={i} className="text-[14px] text-gray-700 leading-relaxed flex gap-2">
                    <span className="text-red-300 mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" /> {c}
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
              className="mt-6 p-4 bg-white/60 rounded-2xl border border-white"
            >
              <p className="text-[11px] font-black text-[#6D28D9] uppercase tracking-wider mb-1">유권자 체크포인트</p>
              <p className="text-[13px] text-gray-700">{ai.voterTip}</p>
            </motion.div>
          )}

          {isError && (
            <div className="mt-4 flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              AI 분석을 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.
            </div>
          )}

          <p className="text-[12px] text-gray-400 mt-6 text-center italic font-medium">
            {ai ? "* Groq AI(LLaMA3)가 공약 텍스트를 기반으로 중립적으로 분석한 결과입니다" : "* 공약 텍스트 기반 자동 추정값입니다"}
          </p>
        </div>
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[100] bg-white flex flex-col"
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
          <div className="flex-1 overflow-y-auto flex flex-col">
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
                  <h3 className="text-xl font-black text-gray-900">시민 토론 광장</h3>
                </div>
                <span className="text-[14px] font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full ring-1 ring-indigo-100">
                  의견 {comments.length}개
                </span>
              </div>

              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-10">
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder={user ? "이 공약에 대해 어떻게 생각하시나요?" : "로그인 후 토론에 참여할 수 있습니다"}
                  rows={4}
                  disabled={!user}
                  className="w-full text-[15px] px-2 py-2 rounded-2xl border-none outline-none focus:ring-0 resize-none disabled:bg-transparent placeholder:text-gray-400"
                />
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={() => { if (!user) { toast({ title: "로그인 필요" }); return; } if (commentContent.trim()) commentMutation.mutate(commentContent); }}
                    disabled={commentMutation.isPending || !commentContent.trim() || !user}
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
    </AnimatePresence>
  );
}
