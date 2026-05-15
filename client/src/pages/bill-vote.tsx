import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Send,
  CheckCircle2, XCircle, Flame, Loader2, Users, TrendingUp,
  Newspaper, ChevronRight, MoreVertical, Flag, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getBillEmoji } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

// 법안 상태 배지 색상
function getStatusColor(result: string) {
  if (!result || result === "" || result === "계류") return "bg-amber-100 text-amber-700 border border-amber-200";
  if (result.includes("가결") || result.includes("통과") || result.includes("공포")) return "bg-green-100 text-green-700 border border-green-200";
  if (result.includes("부결") || result.includes("폐기") || result.includes("철회")) return "bg-red-100 text-red-700 border border-red-200";
  return "bg-blue-100 text-blue-700 border border-blue-200";
}

function getStatusLabel(result: string) {
  if (!result || result === "") return "심사중";
  return result;
}

// 시간 포맷
function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return d.toLocaleDateString("ko-KR");
}

interface BillDetail {
  billId: string;
  billName: string;
  proposer: string;
  proposeDate: string;
  result: string;
  committee: string;
  coProposerCount: number;
  viewCount: number;
  voteCount: number;
  mediaMentionCount: number;
  newsMentionCount: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

interface OpinionData {
  agree: number;
  disagree: number;
  myOpinion: "agree" | "disagree" | null;
}

interface Comment {
  id: number;
  content: string;
  displayName: string;
  authorType: string;
  isVerified: boolean;
  parentId: number | null;
  createdAt: string;
  isAuthor: boolean;
}

export default function BillVote() {
  const { id: billId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");

  // 법안 데이터 (bills API에서 가져오기)
  const { data: billsData } = useQuery<{ source: string; data: any[] }>({
    queryKey: ["/api/bills"],
    staleTime: 5 * 60 * 1000,
  });

  // hot 법안에서도 찾기
  const { data: hotBills } = useQuery<any[]>({
    queryKey: ["/api/bills/hot"],
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetch("/api/bills/hot").then(r => r.json()),
  });

  // 법안 상세 찾기
  const bill: BillDetail | null = (() => {
    if (!billId) return null;
    const fromHot = hotBills?.find(b => b.billId === billId);
    if (fromHot) return fromHot;
    const allBills = billsData?.data ?? [];
    return allBills.find(b => b.billId === billId) ?? null;
  })();

  // 찬반 투표 데이터
  const { data: opinionData, isLoading: opinionLoading } = useQuery<OpinionData>({
    queryKey: ["/api/bills", billId, "opinion"],
    queryFn: () => fetch(`/api/bills/${billId}/opinion`).then(r => r.json()),
    enabled: !!billId,
    staleTime: 10 * 1000,
  });

  // 댓글 데이터 — credentials 포함해야 서버에서 isAuthor 판정 가능
  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ["/api/bills", billId, "comments"],
    queryFn: () => fetch(`/api/bills/${billId}/comments`, { credentials: "include" }).then(r => r.json()),
    enabled: !!billId,
    staleTime: 30 * 1000,
  });

  // 찬반 투표 뮤테이션
  const voteMutation = useMutation({
    mutationFn: async (opinion: "agree" | "disagree") => {
      const res = await apiRequest("POST", `/api/bills/${billId}/opinion`, { opinion });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/bills", billId, "opinion"], data);
      toast({
        title: data.myOpinion === "agree" ? "찬성에 투표했습니다!" : data.myOpinion === "disagree" ? "반대에 투표했습니다!" : "투표가 취소되었습니다",
        description: `찬성 ${data.agree}명 · 반대 ${data.disagree}명`,
      });
    },
    onError: () => {
      toast({ title: "투표 실패", description: "다시 시도해주세요.", variant: "destructive" });
    },
  });

