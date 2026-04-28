import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, MapPin, Calendar, Mic, CalendarDays, Newspaper, Info, Loader2, TrendingUp, BarChart3, CheckCircle2, FileText, ExternalLink, Users, Share2, MessageSquare, MessageCircle, Send, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getPartyColor, getScoreColor, getScoreGrade } from "@/lib/mock-data";
import { useAssemblyMembers } from "@/lib/api-data";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

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

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  const communityQuery = useQuery({
    queryKey: ["/api/community/posts", "member", id],
    queryFn: () => fetch(`/api/community/posts?legislatorId=${id}`).then((r) => r.json()),
    enabled: !!id,
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
    } catch (e) {
      console.log("공유 취소됨 또는 오류", e);
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

      <div className="relative mb-12">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="relative group">
            {member.photo ? (
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden border-4 border-background shadow-xl ring-1 ring-primary/10">
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br from-primary/5 to-primary/20 text-primary flex items-center justify-center text-4xl font-black border-4 border-background shadow-xl ring-1 ring-primary/10">
                {member.name.charAt(0)}
              </div>
            )}
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

          <div className="hidden lg:block pt-4">
             <div className="bg-card border-none shadow-sm rounded-2xl px-6 py-4 text-center">
                <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-widest text-primary/60">종합 평가</p>
                <span className={`text-5xl font-black tracking-tighter ${getScoreColor(computedTotalScore)}`}>
                  {getScoreGrade(computedTotalScore)}
                </span>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Card className="border-none shadow-sm bg-card hover:shadow-md transition-shadow overflow-hidden" data-testid="card-attendance">
          <div className={`h-1 w-full ${getAttendanceColor(displayAttendanceRate)} opacity-60`} />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-base">본회의 출석률</h3>
              </div>
              {displayAttendanceRate >= 90 && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[10px] flex gap-1 items-center">
                  <Trophy className="w-3 h-3" /> 우수 의원
                </Badge>
              )}
            </div>
            
            <div className="flex items-end gap-2 mb-4">
              <span className={`text-4xl font-black tracking-tighter ${getAttendanceTextColor(displayAttendanceRate)}`}>
                {voteHistoryQuery.isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : `${displayAttendanceRate}%`}
              </span>
            </div>

            <div className="space-y-2">
              <div className="relative h-2.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${getAttendanceColor(displayAttendanceRate)}`}
                  style={{ width: `${displayAttendanceRate}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                <span>활동 기준</span>
                <span>{presentCount}/{totalVoteCount}회 참석</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card hover:shadow-md transition-shadow overflow-hidden" data-testid="card-bill-proposals">
          <div className="h-1 w-full bg-primary/40" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-base">대표 발의 법안</h3>
              </div>
            </div>
            
            <div className="flex items-end gap-2 mb-4">
              <span className="text-4xl font-black tracking-tighter text-foreground">
                {member.score.billProposalCount}
              </span>
              <span className="text-lg font-bold text-muted-foreground mb-1">건</span>
            </div>

            <div className="space-y-2">
              <div className="relative h-2.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 bg-primary/60"
                  style={{ width: `${computedBillScore}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                <span>동료 의원 대비</span>
                <span>성과 점수 {computedBillScore}점</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      

      <Tabs defaultValue="votes" className="mb-12">
        <TabsList className="w-full justify-start h-auto p-1.5 bg-muted/20 rounded-2xl mb-8 gap-2 overflow-x-auto flex-nowrap scrollbar-hide">
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
        </TabsList>



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
                              {record.billName}
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
                            <p className="text-base font-bold text-foreground leading-snug mb-3 group-hover:text-primary transition-colors">{billName}</p>
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
                  <Link href={`/post/${post.id}`}>
                    <div className="p-6 cursor-pointer group-hover:bg-primary/[0.01] transition-colors">
                      <h4 className="font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">{post.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 whitespace-pre-wrap mb-4">{post.content}</p>
                      <div className="flex items-center gap-3 text-[12px] font-bold text-muted-foreground">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] text-primary">
                          {post.anonNickname.charAt(0)}
                        </div>
                        <span className="text-foreground/80">{post.anonNickname}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <span>{new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center px-4 py-3 border-t border-border/40 gap-1 bg-muted/5">
                    <button
                      onClick={() => {
                        if (!user) { toast({ title: "로그인 필요", variant: "destructive" }); return; }
                        likeMutation.mutate(post.id);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      ❤️ <span>{post.likes ?? 0}</span>
                    </button>
                    <Link href={`/post/${post.id}`}>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                        <MessageCircle className="w-4 h-4" /> <span>{post.commentCount ?? 0}</span>
                      </button>
                    </Link>
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
    </div>
  );
}
