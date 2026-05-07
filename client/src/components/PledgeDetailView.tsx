import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, MessageCircle, ThumbsUp, Sparkles, AlertCircle } from "lucide-react";
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

// ─── 단독 공약 실현가능성 분석 (candidate-detail.tsx 호환용) ───────────────
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

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface Pledge {
  id: string;
  title: string;
  description?: string;
}

export interface CompareWith {
  candidateId: string;
  name: string;
  party: string;
  pledge: Pledge;
}

interface PledgeDetailViewProps {
  candidateId: string;
  candidateName?: string;
  candidateParty?: string;
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
  return "#6320EE";
}

// ============================================================
// 비교 모드 뷰
// ============================================================

function ComparisonView({
  candidateA,
  candidateB,
  onClose,
}: {
  candidateA: { candidateId: string; name: string; party: string; pledge: Pledge };
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
            pledge: candidateA.pledge.title + (candidateA.pledge.description ? ` — ${candidateA.pledge.description}` : ""),
          },
          candidateB: {
            name: candidateB.name,
            party: candidateB.party,
            pledge: candidateB.pledge.title + (candidateB.pledge.description ? ` — ${candidateB.pledge.description}` : ""),
          },
        }),
      });
      if (!res.ok) throw new Error("분석 실패");
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 두 후보 공약 카드 */}
      <div className="grid grid-cols-2 gap-0">
        <div className="p-5 border-r border-gray-100" style={{ borderTop: `4px solid ${colorA}` }}>
          <div className="text-[11px] font-black mb-2 uppercase tracking-wider" style={{ color: colorA }}>
            {candidateA.party}
          </div>
          <div className="text-[15px] font-black text-gray-900 mb-1">{candidateA.name}</div>
          <p className="text-[13px] text-gray-700 leading-relaxed font-medium">{candidateA.pledge.title}</p>
          {candidateA.pledge.description && (
            <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">{candidateA.pledge.description}</p>
          )}
        </div>
        <div className="p-5" style={{ borderTop: `4px solid ${colorB}` }}>
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6320EE] to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-[16px] font-black text-gray-900">AI 공약 비교 분석</h3>
          <span className="text-[10px] font-bold text-[#6320EE] bg-indigo-50 px-2 py-0.5 rounded-full">Gemini</span>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-gray-100 rounded-full mb-2" style={{ width: `${90 - i * 10}%` }} />
                <div className="h-3 bg-gray-100 rounded-full" style={{ width: `${70 - i * 5}%` }} />
              </div>
            ))}
            <p className="text-[12px] text-gray-400 text-center pt-2">Gemini가 공약을 분석하고 있습니다...</p>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl text-[13px] text-red-600">
            <AlertCircle className="w-5 h-5 shrink-0" />
            분석 서비스를 일시적으로 이용할 수 없습니다.
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
            <div className="grid grid-cols-2 gap-3">
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
              <div className="bg-gradient-to-r from-[#6320EE]/5 to-indigo-50 rounded-2xl p-4 border border-indigo-100">
                <p className="text-[11px] font-black text-[#6320EE] uppercase tracking-wider mb-2">유권자 가이드</p>
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

function SinglePledgeView({ promise }: { promise: Pledge }) {
  const feasibility = analyzeFeasibility(promise.title, promise.description || "");

  return (
    <div className="flex-1 overflow-y-auto">
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
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
          <h3 className="text-xl font-black text-gray-900">AI 실현 가능성 분석</h3>
        </div>

        <div className={`rounded-[2.5rem] p-8 ${feasibility.bg} shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <span className="text-[16px] font-black text-gray-800">종합 평가</span>
            <div className="flex items-center gap-3">
              <span className={`text-[20px] font-black ${feasibility.color}`}>{feasibility.label}</span>
              <div className="text-[14px] font-bold text-white px-4 py-1.5 rounded-full shadow-sm"
                style={{ backgroundColor: feasibility.score >= 75 ? '#10b981' : feasibility.score >= 55 ? '#3b82f6' : feasibility.score >= 40 ? '#f59e0b' : '#ef4444' }}>
                {feasibility.score}점
              </div>
            </div>
          </div>

          <div className="h-5 bg-white/60 rounded-full overflow-hidden mb-8 shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${feasibility.score}%` }}
              transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${feasibility.score >= 75 ? '#10b981' : feasibility.score >= 55 ? '#3b82f6' : '#f59e0b'} 0%, #fff 200%)` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/50 rounded-3xl p-6 shadow-sm">
              <p className="text-[14px] font-bold text-emerald-600 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[11px]">✓</span>
                긍정 요인
              </p>
              <div className="space-y-3">
                {feasibility.reasons.map((r, i) => (
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
                {feasibility.concerns.map((c, i) => (
                  <p key={i} className="text-[14px] text-gray-700 leading-relaxed flex gap-2">
                    <span className="text-red-300 mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" /> {c}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[12px] text-gray-400 mt-8 text-center italic font-medium">
            * 위 분석은 공약 텍스트를 기반으로 한 AI 시뮬레이션 결과입니다
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
                candidateA={{ candidateId, name: candidateName, party: candidateParty, pledge: promise }}
                candidateB={compareWith!}
                onClose={onClose}
              />
            ) : (
              <SinglePledgeView promise={promise} />
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