  // 댓글 작성 뮤테이션
  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/bills/${billId}/comments`, { content });
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/bills", billId, "comments"] });
      toast({ title: "댓글이 작성되었습니다!" });
    },
    onError: (e: any) => {
      toast({ title: "오류", description: e.message || "댓글 작성 실패", variant: "destructive" });
    },
  });

  const totalVotes = (opinionData?.agree ?? 0) + (opinionData?.disagree ?? 0);
  const agreePercent = totalVotes > 0 ? Math.round((opinionData!.agree / totalVotes) * 100) : 50;
  const disagreePercent = totalVotes > 0 ? 100 - agreePercent : 50;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => navigate("/bills")}
            className="flex items-center gap-2 text-slate-500 hover:text-[#6D28D9] transition-colors font-medium text-[14px]"
          >
            <ArrowLeft className="w-5 h-5" />
            법안 현황
          </button>
          <div className="flex-1 text-center">
            <span className="text-[13px] font-bold text-slate-400">법안 찬반 투표</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* 법안 정보 카드 */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* 상단 배너 */}
          <div className="bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-8 -mb-8 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 bg-white/20 text-white text-[11px] font-bold rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                  <Flame className="w-3 h-3" /> 인기 법안
                </span>
                {bill && (
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${getStatusColor(bill.result)}`}>
                    {getStatusLabel(bill.result)}
                  </span>
                )}
              </div>

              {bill ? (
                <>
                  <h1 className="text-[20px] font-extrabold text-white leading-snug mb-2 flex items-start gap-2">
                    <span className="shrink-0">{getBillEmoji(bill.billName, bill.committee)}</span>
                    {bill.billName}
                  </h1>
                  <p className="text-indigo-200 text-[13px] font-medium">
                    {bill.committee && `${bill.committee} · `}
                    {bill.proposer && `${bill.proposer.split("(")[0].trim()} 대표발의`}
                    {bill.proposeDate && ` · ${bill.proposeDate}`}
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-3/4 bg-white/20 rounded-lg" />
                  <Skeleton className="h-4 w-1/2 bg-white/20 rounded-lg" />
                </div>
              )}
            </div>
          </div>

          {/* 통계 */}
          {bill && (
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
              <div className="px-4 py-4 text-center">
                <div className="text-[11px] font-bold text-slate-400 mb-1">공동발의</div>
                <div className="text-[22px] font-extrabold text-[#6D28D9]">{bill.coProposerCount ?? 0}<span className="text-[13px] ml-0.5">명</span></div>
              </div>
              <div className="px-4 py-4 text-center">
                <div className="text-[11px] font-bold text-slate-400 mb-1">뉴스 언급</div>
                <div className="text-[22px] font-extrabold text-[#FB923C]">{bill.newsMentionCount ?? bill.mediaMentionCount ?? 0}<span className="text-[13px] ml-0.5">회</span></div>
              </div>
              <div className="px-4 py-4 text-center">
                <div className="text-[11px] font-bold text-slate-400 mb-1">시민 투표</div>
                <div className="text-[22px] font-extrabold text-slate-800">{totalVotes.toLocaleString()}<span className="text-[13px] ml-0.5">명</span></div>
              </div>
            </div>
          )}
        </section>

        {/* 법안 상세 정보 */}
        {bill && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-[#6D28D9]" />
              </div>
              <h2 className="text-[15px] font-bold text-slate-900">법안 상세 정보</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {/* 법안명 */}
              <div className="px-6 py-4">
                <p className="text-[14px] font-bold text-slate-900 leading-snug">
                  {getBillEmoji(bill.billName, bill.committee)} {bill.billName}
                </p>
              </div>

              {/* 심사 상태 */}
              <div className="px-6 py-4 flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-400">심사 상태</p>
                <span className={`px-3 py-1 text-[12px] font-bold rounded-full ${getStatusColor(bill.result)}`}>
                  {getStatusLabel(bill.result)}
                </span>
              </div>

              {/* 소관 위원회 */}
              {bill.committee && (
                <div className="px-6 py-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400">소관 위원회</p>
                  <p className="text-[13px] font-bold text-slate-700 text-right max-w-[60%]">{bill.committee}</p>
                </div>
              )}

              {/* 대표발의자 */}
              {bill.proposer && (
                <div className="px-6 py-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400">대표발의자</p>
                  <p className="text-[13px] font-bold text-slate-700 text-right">
                    {bill.proposer.split("(")[0].trim()}
                    {bill.coProposerCount > 0 && (
                      <span className="text-slate-400 font-medium"> 외 {bill.coProposerCount}인</span>
                    )}
                  </p>
                </div>
              )}

              {/* 발의일 */}
              {bill.proposeDate && (
                <div className="px-6 py-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400">발의일</p>
                  <p className="text-[13px] font-bold text-slate-700">{bill.proposeDate}</p>
                </div>
              )}

              {/* 뉴스 언급 수 */}
              {(bill.newsMentionCount ?? bill.mediaMentionCount ?? 0) > 0 && (
                <div className="px-6 py-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400">뉴스 언급</p>
                  <div className="flex items-center gap-2">
                    <Newspaper className="w-3.5 h-3.5 text-[#FB923C]" />
                    <span className="text-[13px] font-bold text-[#FB923C]">{bill.newsMentionCount ?? bill.mediaMentionCount}건의 뉴스에서 언급됨</span>
                  </div>
                </div>
              )}

              {/* 조회수 */}
              <div className="px-6 py-4 flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-400">조회수</p>
                <p className="text-[13px] font-bold text-slate-700">{(bill.viewCount ?? 0).toLocaleString()}회</p>
              </div>

              {/* 인기법안 선정 기준 안내 */}
              <div className="px-6 py-4 bg-indigo-50/40">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#6D28D9] mt-0.5 shrink-0" />
                  <p className="text-[11px] text-[#6D28D9] font-medium leading-relaxed">
                    이 법안은 <strong>뉴스 언급 빈도</strong>와 <strong>조회수·공동발의 수</strong>를 종합한 점수로 인기 법안에 선정되었습니다. 현재 국회에서 <strong>심사 중</strong>인 법안입니다.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}


        {/* 찬반 투표 카드 */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#6D28D9]" />
            </div>
            <h2 className="text-[16px] font-bold text-slate-900">시민 찬반 투표</h2>
            {totalVotes > 0 && (
              <span className="ml-auto text-[12px] font-bold text-slate-400">{totalVotes.toLocaleString()}명 참여</span>
            )}
          </div>

          {opinionLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              {/* 진행 바 */}
              <div className="mb-5">
                <div className="flex justify-between text-[12px] font-bold mb-2">
                  <span className="text-blue-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    찬성 {agreePercent}% ({(opinionData?.agree ?? 0).toLocaleString()}명)
                  </span>
                  <span className="text-red-500 flex items-center gap-1">
                    반대 {disagreePercent}% ({(opinionData?.disagree ?? 0).toLocaleString()}명)
                    <XCircle className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700 rounded-l-full"
                    style={{ width: `${agreePercent}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700 rounded-r-full"
                    style={{ width: `${disagreePercent}%` }}
                  />
                </div>
                {totalVotes === 0 && (
                  <p className="text-center text-[12px] text-slate-400 mt-2">아직 투표가 없습니다. 첫 번째로 투표하세요!</p>
                )}
              </div>

              {/* 투표 버튼 */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => voteMutation.mutate("agree")}
                  disabled={voteMutation.isPending}
                  className={`relative overflow-hidden rounded-2xl py-5 px-4 font-bold text-[16px] transition-all active:scale-95 flex flex-col items-center gap-2 ${
                    opinionData?.myOpinion === "agree"
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-blue-100"
                  }`}
                >
                  <ThumbsUp className={`w-7 h-7 ${opinionData?.myOpinion === "agree" ? "text-white" : "text-blue-500"}`} />
                  <span>찬성</span>
                  {opinionData?.myOpinion === "agree" && (
                    <span className="text-[11px] font-medium opacity-80">✓ 투표 완료</span>
                  )}
                  {voteMutation.isPending && <Loader2 className="absolute top-2 right-2 w-4 h-4 animate-spin opacity-50" />}
                </button>

                <button
                  onClick={() => voteMutation.mutate("disagree")}
                  disabled={voteMutation.isPending}
                  className={`relative overflow-hidden rounded-2xl py-5 px-4 font-bold text-[16px] transition-all active:scale-95 flex flex-col items-center gap-2 ${
                    opinionData?.myOpinion === "disagree"
                      ? "bg-red-500 text-white shadow-lg shadow-red-200"
                      : "bg-red-50 text-red-500 hover:bg-red-100 border-2 border-red-100"
                  }`}
                >
                  <ThumbsDown className={`w-7 h-7 ${opinionData?.myOpinion === "disagree" ? "text-white" : "text-red-400"}`} />
                  <span>반대</span>
                  {opinionData?.myOpinion === "disagree" && (
                    <span className="text-[11px] font-medium opacity-80">✓ 투표 완료</span>
                  )}
                  {voteMutation.isPending && <Loader2 className="absolute top-2 right-2 w-4 h-4 animate-spin opacity-50" />}
                </button>
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-4">
                {opinionData?.myOpinion ? "같은 버튼을 다시 누르면 투표가 취소됩니다." : "비회원도 투표 가능합니다. 다시 누르면 취소/변경됩니다."}
              </p>
            </>
          )}
        </section>

        {/* 댓글 토론 섹션 */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[#FB923C]" />
            </div>
            <h2 className="text-[16px] font-bold text-slate-900">시민 토론</h2>
            <span className="ml-auto text-[12px] font-bold text-slate-400">{comments.length}개의 댓글</span>
          </div>

          {/* 댓글 입력 — 로그인 사용자만 */}
          {user ? (
            <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!commentText.trim()) return;
                  commentMutation.mutate(commentText.trim());
                }}
              >
                <textarea
                  className="w-full bg-transparent resize-none text-[14px] text-slate-700 placeholder:text-slate-400 focus:outline-none min-h-[80px]"
                  placeholder="이 법안에 대한 의견을 자유롭게 작성해주세요..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  maxLength={500}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-slate-400">{commentText.length}/500</span>
                  <button
                    type="submit"
                    disabled={!commentText.trim() || commentMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-[#6D28D9] text-white rounded-xl text-[13px] font-bold hover:bg-[#5B21B6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {commentMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    등록
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <Link href="/login">
              <div className="bg-slate-50 rounded-xl p-5 mb-5 border border-dashed border-slate-200 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                <MessageSquare className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-[13px] font-medium text-slate-500">로그인 후 댓글을 남길 수 있습니다.</p>
                <p className="text-[11px] text-[#6D28D9] font-bold mt-1">로그인 / 회원가입 →</p>
              </div>
            </Link>
          )}

          {/* 댓글 목록 */}
          {commentsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-[13px] font-medium text-slate-400">아직 댓글이 없습니다.</p>
              <p className="text-[11px] text-slate-300 mt-1">이 법안에 대한 첫 번째 의견을 남겨보세요!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3 group">
                  {/* 아바타 */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shrink-0 text-[13px] font-bold text-[#6D28D9]">
                    {comment.displayName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-bold text-slate-700">{comment.displayName}</span>
                      {comment.authorType === "anonymous" && (
                        <span className="text-[10px] text-slate-400 font-medium">익명</span>
                      )}
                      {comment.isAuthor && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold">작성자</span>
                      )}
                      <span className="text-[11px] text-slate-400 ml-auto">{formatTime(String(comment.createdAt))}</span>
                    </div>
                    <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 국회 의원 표결 정보 (있을 때) */}
        {bill && (bill.yesCount > 0 || bill.noCount > 0) && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="text-[16px] font-bold text-slate-900">국회 표결 결과</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-[11px] font-bold text-blue-500 mb-1">찬성</div>
                <div className="text-[24px] font-extrabold text-blue-700">{bill.yesCount}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <div className="text-[11px] font-bold text-red-500 mb-1">반대</div>
                <div className="text-[24px] font-extrabold text-red-700">{bill.noCount}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-[11px] font-bold text-slate-500 mb-1">기권</div>
                <div className="text-[24px] font-extrabold text-slate-700">{bill.abstainCount}</div>
              </div>
            </div>
          </section>
        )}

        <div className="h-6" />
      </main>
    </div>
  );
}
