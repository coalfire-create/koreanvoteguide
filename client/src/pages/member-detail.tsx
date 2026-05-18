import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, MapPin, Calendar, Mic, CalendarDays, Newspaper, Info, Loader2, TrendingUp, BarChart3, CheckCircle2, FileText, ExternalLink, Users, Share2, MessageSquare, MessageCircle, Send, Trophy, GraduationCap, Landmark, AlertTriangle, Briefcase, Globe, Mail, Phone, Building2, User, Sparkles, Zap, Target, ThumbsUp, Heart, HeartOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getPartyColor, getScoreColor, getScoreGrade } from "@/lib/mock-data";
import { useAssemblyMembers, useMemberDetail, useMemberAlumni, useLegislatorAnalysis } from "@/lib/api-data";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getBillEmoji } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { NewsAnalysisDialog } from "@/components/news-analysis-dialog";

// ─── 관련 뉴스 타입 ──────────────────────────────────────────────────────────
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

function formatNewsTime(pubDate: string): string {
  if (!pubDate) return "";
  try {
    const date = new Date(pubDate);
    if (isNaN(date.getTime())) return "";
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "방금";
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch {
    return "";
  }
}

// ─── 학력 정규화 ─────────────────────────────────────────────────────────────
// API가 학력을 문자열("서울대학교 …")로 주든, 배열(["…","…"])로 주든,
// null/"정보 없음"/공백이든 안전하게 표시용 라인 배열로 변환한다.
const EDU_EMPTY_TOKENS = new Set(["", "-", "정보 없음", "정보없음", "없음", "null", "undefined"]);

function normalizeEducation(edu: unknown): string[] {
  const collect = (v: unknown): string[] => {
    if (v == null) return [];
    if (Array.isArray(v)) return v.flatMap(collect);
    const s = String(v).trim();
    if (!s) return [];
    // 줄바꿈 / 세미콜론 / 가운뎃점이 아닌 일반 구분자로 멀티라인 분리
    return s
      .split(/\r?\n|；|;/g)
      .map((line) => line.trim())
      .filter(Boolean);
  };
  return collect(edu).filter(
    (line) => !EDU_EMPTY_TOKENS.has(line.toLowerCase()),
  );
}

interface StanceData {
  econScore: number;
  socialScore: number;
  envScore: number;
  welfareScore: number;
  justiceScore: number;
  scoredBillCount: number;
  hasData: boolean;
}

interface BillDetail {
  billId: string;
  billNo: string;
  billName: string;
  proposer: string;
  proposeDate: string;
  result: string;
  committee: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

function BillDetailSheet({
  billId,
  billName,
  memberVote,
  open,
  onClose,
}: {
  billId: string;
  billName: string;
  memberVote: string;
  open: boolean;
  onClose: () => void;
}) {
  const billQuery = useQuery<BillDetail>({
    queryKey: ["/api/db/bills", billId],
    queryFn: () => fetch(`/api/db/bills/${billId}`).then((r) => {
      if (!r.ok) throw new Error("not found");
      return r.json();
    }),
    enabled: open && !!billId && !billId.startsWith("b"),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const isMockBill = billId.startsWith("b");

  const resultColor = (result: string) => {
    if (result.includes("가결") || result.includes("통과")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (result.includes("부결") || result.includes("폐기")) return "bg-red-100 text-red-700 border-red-200";
    return "bg-amber-100 text-amber-700 border-amber-200";
  };

  const voteColor = (vote: string) => {
    if (vote === "찬성") return "bg-blue-100 text-blue-700";
    if (vote === "반대") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-500";
  };

  const totalVotes = billQuery.data
    ? billQuery.data.yesCount + billQuery.data.noCount + billQuery.data.abstainCount
    : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl px-0 pb-8">
        <SheetHeader className="px-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <SheetTitle className="text-base font-bold leading-snug text-left">
              {billName}
            </SheetTitle>
          </div>
          <div className={`inline-flex self-start items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${voteColor(memberVote)}`}>
            이 의원: {memberVote}
          </div>
        </SheetHeader>

        <Separator />

        <div className="px-5 pt-4">
          {isMockBill ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              샘플 데이터는 상세 정보가 없습니다.<br />
              실제 국회 데이터가 동기화되면 자동으로 표시됩니다.
            </p>
          ) : billQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : billQuery.isError || !billQuery.data ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              법안 상세 정보를 불러올 수 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">처리 결과</p>
                  <Badge variant="outline" className={`text-xs ${resultColor(billQuery.data.result)}`}>
                    {billQuery.data.result || "계류"}
                  </Badge>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">발의일</p>
                  <p className="text-sm font-medium">{billQuery.data.proposeDate || "—"}</p>
                </div>
              </div>

              {billQuery.data.committee && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">소관 위원회</p>
                  <p className="text-sm font-medium">{billQuery.data.committee}</p>
                </div>
              )}

              {billQuery.data.proposer && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">발의자</p>
                  <p className="text-sm font-medium leading-relaxed">{billQuery.data.proposer}</p>
                </div>
              )}

              {totalVotes > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground">표결 결과 (총 {totalVotes}명)</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-blue-700">{billQuery.data.yesCount}</p>
                      <p className="text-[10px] text-blue-500">찬성</p>
                    </div>
                    <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-red-700">{billQuery.data.noCount}</p>
                      <p className="text-[10px] text-red-500">반대</p>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-gray-500">{billQuery.data.abstainCount}</p>
                      <p className="text-[10px] text-gray-400">기권/불출석</p>
                    </div>
                  </div>
                  {totalVotes > 0 && (
                    <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden flex">
                      <div
                        className="bg-blue-400 h-full transition-all"
                        style={{ width: `${(billQuery.data.yesCount / totalVotes) * 100}%` }}
                      />
                      <div
                        className="bg-red-400 h-full transition-all"
                        style={{ width: `${(billQuery.data.noCount / totalVotes) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {billQuery.data.billId && (
                <a
                  href={`https://likms.assembly.go.kr/bill/billDetail.do?billId=${billQuery.data.billId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                  data-testid="link-bill-external"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  국회 원문 보기
                </a>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}


function getAttendanceColor(rate: number) {
  if (rate >= 90) return "bg-emerald-500";
  if (rate > 70) return "bg-yellow-500";
  return "bg-red-500";
}

function getAttendanceTextColor(rate: number) {
  if (rate >= 90) return "text-emerald-600";
  if (rate > 70) return "text-yellow-600";
  return "text-red-600";
}

function getVoteBadgeVariant(vote: string): { className: string } {
  switch (vote) {
    case "찬성":
      return { className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" };
    case "반대":
      return { className: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" };
    case "불출석":
    case "미참석":
    case "기권":
      return { className: "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100" };
    default:
      return { className: "" };
  }
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const { members, isLoading } = useAssemblyMembers();
  const member = members.find((m) => m.id === id);

  // 선관위 22대 총선 상세 데이터 (재산/학력/전과/경력)
  const { detail, isLoading: isDetailLoading } = useMemberDetail(id);
  const { analysis, isLoading: isAnalysisLoading } = useLegislatorAnalysis(id);
  const { alumni, university, isLoading: isAlumniLoading } = useMemberAlumni(id);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<{ title: string; url: string; source: string } | null>(null);

  const communityQuery = useQuery({
    queryKey: ["/api/community/posts", "member", id],
    queryFn: () => fetch(`/api/community/posts?legislatorId=${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  // ===== 팔로우 상태 =====
  const followsQuery = useQuery<{ follows: { id: string }[] }>({
    queryKey: ["/api/users/me/follows"],
    enabled: !!user,
    staleTime: 60 * 1000,
  });
  const isFollowing = !!followsQuery.data?.follows?.some((f) => f.id === id);

  const followMutation = useMutation({
    mutationFn: async (action: "follow" | "unfollow") => {
      const method = action === "follow" ? "POST" : "DELETE";
      const res = await apiRequest(method, `/api/users/me/follows/${id}`);
      return res.json();
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/follows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/feed"] });
      toast({
        title: action === "follow" ? "팔로우했습니다" : "언팔로우했습니다",
        description: action === "follow" ? "관심 의원 피드에서 활동을 확인하세요" : undefined,
      });
    },
    onError: () => {
      toast({ title: "오류", description: "처리 중 문제가 발생했습니다.", variant: "destructive" });
    },
  });

  const handleToggleFollow = () => {
    if (!user) {
      toast({ title: "로그인이 필요해요", description: "관심 의원을 팔로우하려면 로그인하세요.", variant: "destructive" });
      return;
    }
    followMutation.mutate(isFollowing ? "unfollow" : "follow");
  };

  const quickReactMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: "like" | "dislike" }) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/react`, { sentiment: type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", "member", id] });
    },
  });

  const postMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const res = await apiRequest("POST", "/api/community/posts", {
        title,
        content,
        boardType: "legislators", // Set specifically to legislators board
        category: "자유",
        legislatorId: id,
        tagType: "legislator",
        tagId: id,
        tagName: member?.name,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", "member", id] });
      setWriteTitle("");
      setWriteContent("");
      setIsWriteOpen(false);
      toast({ title: "작성 완료", description: "게시글이 등록되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "게시글 작성 중 오류가 발생했습니다.", variant: "destructive" });
    }
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/react`, { sentiment: "like" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", "member", id] });
    },
  });

  const handlePostShare = (post: any) => {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      navigator.share({ title: post.title, text: post.content, url });
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "링크 복사!", description: "게시글 링크가 클립보드에 복사되었습니다." });
    }
  };

  const handlePostSubmit = () => {
    if (!writeTitle.trim() || !writeContent.trim()) {
      toast({ title: "입력 오류", description: "제목과 내용을 모두 입력해주세요.", variant: "destructive" });
      return;
    }
    postMutation.mutate({ title: writeTitle, content: writeContent });
  };

  const stanceQuery = useQuery<StanceData>({
    queryKey: ["/api/db/legislators", id, "stance"],
    queryFn: () => fetch(`/api/db/legislators/${id}/stance`).then((r) => r.json()),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });

  // 관련 뉴스 — 의원 이름으로 RSS 뉴스 필터링
  const memberName = member?.name ?? "";
  const { data: newsData, isLoading: newsLoading } = useQuery<NewsResponse>({
    queryKey: ["/api/news", "member", memberName],
    queryFn: async () => {
      const res = await fetch(`/api/news`);
      if (!res.ok) return { items: [] };
      const data = await res.json();
      const filtered = (data.items || []).filter((item: NewsItem) =>
        item.title.includes(memberName)
      );
      return { items: filtered };
    },
    enabled: !!memberName,
    staleTime: 10 * 60 * 1000,
  });

  const [selectedBill, setSelectedBill] = useState<{ billId: string; billName: string; vote: string } | null>(null);
  const [voteFilter, setVoteFilter] = useState<"전체" | "찬성" | "반대" | "기권" | "불참">("전체");

  const voteHistoryQuery = useQuery<{
    monaCode: string;
    votes: { billId: string; billName: string; voteResult: string }[];
    total: number;
    source: string;
    prefetchTotal: number;
    prefetchDone: number;
    prefetchRunning: boolean;
  }>({
    queryKey: ["/api/legislators", id, "vote-history"],
    queryFn: () => fetch(`/api/legislators/${id}/vote-history`).then((r) => r.json()),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    refetchInterval: (query) => query.state.data?.prefetchRunning ? 30000 : false,
  });

  const proposedBillsQuery = useQuery<{
    monaCode: string;
    bills: any[];
    total: number;
    source: string;
  }>({
    queryKey: ["/api/legislators", id, "proposed-bills"],
    queryFn: () => fetch(`/api/legislators/${id}/proposed-bills`).then((r) => r.json()),
    enabled: !!id,
    staleTime: 60 * 60 * 1000,
  });

  // ── 프리미엄 AI 프로필 분석 ──────────────────────────────────
  interface AiOrientation { economy: number; government: number }
  interface AiInterest { field: string; percentage: number }
  interface AiCrucialBill { billName: string; reason: string }
  interface AiProfile {
    summary: string;
    orientation: AiOrientation;
    topInterests: AiInterest[];
    crucialBills: AiCrucialBill[];
  }

  const aiProfileQuery = useQuery<AiProfile>({
    queryKey: ["/api/members/analyze-profile", id],
    queryFn: () =>
      fetch(`/api/members/analyze-profile?monaCd=${id}`)
        .then(r => { if (!r.ok) throw new Error("분석 불가"); return r.json(); }),
    enabled: !!id,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const allVotes = voteHistoryQuery.data?.votes ?? [];
  const voteStats = {
    찬성: allVotes.filter(v => v.voteResult === "찬성").length,
    반대: allVotes.filter(v => v.voteResult === "반대").length,
    기권: allVotes.filter(v => v.voteResult === "기권").length,
    불참: allVotes.filter(v => v.voteResult === "불참" || v.voteResult === "불출석" || v.voteResult === "미참석").length,
  };
  const filteredVotes = voteFilter === "전체"
    ? allVotes
    : allVotes.filter(v => {
        if (voteFilter === "불참") return v.voteResult === "불참" || v.voteResult === "불출석" || v.voteResult === "미참석";
        return v.voteResult === voteFilter;
      });

  // 표결 기록에서 출석률/참여율 계산
  const totalVoteCount = allVotes.length;
  const presentCount = voteStats.찬성 + voteStats.반대 + voteStats.기권;
  const computedAttendanceRate = totalVoteCount > 0
    ? Math.round((presentCount / totalVoteCount) * 100)
    : member?.score.attendanceRate ?? 0;
  const displayAttendanceRate = voteHistoryQuery.data && totalVoteCount > 0
    ? computedAttendanceRate
    : member?.score.attendanceRate ?? 0;
  const computedBillScore = Math.min(100, (member?.score.billProposalCount ?? 0) * 5);
  const computedTotalScore = voteHistoryQuery.data && totalVoteCount > 0
    ? Math.round(displayAttendanceRate * 0.7 + computedBillScore * 0.3)
    : member?.score.totalScore ?? 0;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground mt-4">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">해당 의원을 찾을 수 없습니다</p>
        <Link href="/members">
          <Button variant="secondary" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            목록으로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  const activityIcon = (type: string) => {
    switch (type) {
      case "speech": return <Mic className="w-4 h-4 text-blue-500" />;
      case "event": return <CalendarDays className="w-4 h-4 text-emerald-500" />;
      case "press": return <Newspaper className="w-4 h-4 text-amber-500" />;
      default: return null;
    }
  };

  const activityLabel = (type: string) => {
    switch (type) {
      case "speech": return "발언";
      case "event": return "행사";
      case "press": return "보도자료";
      default: return "";
    }
  };

  const handleMemberShare = async () => {
    const shareData = {
      title: `${member.name} 의원 프로필 - 정치 성향 오각형 분석`,
      text: `${member.name} 의원(${member.party})의 분석 내용과 투표 기록을 확인하세요!`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("링크가 복사되었습니다.");
      }
    } catch (_e) {
      // 공유 취소 또는 미지원 환경
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <Link href="/members">
          <Button variant="ghost" size="sm" className="hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" />
            국회의원 목록으로
          </Button>
        </Link>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleToggleFollow}
            disabled={followMutation.isPending}
            className={`rounded-full font-bold px-5 shadow-sm transition-all ${
              isFollowing
                ? "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                : "bg-gradient-to-r from-[#6D28D9] to-indigo-500 text-white hover:shadow-md hover:from-[#5B21B6] hover:to-indigo-600"
            }`}
          >
            {followMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : isFollowing ? (
              <HeartOff className="w-4 h-4 mr-1.5" />
            ) : (
              <Heart className="w-4 h-4 mr-1.5" />
            )}
            {isFollowing ? "팔로잉" : "팔로우"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMemberShare}
            className="rounded-full shadow-sm hover:shadow-md hover:text-primary border-primary/20 bg-primary/5 transition-all text-primary font-bold px-4"
          >
            <Share2 className="w-4 h-4 mr-2" />
            공유하기
          </Button>
        </div>
      </div>

      <div className="relative mb-12">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="relative group">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden border-4 border-background shadow-xl ring-1 ring-primary/10 bg-gradient-to-br from-primary/5 to-primary/20">
              <PoliticianPhoto
                name={member.name}
                photo={member.photo}
                monaCd={member.id}
                context={member.party}
                avatarClassName="w-full h-full text-primary flex items-center justify-center text-4xl font-black"
              />
            </div>
            <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl ${getPartyColor(member.party)} border-4 border-background shadow-lg flex items-center justify-center`}>
               <div className="w-4 h-4 rounded-full bg-white/20" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left pt-2">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter" data-testid="text-member-detail-name">
                {member.name}
              </h1>
              <Badge variant="outline" className={`w-fit mx-auto md:mx-0 px-3 py-1 text-sm font-bold border-2 ${getPartyColor(member.party)} bg-white text-foreground shadow-sm`}>
                {member.party}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-y-2 gap-x-5 text-muted-foreground font-medium mb-4">
              <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <MapPin className="w-4 h-4 text-primary/60" />
                {member.district}
              </span>
              <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Calendar className="w-4 h-4 text-primary/60" />
                {member.electedYear}년 당선
              </span>
              <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <BarChart3 className="w-4 h-4 text-primary/60" />
                {member.committee}
              </span>
            </div>
          </div>


        </div>
      </div>
      
      {/* ===== 프리미엄 AI 프로필 분석 섹션 ===== */}
      <div className="mb-10">
        <Card className="border-none shadow-xl overflow-hidden bg-gradient-to-br from-[#6D28D9]/[0.04] via-background to-indigo-500/[0.02]">
          <div className="h-1 w-full bg-gradient-to-r from-[#6D28D9] via-indigo-400 to-purple-400" />
          <CardContent className="p-8">
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6D28D9] to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                  프리미엄 AI 프로필 분석
                  <Badge variant="outline" className="bg-[#6D28D9]/5 text-[#6D28D9] border-[#6D28D9]/20 text-[10px] py-0 px-2 font-bold h-5">
                    Groq · LLaMA3
                  </Badge>
                </h2>
                <p className="text-xs font-bold text-muted-foreground">실제 표결 기록을 Groq AI가 실시간 분석</p>
              </div>
            </div>

            {aiProfileQuery.isLoading && (
              <div className="space-y-5 py-2">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-[#6D28D9]" />
                  표결 기록을 AI가 분석하고 있습니다...
                </div>
                <Skeleton className="h-16 w-full rounded-2xl" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-28 rounded-2xl" />
                </div>
              </div>
            )}

            {aiProfileQuery.isError && (
              <div className="py-8 text-center text-sm text-muted-foreground space-y-2">
                <Info className="w-8 h-8 mx-auto text-muted-foreground/30" />
                <p>표결 데이터가 충분하지 않아 분석할 수 없습니다.</p>
              </div>
            )}

            {aiProfileQuery.data && (
              <div className="space-y-8">
                {/* AI 성향 요약 */}
                <div className="bg-white rounded-3xl p-5 border border-[#6D28D9]/10 shadow-sm">
                  <p className="text-[10px] font-black text-[#6D28D9] uppercase tracking-widest mb-2">AI 성향 요약</p>
                  <p className="text-[15px] font-bold text-gray-800 leading-relaxed">
                    "{aiProfileQuery.data.summary}"
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* 정치 성향 2축 */}
                  <div className="space-y-6">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> 정치 성향 2축
                    </p>

                    {/* 경제 성향 축 */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-blue-500">친노동 · 시장개입</span>
                        <span className="text-orange-500">친기업 · 규제완화</span>
                      </div>
                      <div className="relative h-4 bg-gradient-to-r from-blue-100 to-orange-100 rounded-full overflow-visible">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-[#6D28D9] rounded-full shadow-md transition-all duration-1000"
                          style={{ left: `calc(${(aiProfileQuery.data.orientation.economy / 10) * 100}% - 10px)` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground font-medium">
                        <span>0</span>
                        <span className="font-black text-[#6D28D9]">경제 성향: {aiProfileQuery.data.orientation.economy}/10</span>
                        <span>10</span>
                      </div>
                    </div>

                    {/* 정부 역할 축 */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-emerald-500">큰정부 · 복지확대</span>
                        <span className="text-red-400">작은정부 · 감세</span>
                      </div>
                      <div className="relative h-4 bg-gradient-to-r from-emerald-100 to-red-100 rounded-full overflow-visible">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-[#6D28D9] rounded-full shadow-md transition-all duration-1000"
                          style={{ left: `calc(${(aiProfileQuery.data.orientation.government / 10) * 100}% - 10px)` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground font-medium">
                        <span>0</span>
                        <span className="font-black text-[#6D28D9]">정부 역할: {aiProfileQuery.data.orientation.government}/10</span>
                        <span>10</span>
                      </div>
                    </div>
                  </div>

                  {/* 관심 분야 TOP 3 */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <BarChart3 className="w-3 h-3" /> 입법 관심 분야 TOP 3
                    </p>
                    <div className="space-y-3">
                      {aiProfileQuery.data.topInterests.map((item, idx) => (
                        <div key={item.field} className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                idx === 0
                                  ? "bg-[#6D28D9] text-white"
                                  : idx === 1
                                  ? "bg-[#6D28D9]/20 text-[#6D28D9]"
                                  : "bg-gray-100 text-gray-500"
                              }`}>
                                {idx + 1}위
                              </span>
                              <span className="text-[13px] font-bold text-gray-800">{item.field}</span>
                            </div>
                            <span className="text-[13px] font-black text-[#6D28D9]">{item.percentage}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                idx === 0 ? "bg-[#6D28D9]" : idx === 1 ? "bg-indigo-300" : "bg-gray-300"
                              }`}
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 결정적 법안 3선 */}
                <div className="pt-6 border-t border-dashed border-[#6D28D9]/10">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> 성향 파악 결정적 법안 TOP 3
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {aiProfileQuery.data.crucialBills.map((bill, idx) => (
                      <div
                        key={idx}
                        className="bg-gradient-to-br from-[#6D28D9]/[0.03] to-indigo-50/50 rounded-2xl p-4 border border-[#6D28D9]/10"
                      >
                        <div className={`text-[9px] font-black px-2 py-0.5 rounded-full w-fit mb-2 ${
                          idx === 0 ? "bg-[#6D28D9] text-white" : "bg-[#6D28D9]/10 text-[#6D28D9]"
                        }`}>
                          결정적 법안 {idx + 1}
                        </div>
                        <p className="text-[12px] font-bold text-gray-800 leading-snug mb-2 line-clamp-2">
                          {bill.billName}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{bill.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground text-center italic">
                  * Groq AI(LLaMA3-70B)가 실제 표결 기록을 기반으로 중립적으로 분석한 결과입니다
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== AI 의원 성향 분석 섹션 ===== */}
      <div className="mb-12">
        <Card className="border-none shadow-xl bg-gradient-to-br from-primary/[0.03] via-background to-primary/[0.01] overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                  AI 입법·표결 성향 분석
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] py-0 px-2 font-bold h-5">beta</Badge>
                </h2>
                <p className="text-xs font-bold text-muted-foreground">실제 법안 투표 기록을 분석한 정치적 정체성</p>
              </div>
            </div>

            {isAnalysisLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              </div>
            ) : analysis && analysis.meaningfulVotesCount > 0 ? (
              <div className="space-y-10">
                {/* 1. 요약 텍스트 */}
                <div className="bg-white rounded-3xl p-6 border border-primary/5 shadow-sm relative group">
                  <div className="absolute -top-3 -left-2 px-3 py-1 bg-primary text-white text-[10px] font-black rounded-lg shadow-md transform -rotate-2">
                    CHARACTER SUMMARY
                  </div>
                  <p className="text-lg font-bold leading-relaxed text-foreground/90">
                    "{analysis.summaryText}"
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* 2. 가치 지향성 (경제/정부) */}
                  <div className="space-y-8">
                    <h3 className="text-xs font-black text-muted-foreground tracking-widest uppercase flex items-center gap-2">
                      <Landmark className="w-3.5 h-3.5" /> 정치적 가치 지향성
                    </h3>
                    {analysis.valueAxes.map((axis) => (
                      <div key={axis.id} className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-black text-foreground">{axis.label}</span>
                          <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                            {axis.description}
                          </span>
                        </div>
                        <div className="relative pt-2">
                          {/* 축 배경 */}
                          <div className="h-1.5 w-full rounded-full bg-muted/40 relative">
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-muted-foreground/30 z-0" />
                          </div>
                          {/* 스코어 마커 */}
                          <div 
                            className="absolute top-0 transition-all duration-1000 ease-out"
                            style={{ left: `${((axis.score + 1) / 2) * 100}%` }}
                          >
                            <div className="w-4 h-4 -ml-2 rounded-full bg-primary border-4 border-white shadow-lg ring-4 ring-primary/10" />
                          </div>
                          {/* 라벨 */}
                          <div className="flex justify-between mt-3">
                            <div className="flex flex-col items-start">
                              <span className="text-[10px] font-bold text-muted-foreground leading-none">{axis.leftLabel}</span>
                              <span className="text-[9px] text-muted-foreground/60 mt-1">-1.0</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-muted-foreground leading-none">{axis.rightLabel}</span>
                              <span className="text-[9px] text-muted-foreground/60 mt-1">+1.0</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 3. 주요 관심 분야 (Top Categories) */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-muted-foreground tracking-widest uppercase flex items-center gap-2">
                      <Target className="w-3.5 h-3.5" /> 입법 집중 분야 (TOP 3)
                    </h3>
                    <div className="space-y-4">
                      {analysis.topCategories.map((cat, idx) => (
                        <div key={cat.category} className="group">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                              <span className="text-sm font-bold">{cat.category}</span>
                            </div>
                            <span className="text-xs font-black text-primary">{cat.percentage}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 delay-${idx * 200} ${idx === 0 ? 'bg-primary' : 'bg-primary/40'}`}
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            총 {cat.billCount}건의 관련 법안 표결에 참여했습니다.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. 분석에 영향을 준 주요 법안 */}
                <div className="pt-6 border-t border-dashed border-primary/10">
                  <h3 className="text-xs font-black text-muted-foreground tracking-widest uppercase mb-4 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> 분석 결정적 법안 (TOP 3)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {analysis.keyBills.map((bill) => (
                      <div 
                        key={bill.billId} 
                        className="bg-muted/20 hover:bg-muted/40 transition-colors p-4 rounded-2xl border border-muted/30 cursor-help group"
                        onClick={() => setSelectedBill({ billId: bill.billId, billName: bill.billName, vote: bill.vote })}
                      >
                        <Badge variant="outline" className="mb-2 bg-white text-[9px] font-bold py-0 h-4 border-muted">
                          {bill.category}
                        </Badge>
                        <h4 className="text-xs font-bold leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                          {bill.billName}
                        </h4>
                        <div className="flex justify-between items-center mt-auto">
                          <div className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            bill.vote === "찬성" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                          }`}>
                            {bill.vote}
                          </div>
                          <div className="text-[9px] font-bold text-muted-foreground">
                            영향력 {Math.round(bill.impactScore * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <Info className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-medium">분석을 위한 유효 표결 데이터가 부족합니다.</p>
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-primary/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
                <Loader2 className="w-3 h-3" />
                분석 데이터 업데이트: {analysis?.analyzedAt ? new Date(analysis.analyzedAt).toLocaleDateString() : '-'}
              </div>
              <p className="text-[9px] text-muted-foreground leading-relaxed max-w-md text-center md:text-right">
                ※ 위 분석은 국회 공공데이터의 법안 제목 및 위원회 정보를 기반으로 한 자동 알고리즘의 결과입니다. 
                의원의 실제 정치적 신념과 100% 일치하지 않을 수 있으니 참고용으로만 활용해 주시기 바랍니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="border-none shadow-sm bg-card hover:shadow-md transition-shadow overflow-hidden" data-testid="card-attendance">
          <div className={`h-1 w-full ${getAttendanceColor(displayAttendanceRate)} opacity-60`} />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="font-bold text-sm">본회의 출석률</h3>
              </div>
              {displayAttendanceRate >= 90 && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[10px] py-0 px-2 flex gap-1 items-center h-5">
                  <Trophy className="w-2.5 h-2.5" /> 우수
                </Badge>
              )}
            </div>
            
            <div className="flex items-end gap-1 mb-3">
              <span className={`text-2xl font-black tracking-tighter ${getAttendanceTextColor(displayAttendanceRate)}`}>
                {voteHistoryQuery.isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `${displayAttendanceRate}%`}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${getAttendanceColor(displayAttendanceRate)}`}
                  style={{ width: `${displayAttendanceRate}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                <span>활동 기준</span>
                <span>{presentCount}/{totalVoteCount}회 참석</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card hover:shadow-md transition-shadow overflow-hidden" data-testid="card-bill-proposals">
          <div className="h-1 w-full bg-primary/40" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="font-bold text-sm">대표 발의 법안</h3>
              </div>
            </div>
            
            <div className="flex items-end gap-1 mb-3">
              <span className="text-2xl font-black tracking-tighter text-foreground">
                {member.score.billProposalCount}
              </span>
              <span className="text-sm font-bold text-muted-foreground mb-0.5">건</span>
            </div>

            <div className="space-y-1.5">
              <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 bg-primary/60"
                  style={{ width: `${computedBillScore}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                <span>동료 의원 대비</span>
                <span>성과 점수 {computedBillScore}점</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info" className="mb-12">
        <TabsList className="w-full justify-start h-auto p-1.5 bg-muted/20 rounded-2xl mb-8 gap-2 overflow-x-auto flex-nowrap scrollbar-hide">
          <TabsTrigger
            value="info"
            className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary border-b-4 border-transparent font-bold transition-all duration-300 whitespace-nowrap shadow-sm hover:bg-muted/50"
            data-testid="tab-info"
          >
            기본 정보
          </TabsTrigger>
          <TabsTrigger 
            value="votes" 
            className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary border-b-4 border-transparent font-bold transition-all duration-300 whitespace-nowrap shadow-sm hover:bg-muted/50" 
            data-testid="tab-votes"
          >
            투표 기록
          </TabsTrigger>
          <TabsTrigger 
            value="proposed" 
            className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary border-b-4 border-transparent font-bold transition-all duration-300 whitespace-nowrap shadow-sm hover:bg-muted/50" 
            data-testid="tab-proposed"
          >
            발의 법안
          </TabsTrigger>
          <TabsTrigger
            value="activities"
            className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary border-b-4 border-transparent font-bold transition-all duration-300 whitespace-nowrap shadow-sm hover:bg-muted/50"
            data-testid="tab-activities"
          >
            공개 활동
          </TabsTrigger>
          <TabsTrigger
            value="news"
            className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary border-b-4 border-transparent font-bold transition-all duration-300 whitespace-nowrap shadow-sm hover:bg-muted/50"
            data-testid="tab-news"
          >
            관련 뉴스
          </TabsTrigger>
        </TabsList>

        {/* ===== 기본 정보 탭 (선관위 22대 총선 데이터) ===== */}
        <TabsContent value="info">
          <div className="space-y-4" data-testid="tab-content-info">
            {/* 재산 신고액 */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-emerald-400/60" />
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-base">재산 신고액</h3>
                  <span className="text-xs text-muted-foreground ml-1">(22대 총선 기준)</span>
                </div>
                {isDetailLoading ? (
                  <Skeleton className="h-7 w-48" />
                ) : (
                  <p className="text-2xl font-black tracking-tight text-emerald-700" data-testid="text-property">
                    {detail?.propertyAmount ?? "정보 없음"}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 최종 학력 */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-blue-400/60" />
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-base">최종 학력</h3>
                </div>
                {isDetailLoading ? (
                  <Skeleton className="h-5 w-64" />
                ) : (() => {
                  const eduLines = normalizeEducation(detail?.education);
                  if (eduLines.length === 0) {
                    return (
                      <div className="flex flex-wrap items-center gap-2" data-testid="text-education">
                        <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 font-medium">
                          학력 정보 미등록
                        </Badge>
                        {detail && !detail.necDetailSyncedAt && (
                          <span className="text-xs text-muted-foreground">· 선관위 데이터 동기화 전</span>
                        )}
                      </div>
                    );
                  }
                  if (eduLines.length === 1) {
                    return (
                      <p className="text-sm font-semibold text-foreground" data-testid="text-education">
                        {eduLines[0]}
                      </p>
                    );
                  }
                  return (
                    <ul className="space-y-1.5" data-testid="text-education">
                      {eduLines.map((line, i) => (
                        <li key={i} className="text-sm font-semibold text-foreground flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  );
                })()}

                {/* 동문 의원 섹션 */}
                {alumni && alumni.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-dashed border-blue-100">
                    <div className="flex items-center gap-1.5 mb-4">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <h4 className="text-xs font-bold text-blue-600">
                        {university ? `${university} 출신 의원` : "같은 대학교 출신 의원"}
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {alumni.map((person) => (
                        <Link key={person.monaCd} href={`/members/${person.monaCd}`}>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50/50 hover:bg-blue-50 border border-blue-100/50 transition-all cursor-pointer group">
                            {person.photoUrl ? (
                              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white shadow-sm shrink-0">
                                <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-blue-200 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {person.name.charAt(0)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-foreground group-hover:text-primary transition-colors">{person.name}</span>
                              <span className="text-[9px] font-bold text-muted-foreground">{person.party}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 전과 기록 */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className={`h-1 w-full ${
                isDetailLoading ? "bg-gray-200" :
                detail?.criminalCount ? "bg-red-400/60" : "bg-gray-300/60"
              }`} />
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                    !isDetailLoading && detail?.criminalCount
                      ? "bg-red-50 border-red-100"
                      : "bg-gray-50 border-gray-100"
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${
                      !isDetailLoading && detail?.criminalCount ? "text-red-500" : "text-gray-400"
                    }`} />
                  </div>
                  <h3 className="font-bold text-base">전과 기록</h3>
                </div>
                {isDetailLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : detail?.criminalCount ? (
                  <div data-testid="criminal-record">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold mb-2">
                      전과 {detail.criminalCount}건
                    </Badge>
                    {detail.criminalRecord && (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {detail.criminalRecord}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2" data-testid="no-criminal-record">
                    <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 font-medium">
                      전과 없음
                    </Badge>
                    {detail && !detail.necDetailSyncedAt && (
                      <span className="text-xs text-muted-foreground">· 선관위 데이터 동기화 전</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 주요 경력 */}
            {(isDetailLoading || (detail?.career && detail.career.trim())) && (
              <Card className="border-none shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-purple-400/60" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="font-bold text-base">주요 경력</h3>
                  </div>
                  {isDetailLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-4/6" />
                    </div>
                  ) : (
                    <ul className="space-y-1.5" data-testid="career-list">
                      {detail!.career!.split("\n").filter(Boolean).map((line, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                          {line.trim()}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 항목별 재산 내역 (공직자윤리위원회) */}
            {!isDetailLoading && detail && (detail.propertyLand !== null || detail.propertyBuilding !== null) && (
              <Card className="border-none shadow-sm overflow-hidden" data-testid="repa-property-detail">
                <div className="h-1 w-full bg-teal-400/60" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center">
                      <Landmark className="w-4 h-4 text-teal-600" />
                    </div>
                    <h3 className="font-bold text-base">항목별 재산 내역</h3>
                    <span className="text-xs text-muted-foreground ml-1">(공직자윤리위원회)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {detail.propertyLand !== null && (
                      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-border">
                        <span className="text-muted-foreground">토지</span>
                        <span className="font-semibold tabular-nums">{detail.propertyLand.toLocaleString()}만원</span>
                      </div>
                    )}
                    {detail.propertyBuilding !== null && (
                      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-border">
                        <span className="text-muted-foreground">건물</span>
                        <span className="font-semibold tabular-nums">{detail.propertyBuilding.toLocaleString()}만원</span>
                      </div>
                    )}
                    {detail.propertyDeposit !== null && (
                      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-border">
                        <span className="text-muted-foreground">예금</span>
                        <span className="font-semibold tabular-nums">{detail.propertyDeposit.toLocaleString()}만원</span>
                      </div>
                    )}
                    {detail.propertyStock !== null && (
                      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-border">
                        <span className="text-muted-foreground">유가증권</span>
                        <span className="font-semibold tabular-nums">{detail.propertyStock.toLocaleString()}만원</span>
                      </div>
                    )}
                    {detail.propertyDebt !== null && (
                      <div className="flex justify-between items-center py-1.5">
                        <span className="text-muted-foreground">채무</span>
                        <span className="font-semibold tabular-nums text-red-600">-{detail.propertyDebt.toLocaleString()}만원</span>
                      </div>
                    )}
                  </div>
                  {detail.propertyDetailSyncedAt && (
                    <p className="text-xs text-muted-foreground text-right mt-2">
                      {new Date(detail.propertyDetailSyncedAt).toLocaleDateString("ko-KR")} 동기화
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 기본 인적사항 */}
            {!isDetailLoading && detail && (detail.birthDate || detail.gender || detail.reelectionGbn || detail.assemblyAddr || detail.telNo) && (
              <Card className="border-none shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-orange-400/60" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-orange-600" />
                    </div>
                    <h3 className="font-bold text-base">기본 인적사항</h3>
                    <span className="text-xs text-muted-foreground ml-1">(국회 공공데이터)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                    {detail.birthDate && (
                      <div>
                        <span className="text-muted-foreground text-xs block mb-0.5">생년월일</span>
                        <span className="font-semibold">{detail.birthDate}</span>
                      </div>
                    )}
                    {detail.gender && (
                      <div>
                        <span className="text-muted-foreground text-xs block mb-0.5">성별</span>
                        <span className="font-semibold">{detail.gender}</span>
                      </div>
                    )}
                    {detail.reelectionGbn && (
                      <div>
                        <span className="text-muted-foreground text-xs block mb-0.5">선수</span>
                        <span className="font-semibold">{detail.reelectionGbn}</span>
                      </div>
                    )}
                    {detail.committees && detail.committees !== detail.committee && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-xs block mb-0.5">소속 위원회</span>
                        <span className="font-semibold">{detail.committees}</span>
                      </div>
                    )}
                    {detail.assemblyAddr && (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground text-xs">의원실</span>
                        <span className="font-semibold text-xs">{detail.assemblyAddr}</span>
                      </div>
                    )}
                    {detail.telNo && (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground text-xs">사무실</span>
                        <a href={`tel:${detail.telNo}`} className="font-semibold text-xs text-primary hover:underline">{detail.telNo}</a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* memTitle 경력 (NEC career가 없을 때 국회 API memTitle 표시) */}
            {!isDetailLoading && detail?.memTitle && !detail.career && (
              <Card className="border-none shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-purple-400/60" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="font-bold text-base">주요 경력</h3>
                    <span className="text-xs text-muted-foreground ml-1">(국회 공공데이터)</span>
                  </div>
                  <ul className="space-y-1.5">
                    {detail.memTitle.split("\n").filter(Boolean).map((line, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        {line.trim()}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* SNS / 연락처 */}
            {!isDetailLoading && detail && (detail.homepage || detail.email || detail.twitter || detail.facebook || detail.youtube || detail.blog || detail.instagram) && (
              <Card className="border-none shadow-sm overflow-hidden" data-testid="sns-links">
                <div className="h-1 w-full bg-indigo-400/60" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <ExternalLink className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-base">SNS / 연락처</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.homepage && (
                      <a
                        href={detail.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        홈페이지
                      </a>
                    )}
                    {detail.email && (
                      <a
                        href={`mailto:${detail.email}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        이메일
                      </a>
                    )}
                    {detail.twitter && (
                      <a
                        href={detail.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                      >
                        <span className="font-bold text-[11px]">𝕏</span>
                        Twitter
                      </a>
                    )}
                    {detail.facebook && (
                      <a
                        href={detail.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors"
                      >
                        <span className="font-bold text-[11px]">f</span>
                        Facebook
                      </a>
                    )}
                    {detail.youtube && (
                      <a
                        href={detail.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                      >
                        <span className="font-bold text-[11px]">▶</span>
                        YouTube
                      </a>
                    )}
                    {detail.blog && (
                      <a
                        href={detail.blog}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        블로그
                      </a>
                    )}
                    {(detail as any).instagram && (
                      <a
                        href={(detail as any).instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors"
                      >
                        <span className="font-bold text-[11px]">◉</span>
                        Instagram
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 데이터 출처 표기 */}
            {!isDetailLoading && detail?.necDetailSyncedAt && (
              <p className="text-xs text-muted-foreground text-right px-1" data-testid="nec-data-source">
                출처: 중앙선거관리위원회 22대 총선 후보자정보 ·
                {" "}{new Date(detail.necDetailSyncedAt).toLocaleDateString("ko-KR")} 동기화
              </p>
            )}
          </div>
        </TabsContent>



        <TabsContent value="votes">
          {voteHistoryQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">법안 표결 기록을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {voteHistoryQuery.data?.prefetchRunning && voteHistoryQuery.data.prefetchTotal > 0 && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-3" data-testid="prefetch-progress-bar">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-amber-800">표결 기록 수집 중</span>
                      <span className="text-xs text-amber-700 font-semibold">{voteHistoryQuery.data.prefetchDone}/{voteHistoryQuery.data.prefetchTotal}건</span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-amber-100 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-amber-500 transition-all"
                        style={{ width: `${Math.round((voteHistoryQuery.data.prefetchDone / voteHistoryQuery.data.prefetchTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              {allVotes.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap" data-testid="vote-stats-summary">
                  <button
                    onClick={() => setVoteFilter("전체")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${voteFilter === "전체" ? "bg-foreground text-background border-foreground" : "bg-background border-border text-muted-foreground hover:border-foreground"}`}
                    data-testid="filter-all"
                  >
                    전체 {allVotes.length}건
                  </button>
                  <button
                    onClick={() => setVoteFilter("찬성")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${voteFilter === "찬성" ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"}`}
                    data-testid="filter-agree"
                  >
                    찬성 {voteStats.찬성}건
                  </button>
                  <button
                    onClick={() => setVoteFilter("반대")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${voteFilter === "반대" ? "bg-red-600 text-white border-red-600" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"}`}
                    data-testid="filter-disagree"
                  >
                    반대 {voteStats.반대}건
                  </button>
                  <button
                    onClick={() => setVoteFilter("기권")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${voteFilter === "기권" ? "bg-amber-600 text-white border-amber-600" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"}`}
                    data-testid="filter-abstain"
                  >
                    기권 {voteStats.기권}건
                  </button>
                  <button
                    onClick={() => setVoteFilter("불참")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${voteFilter === "불참" ? "bg-gray-600 text-white border-gray-600" : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"}`}
                    data-testid="filter-absent"
                  >
                    불참 {voteStats.불참}건
                  </button>
                </div>
              )}
              <Card>
                <CardContent className="p-0">
                  {filteredVotes.length > 0 ? (
                    <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto custom-scrollbar">
                      {filteredVotes.map((record) => (
                        <div key={record.billId} className="group flex items-center gap-4 px-6 py-5 hover:bg-primary/[0.02] transition-colors" data-testid={`row-vote-${record.billId}`}>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => setSelectedBill({ billId: record.billId, billName: record.billName, vote: record.voteResult })}
                              className="text-base font-semibold text-left group-hover:text-primary transition-colors hover:underline underline-offset-4 decoration-2 decoration-primary/30 w-full truncate block"
                              data-testid={`button-bill-detail-${record.billId}`}
                            >
                              {getBillEmoji(record.billName)} {record.billName}
                            </button>
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 px-3 py-1 text-xs font-bold ${getVoteBadgeVariant(record.voteResult).className}`}
                            data-testid={`badge-vote-${record.billId}`}
                          >
                            {record.voteResult}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      {allVotes.length === 0 ? (
                        <div>
                          <p className="mb-1">표결 기록이 없습니다</p>
                          <p className="text-xs">법안 검색 탭에서 가결된 법안을 열람하면 표결 기록이 자동 수집됩니다</p>
                        </div>
                      ) : (
                        `${voteFilter} 결과의 법안이 없습니다`
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="proposed">
          {proposedBillsQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">발의 법안을 불러오는 중...</p>
            </div>
          ) : !proposedBillsQuery.data || !proposedBillsQuery.data.bills || proposedBillsQuery.data.bills.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              발의 법안 정보가 없습니다
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">총 <span className="font-bold text-foreground">{proposedBillsQuery.data.total}건</span>의 법안 발의</span>
              </div>
              <div className="space-y-3" data-testid="proposed-bills-list">
                {proposedBillsQuery.data.bills.map((bill: any, idx: number) => {
                  const billId = bill.BILL_ID || bill.BILL_NO || String(idx);
                  const billName = bill.BILL_NM || bill.BILL_NAME || "제목 없음";
                  const proposeDate = bill.PROPOSE_DT || bill.PROPOSE_DATE || "";
                  const committee = bill.COMMITTEE_NM || bill.COMMITTEE || "";
                  const procResult = bill.PROC_RESULT_CD || bill.PROC_RESULT || "";
                  const linkUrl = bill.LINK_URL || "";

                  const resultStyles =
                    procResult.includes("원안가결") || procResult.includes("수정가결")
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : procResult.includes("부결")
                      ? "bg-red-50 text-red-700 border-red-200"
                      : procResult.includes("폐기") || procResult.includes("철회")
                      ? "bg-gray-50 text-gray-500 border-gray-200"
                      : procResult.includes("계류") || procResult === ""
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-gray-50 text-gray-600 border-gray-200";
                  const resultLabel = procResult || "계류 중";

                  return (
                    <Card key={billId} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden" data-testid={`card-proposed-${idx}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-foreground leading-snug mb-3 group-hover:text-primary transition-colors">
                              {getBillEmoji(billName, committee)} {billName}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              {proposeDate && (
                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {proposeDate}
                                </span>
                              )}
                              {committee && (
                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <BarChart3 className="w-3 h-3" /> {committee}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3 shrink-0">
                            <Badge variant="outline" className={`text-[11px] font-bold px-3 py-0.5 rounded-full border-none shadow-none ${resultStyles}`}>
                              {resultLabel}
                            </Badge>
                            {linkUrl && (
                              <a
                                href={linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"
                                data-testid={`link-proposed-${idx}`}
                              >
                                국회 원문 <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="activities">
          {member.activities.length > 0 ? (
            <div className="space-y-3">
              {member.activities.map((activity) => (
                <Card key={activity.id} data-testid={`card-activity-${activity.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{activityIcon(activity.type)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-sm">{activity.title}</h4>
                          <Badge variant="secondary" className="text-[10px]">{activityLabel(activity.type)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">{activity.date}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              공개 활동 기록이 없습니다
            </div>
          )}
        </TabsContent>

        {/* ===== 관련 뉴스 탭 (RSS + AI 요약) ===== */}
        <TabsContent value="news">
          <div className="flex items-center gap-2 mb-4" data-testid="tab-content-news">
            <Newspaper className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">
              기사를 누르면 AI가 핵심 요약·배경·다양한 관점을 정리해 드립니다
            </p>
          </div>
          {newsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3 mb-3" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (newsData?.items ?? []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-3">
              <Newspaper className="w-8 h-8 text-muted-foreground/40" />
              <p>{member.name} 의원 관련 뉴스가 없습니다</p>
              <Link href="/news">
                <Button variant="ghost" size="sm" className="text-primary font-bold underline-offset-4 hover:underline">
                  전체 뉴스 보러 가기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
              {(newsData?.items ?? []).map((item, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedNews({ title: item.title, url: item.link, source: item.source })}
                  className="w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-accent/40 transition-colors group"
                  data-testid={`news-item-${i}`}
                >
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Newspaper className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{item.source}</Badge>
                      {item.pubDate && (
                        <span className="text-[11px] text-muted-foreground">{formatNewsTime(item.pubDate)}</span>
                      )}
                      <span className="text-[10px] font-bold text-primary/70 flex items-center gap-1 ml-auto">
                        <Sparkles className="w-3 h-3" /> AI 요약
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Separator className="my-10" />

      <div className="space-y-8 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">의원 커뮤니티</h2>
            </div>
            <p className="text-sm font-medium text-muted-foreground ml-10">의원의 활동에 대해 시민들과 자유롭게 의견을 나누세요</p>
          </div>
          <Badge variant="secondary" className="w-fit ml-10 md:ml-0 px-3 py-1 font-bold text-xs rounded-full bg-secondary/50">
            시민 코멘트 {Array.isArray(communityQuery.data) ? communityQuery.data.length : 0}개
          </Badge>
        </div>

        {/* 글쓰기 버튼 */}
        {!isWriteOpen ? (
          <button
            onClick={() => {
              setIsWriteOpen(true);
            }}
            className="w-full flex items-center gap-3 px-6 py-5 rounded-2xl border-2 border-dashed border-primary/20 text-muted-foreground hover:border-primary transition-all bg-card hover:bg-primary/5 group"
          >
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-base font-bold group-hover:text-primary transition-colors">
              {`${member?.name} 의원에 대해 시민으로서 한마디 남겨주세요...`}
            </span>
            <div className="ml-auto w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <ArrowLeft className="w-5 h-5 rotate-180" />
            </div>
          </button>
        ) : (
          <Card className="border-2 border-primary/20 shadow-lg rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="h-2 bg-primary" />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{member?.name} 의원 게시판</h3>
                  <p className="text-xs font-medium text-muted-foreground">시민들의 소중한 의견은 더 나은 정치를 만듭니다</p>
                </div>
                <button onClick={() => setIsWriteOpen(false)} className="ml-auto w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                   <span className="text-2xl leading-none text-muted-foreground">&times;</span>
                </button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="의견의 핵심 요약을 제목으로 적어주세요 (최대 50자)"
                  maxLength={50}
                  value={writeTitle}
                  onChange={(e) => setWriteTitle(e.target.value)}
                  className="w-full px-4 py-3 text-base font-bold border-none bg-muted/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <Textarea
                  placeholder="의원의 정책, 발언, 평판 등 구체적인 생각을 자유롭게 들려주세요."
                  value={writeContent}
                  onChange={(e) => setWriteContent(e.target.value)}
                  className="min-h-[150px] resize-none bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20 text-base p-4"
                  maxLength={1000}
                />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-bold text-muted-foreground">{writeContent.length} / 1000자</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsWriteOpen(false)} className="rounded-xl font-bold">취소</Button>
                    <Button
                      onClick={handlePostSubmit}
                      disabled={!writeTitle.trim() || !writeContent.trim() || postMutation.isPending}
                      className="rounded-xl px-8 font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      {postMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      의견 게시하기
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 글 목록 */}
        {communityQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : Array.isArray(communityQuery.data) && communityQuery.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {communityQuery.data.map((post: any) => (
              <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-none bg-card group">
                <CardContent className="p-0">
                  <div onClick={() => setSelectedPostId(post.id)} className="p-6 cursor-pointer group-hover:bg-primary/[0.01] transition-colors">
                    <h4 className="font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">{post.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                      {post.content.replace(/<[^>]*>/g, ' ')}
                    </p>
                    <div className="flex items-center gap-3 text-[12px] font-bold text-muted-foreground">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] text-primary">
                        {post.anonNickname.charAt(0)}
                      </div>
                      <span className="text-foreground/80">{post.anonNickname}</span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                      <span>{new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center px-4 py-3 border-t border-border/40 gap-1 bg-muted/5">
                    <button
                      onClick={() => {
                        if (!user) { toast({ title: "로그인 필요", variant: "destructive" }); return; }
                        likeMutation.mutate(post.id);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <ThumbsUp className="w-4 h-4" /> <span>{post.likes ?? 0}</span>
                    </button>
                    <button 
                      onClick={() => setSelectedPostId(post.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" /> <span>{post.commentCount ?? 0}</span>
                    </button>
                    <button
                      onClick={() => handlePostShare(post)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] font-bold text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-all ml-auto"
                    >
                      <Share2 className="w-3.5 h-3.5" /> 공유하기
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-14 bg-muted/20 border border-dashed border-muted-foreground/20 rounded-2xl">
            <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground mb-1">아직 등록된 게시글이 없습니다</p>
            <p className="text-xs text-muted-foreground/60">가장 먼저 {member?.name} 의원에 대한 글을 작성해보세요!</p>
          </div>
        )}
      </div>


      {selectedBill && (
        <BillDetailSheet
          billId={selectedBill.billId}
          billName={selectedBill.billName}
          memberVote={selectedBill.vote}
          open={!!selectedBill}
          onClose={() => setSelectedBill(null)}
        />
      )}

      <PostDetailDialog
        postId={selectedPostId}
        onOpenChange={(open) => { if (!open) setSelectedPostId(null); }}
      />

      <NewsAnalysisDialog
        isOpen={!!selectedNews}
        onOpenChange={(open) => { if (!open) setSelectedNews(null); }}
        news={selectedNews}
      />
    </div>
  );
}
