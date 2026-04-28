import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Clock,
  Newspaper,
  ChevronDown,
  ChevronUp,
  Star,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { candidates as mockCandidates, getPartyColor } from "@/lib/mock-data";
import { MessageCircle, Eye, ThumbsUp, PenSquare } from "lucide-react";

// ─── 뉴스 타입 ──────────────────────────────────────────────────────────────
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceCode: string;
  thumbnail?: string;
}
interface NewsResponse {
  items: NewsItem[];
}

// ─── 날짜 포맷 ───────────────────────────────────────────────────────────────
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

// ─── 당색 텍스트 변환 ─────────────────────────────────────────────────────────
function partyTextColor(party: string): string {
  if (party.includes("더불어민주당")) return "text-blue-600";
  if (party.includes("국민의힘")) return "text-red-500";
  if (party.includes("조국혁신당")) return "text-blue-800";
  if (party.includes("개혁신당")) return "text-orange-500";
  if (party.includes("진보당")) return "text-red-700";
  return "text-gray-600";
}

// sessionStorage에 임시 후보 데이터 저장/조회용
export function saveCandidateToSession(key: string, data: any) {
  try {
    sessionStorage.setItem(`candidate_${key}`, JSON.stringify(data));
  } catch {}
}
function loadCandidateFromSession(key: string): any | null {
  try {
    const raw = sessionStorage.getItem(`candidate_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── 실현가능성 분석 헬퍼 ──────────────────────────────────────────────────
function analyzeFeasibility(title: string, description: string): {
  score: number; label: string; color: string; bg: string; reasons: string[]; concerns: string[];
} {
  const text = (title + " " + description).toLowerCase();
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
  if (text.includes("연구") || text.includes("검토") || text.includes("검討")) { score -= 5; concerns.push("구체적 방안 미확정"); }
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

// ─── 별점 컴포넌트 ─────────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly = false, size = "md" }: {
  value: number; onChange?: (v: number) => void; readonly?: boolean; size?: "sm" | "md" | "lg";
}) {
  const [hover, setHover] = useState(0);
  const cls = size === "lg" ? "w-8 h-8" : size === "sm" ? "w-4 h-4" : "w-6 h-6";
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          className={`${cls} cursor-${readonly ? "default" : "pointer"} transition-colors ${
            (hover || value) >= s ? "fill-yellow-400 text-yellow-400" : "text-gray-200 hover:text-yellow-300"
          }`}
          onClick={() => !readonly && onChange?.(s)}
          onMouseEnter={() => !readonly && setHover(s)}
          onMouseLeave={() => !readonly && setHover(0)}
        />
      ))}
    </div>
  );
}

// ─── 공약 상세 Bottom Sheet ────────────────────────────────────────────────
function PledgeDetailSheet({ candidateId, promise, open, onClose }: {
  candidateId: string;
  promise: { id: string; title: string; description: string } | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentContent, setCommentContent] = useState("");
  const [activeTab, setActiveTab] = useState<"analysis" | "comments">("analysis");

  const { data: ratingData, refetch: refetchRating } = useQuery({
    queryKey: ["pledge_ratings", candidateId, promise?.id],
    queryFn: () => apiRequest("GET", `/api/candidates/${candidateId}/pledges/${promise!.id}/ratings`).then(r => r.json()),
    enabled: open && !!promise,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ["pledge_comments", candidateId, promise?.id],
    queryFn: () => apiRequest("GET", `/api/candidates/${candidateId}/pledges/${promise!.id}/comments`).then(r => r.json()),
    enabled: open && !!promise,
  });

  const rateMutation = useMutation({
    mutationFn: (rating: number) => apiRequest("POST", `/api/candidates/${candidateId}/pledges/${promise!.id}/ratings`, { rating }),
    onSuccess: () => { toast({ title: "별점 저장됨" }); refetchRating(); },
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/candidates/${candidateId}/pledges/${promise!.id}/comments`, { content }),
    onSuccess: () => { setCommentContent(""); refetchComments(); toast({ title: "댓글 등록 완료" }); },
    onError: (e: Error) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  if (!promise) return null;

  const feasibility = analyzeFeasibility(promise.title, promise.description);
  const avg = ratingData?.average ?? 0;
  const myRating = ratingData?.myRating ?? 0;
  const totalCount = ratingData?.totalCount ?? 0;

  const handleRate = (r: number) => {
    if (!user) { toast({ title: "로그인 필요", description: "별점 평가를 위해 로그인이 필요합니다." }); return; }
    rateMutation.mutate(r);
  };

  const handleComment = () => {
    if (!user) { toast({ title: "로그인 필요", description: "댓글 작성을 위해 로그인이 필요합니다." }); return; }
    if (!commentContent.trim()) return;
    commentMutation.mutate(commentContent);
  };

  return (
    <>
      {/* 오버레이 */}
      {open && <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />}

      {/* Sheet */}
      <div className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[92vh] flex flex-col ${open ? "translate-y-0" : "translate-y-full"}`}>
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="px-5 pt-2 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-black text-gray-900 leading-snug">{promise.title}</h2>
              {promise.description && (
                <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">{promise.description}</p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full shrink-0 transition-colors">
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mt-4 bg-gray-100 rounded-xl p-1">
            {(["analysis", "comments"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[12px] font-bold rounded-lg transition-colors ${activeTab === tab ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}>
                {tab === "analysis" ? "📊 분석" : `💬 댓글 ${comments.length > 0 ? `(${comments.length})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "analysis" ? (
            <div className="px-5 py-4 space-y-4">
              {/* 실현가능성 */}
              <div className={`rounded-2xl p-4 ${feasibility.bg} border border-${feasibility.color.replace("text-", "")}/20`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-black text-gray-800">실현 가능성</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-black ${feasibility.color}`}>{feasibility.label}</span>
                    <div className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: feasibility.score >= 75 ? '#10b981' : feasibility.score >= 55 ? '#3b82f6' : feasibility.score >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {feasibility.score}점
                    </div>
                  </div>
                </div>
                {/* 게이지 바 */}
                <div className="h-2.5 bg-white/60 rounded-full overflow-hidden mb-4">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${feasibility.score}%`,
                      background: feasibility.score >= 75 ? '#10b981' : feasibility.score >= 55 ? '#3b82f6' : feasibility.score >= 40 ? '#f59e0b' : '#ef4444'
                    }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 mb-1.5 flex items-center gap-1">✅ 긍정 요인</p>
                    {feasibility.reasons.map((r, i) => (
                      <p key={i} className="text-[11px] text-gray-600 mb-1 leading-relaxed">· {r}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-red-500 mb-1.5 flex items-center gap-1">⚠️ 우려 요인</p>
                    {feasibility.concerns.map((c, i) => (
                      <p key={i} className="text-[11px] text-gray-600 mb-1 leading-relaxed">· {c}</p>
                    ))}
                  </div>
                </div>
                <p className="text-[9px] text-gray-400 mt-3 text-center">* AI 기반 자동 분석 결과입니다. 참고용으로만 활용하세요.</p>
              </div>

              {/* 별점 */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
                <p className="text-[13px] font-black text-gray-800 mb-3">이 공약, 어떻게 생각하시나요?</p>
                <div className="flex items-center gap-4">
                  <StarRating value={myRating} onChange={handleRate} size="lg" />
                  <div className="text-right flex-1">
                    <p className="text-2xl font-black text-indigo-700">{avg > 0 ? avg.toFixed(1) : "—"}</p>
                    <p className="text-[10px] text-gray-400">{totalCount}명 평가</p>
                  </div>
                </div>
                {myRating > 0 && (
                  <p className="text-[11px] text-indigo-500 font-medium mt-2 text-center">
                    {myRating >= 4 ? "👍 긍정적으로 평가하셨습니다" : myRating === 3 ? "🤔 보통으로 평가하셨습니다" : "👎 부정적으로 평가하셨습니다"}
                  </p>
                )}
              </div>

              {/* 분포 */}
              {totalCount > 0 && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-[12px] font-bold text-gray-700 mb-2">시민 평가 현황</p>
                  <div className="flex items-center gap-3">
                    <StarRating value={avg} readonly size="sm" />
                    <span className="text-[13px] font-black text-gray-800">{avg.toFixed(1)}</span>
                    <span className="text-[11px] text-gray-400">/ 5점 ({totalCount}명)</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* 댓글 목록 */}
              <div className="flex-1 px-5 py-4 space-y-3">
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                    <MessageCircle className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-medium">첫 번째 댓글을 남겨보세요!</p>
                  </div>
                ) : (
                  comments.map((c: any) => (
                    <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-[10px] font-black text-indigo-600">
                              {(c.anonNickname || "익명").charAt(0)}
                            </span>
                          </div>
                          <span className="text-[12px] font-bold text-gray-800">{c.anonNickname || "익명의 유권자"}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTime(c.createdAt)}</span>
                      </div>
                      <p className="text-[13px] text-gray-700 leading-relaxed pl-9">{c.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 댓글 입력창 (댓글 탭일 때만) */}
        {activeTab === "comments" && (
          <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={commentContent}
                  onChange={e => setCommentContent(e.target.value)}
                  placeholder={user ? "이 공약에 대한 의견을 남겨주세요..." : "로그인 후 댓글을 남길 수 있습니다"}
                  rows={2}
                  disabled={!user}
                  className="w-full text-[13px] px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 resize-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                />
              </div>
              <Button
                onClick={handleComment}
                disabled={commentMutation.isPending || !commentContent.trim() || !user}
                className="h-[52px] px-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold text-[13px] shrink-0"
              >
                {commentMutation.isPending ? "..." : "등록"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── 공약 카드 (클릭 → Sheet 오픈) ──────────────────────────────────────
function PledgeCard({ candidateId, promise, onClick }: {
  candidateId: string;
  promise: { id: string; title: string; description: string };
  onClick: () => void;
}) {
  const { data: ratingData } = useQuery({
    queryKey: ["pledge_ratings", candidateId, promise.id],
    queryFn: () => apiRequest("GET", `/api/candidates/${candidateId}/pledges/${promise.id}/ratings`).then(r => r.json()),
    staleTime: 30 * 1000,
  });

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ["pledge_comments", candidateId, promise.id],
    queryFn: () => apiRequest("GET", `/api/candidates/${candidateId}/pledges/${promise.id}/comments`).then(r => r.json()),
    staleTime: 30 * 1000,
  });

  const feasibility = analyzeFeasibility(promise.title, promise.description);
  const avg = ratingData?.average ?? 0;
  const totalCount = ratingData?.totalCount ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all duration-200 group"
    >
      <div className="mt-0.5 shrink-0 w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
        <CheckCircle2 className="w-4 h-4 text-indigo-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[14px] text-gray-900 leading-snug group-hover:text-indigo-700 transition-colors">{promise.title}</p>
        {promise.description && (
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-1 leading-relaxed">{promise.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          {/* 실현가능성 뱃지 */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${feasibility.bg} ${feasibility.color}`}>
            실현가능성 {feasibility.label}
          </span>
          {/* 별점 */}
          {avg > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {avg.toFixed(1)} ({totalCount})
            </span>
          )}
          {/* 댓글 수 */}
          {(comments as any[]).length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <MessageCircle className="w-3 h-3" />
              {(comments as any[]).length}
            </span>
          )}
        </div>
      </div>
      <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 rotate-[-90deg] shrink-0 mt-2 transition-colors" />
    </button>
  );
}

// ─── 후보 상세 페이지 ─────────────────────────────────────────────────────────
export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [selectedPledge, setSelectedPledge] = useState<{ id: string; title: string; description: string } | null>(null);

  // 1) id 또는 이름으로 mock-data에서 찾기
  const decodedId = decodeURIComponent(id ?? "");
  const mockCandidate = mockCandidates.find(
    (c) => c.id === decodedId || c.name === decodedId
  );

  // 2) sessionStorage에서 election-home이 저장한 후보 데이터 읽기
  const sessionCandidate = !mockCandidate ? loadCandidateFromSession(decodedId) : null;

  // 후보 통합 — mock 우선, 없으면 session, 없으면 null
  const candidate = mockCandidate ?? (sessionCandidate ? {
    id: String(sessionCandidate.id ?? decodedId),
    name: sessionCandidate.name ?? decodedId,
    party: sessionCandidate.party ?? "",
    photo: sessionCandidate.photo ?? "",
    electionType: "local" as const,
    background: sessionCandidate.background ?? "후보 정보를 불러오는 중입니다.",
    promises: (sessionCandidate.pledges ?? []).map((p: any, i: number) => ({
      id: `p${i}`,
      title: typeof p === "string" ? p : p.title ?? p,
      description: typeof p === "string" ? "" : p.description ?? "",
    })),
    pastActivities: sessionCandidate.pastActivities ?? [],
    timeline: sessionCandidate.timeline ?? [],
    ratings: sessionCandidate.ratings ?? [],
  } : null);

  // 뉴스 API — 후보 이름으로 검색
  const candidateName = candidate?.name ?? decodedId;
  const { data: newsData, isLoading: newsLoading } = useQuery<NewsResponse>({
    queryKey: ["/api/news", candidateName],
    queryFn: async () => {
      const res = await fetch(`/api/news`);
      if (!res.ok) return { items: [] };
      const data = await res.json();
      // 제목에 후보 이름이 포함된 기사만 필터
      const filtered = (data.items || []).filter((item: NewsItem) =>
        item.title.includes(candidateName)
      );
      return { items: filtered };
    },
    enabled: !!candidateName,
  });

  // 커뮤니티 게시글 조회
  const { data: posts, isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/community/posts", "candidate", decodedId],
    queryFn: () => apiRequest("GET", `/api/community/posts?tagType=candidate&tagId=${decodedId}`).then((r) => r.json()),
  });

  // 후보자 평가 (별점) 조회
  const { data: ratingData, refetch: refetchRating } = useQuery({
    queryKey: ["/api/candidates/rating", decodedId],
    queryFn: () => apiRequest("GET", `/api/candidates/${decodedId}/rating`).then(r => r.json()),
  });

  const rateMutation = useMutation({
    mutationFn: async (rating: number) => {
      const res = await apiRequest("POST", "/api/candidates/rate", { candidateId: decodedId, rating });
      return res.json();
    },
    onSuccess: (data) => {
      refetchRating();
      toast({ title: "평가 완료", description: `후보자에게 ${data.rating}점을 주셨습니다.` });
    }
  });

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <User className="w-16 h-16 text-gray-300" />
        <p className="text-gray-500 font-medium">후보 정보를 찾을 수 없습니다.</p>
        <Link href="/">
          <Button variant="outline">홈으로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  const avgRating = ratingData?.average || 0;
  const myRating = ratingData?.myRating || 0;
  const totalCount = ratingData?.totalCount || 0;

  const newsItems = newsData?.items ?? [];
  const visibleNews = newsExpanded ? newsItems : newsItems.slice(0, 4);

  const partyBg = getPartyColor(candidate.party);

  return (
    <>
      <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-lg mx-auto pb-24"
    >
      {/* ── 헤더 ── */}
      <div className={`${partyBg} px-4 pt-10 pb-16 relative`}>
        <Link href="/">
          <button className="absolute top-10 left-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </Link>
        <div className="flex flex-col items-center gap-3 mt-6">
          <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white/60 flex items-center justify-center text-white font-black text-3xl shadow-lg">
            {candidate.photo ? (
              <img
                src={candidate.photo}
                alt={candidate.name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              candidate.name.charAt(0)
            )}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-white">{candidate.name}</h1>
            <p className="text-white/80 text-sm mt-1 font-medium">{candidate.party}</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
              <span className="text-white font-bold text-sm">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-white/60 text-xs">({totalCount}명 평가)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 탭 컨텐츠 ── */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <Tabs defaultValue="pledges">
            <TabsList className="w-full rounded-none border-b bg-white h-12">
              <TabsTrigger value="pledges" className="flex-1 text-sm font-bold rounded-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">
                공약
              </TabsTrigger>
              <TabsTrigger value="background" className="flex-1 text-sm font-bold rounded-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">
                이력
              </TabsTrigger>
              <TabsTrigger value="news" className="flex-1 text-sm font-bold rounded-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">
                뉴스
              </TabsTrigger>
              <TabsTrigger value="discussion" className="flex-1 text-sm font-bold rounded-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">
                토론
              </TabsTrigger>
            </TabsList>

            {/* ── 공약 탭 ── */}
            <TabsContent value="pledges" className="p-4 space-y-3">
              {candidate.background && (
                <p className="text-[13px] text-gray-500 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">{candidate.background}</p>
              )}
              <p className="text-[11px] text-gray-400 font-medium px-1">공약을 클릭하면 상세 분석과 시민 의견을 볼 수 있습니다</p>
              <div className="space-y-2">
                {candidate.promises.map((promise) => (
                  <PledgeCard
                    key={promise.id}
                    candidateId={candidate.id}
                    promise={promise}
                    onClick={() => setSelectedPledge(promise)}
                  />
                ))}
              </div>
            </TabsContent>

            {/* ── 이력 탭 ── */}
            <TabsContent value="background" className="p-5 space-y-6">
              {/* 주요 경력 */}
              <div>
                <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block" />
                  주요 경력
                </h3>
                <ul className="space-y-2">
                  {candidate.pastActivities.map((activity, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                      {activity}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 타임라인 */}
              <div>
                <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block" />
                  활동 타임라인
                </h3>
                <div className="relative pl-5 border-l-2 border-indigo-100 space-y-5">
                  {candidate.timeline.map((event) => (
                    <div key={event.id} className="relative">
                      <span className="absolute -left-[1.35rem] top-1 w-3 h-3 rounded-full bg-indigo-400 border-2 border-white shadow" />
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm text-gray-900">{event.title}</p>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {event.date}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{event.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── 관련 뉴스 탭 ── */}
            <TabsContent value="news" className="p-5">
              {newsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : newsItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
                  <Newspaper className="w-10 h-10 text-gray-300" />
                  <p className="text-sm font-medium">관련 뉴스가 없습니다.</p>
                  <p className="text-xs text-gray-400">뉴스 탭에서 최신 정치 뉴스를 확인하세요.</p>
                  <Link href="/news">
                    <Button variant="outline" size="sm" className="mt-2">
                      뉴스 보러 가기
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleNews.map((item, i) => (
                      <motion.a
                        key={i}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 group"
                      >
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="w-16 h-16 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                            <Newspaper className="w-6 h-6 text-indigo-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {item.source}
                            </Badge>
                            <span className="text-[10px] text-gray-400">
                              {formatTime(item.pubDate)}
                            </span>
                            <ExternalLink className="w-3 h-3 text-gray-300 ml-auto group-hover:text-indigo-400 transition-colors" />
                          </div>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                  {newsItems.length > 4 && (
                    <button
                      onClick={() => setNewsExpanded(!newsExpanded)}
                      className="w-full mt-4 py-2.5 text-sm text-indigo-600 font-medium flex items-center justify-center gap-1 hover:bg-indigo-50 rounded-xl transition-colors"
                    >
                      {newsExpanded ? (
                        <>접기 <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>{newsItems.length - 4}개 더 보기 <ChevronDown className="w-4 h-4" /></>
                      )}
                    </button>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── 토론 탭 ── */}
            <TabsContent value="discussion" className="p-0">
              <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[12px] font-bold text-slate-500">이 후보에 대한 시민들의 의견</p>
                <Link href={`/community/write?tagType=candidate&tagId=${decodedId}&tagName=${candidate.name}`}>
                  <Button size="sm" className="h-8 bg-indigo-600 text-[11px] font-bold rounded-full gap-1">
                    <PenSquare className="w-3 h-3" /> 의견 쓰기
                  </Button>
                </Link>
              </div>

              <div className="divide-y divide-slate-50">
                {postsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-5 flex flex-col gap-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))
                ) : posts && posts.length > 0 ? (
                  posts.map((post) => (
                    <Link key={post.id} href={`/community/${post.id}`}>
                      <div className="p-5 hover:bg-slate-50/80 transition-colors cursor-pointer group">
                        <h3 className="text-[14px] font-bold text-slate-800 mb-1 group-hover:text-indigo-600">
                          {post.title}
                        </h3>
                        <p className="text-[12px] text-slate-500 line-clamp-1 mb-2">{post.content}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                          <span className="text-slate-600 font-bold">{post.displayName || "익명"}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.viewCount}</span>
                          <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.likes}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.commentCount}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <MessageCircle className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-medium">첫 번째 의견을 남겨주세요!</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── 평가하기 섹션 ── */}
        <div className="mt-6 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 shadow-xl text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
            </div>
            <div>
              <h3 className="font-bold text-[16px]">후보자 평가하기</h3>
              <p className="text-white/70 text-[11px]">이 후보의 행보와 공약을 어떻게 생각하시나요?</p>
            </div>
          </div>

          <div className="flex justify-between items-center bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => rateMutation.mutate(star)}
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                    (myRating || 0) >= star ? "bg-yellow-400 text-indigo-900" : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  <Star className={`w-5 h-5 ${(myRating || 0) >= star ? "fill-current" : ""}`} />
                </button>
              ))}
            </div>
            <div className="text-right">
              <p className="text-[10px] opacity-60 font-medium">현재 나의 점수</p>
              <p className="text-2xl font-black">{myRating ? `${myRating}점` : "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>

    <PledgeDetailSheet
      candidateId={candidate.id}
      promise={selectedPledge}
      open={!!selectedPledge}
      onClose={() => setSelectedPledge(null)}
    />
    </>
  );
}
