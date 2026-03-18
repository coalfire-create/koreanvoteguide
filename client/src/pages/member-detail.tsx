import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, MapPin, Calendar, Mic, CalendarDays, Newspaper, Info, Loader2, TrendingUp, FileText, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getPartyColor, getScoreColor, getScoreGrade } from "@/lib/mock-data";
import { useAssemblyMembers } from "@/lib/api-data";
import { useQuery } from "@tanstack/react-query";

interface StanceData {
  econScore: number;
  socialScore: number;
  envScore: number;
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

interface SpectrumBarProps {
  score: number;
  leftLabel: string;
  rightLabel: string;
  color: "blue" | "purple" | "green";
  title: string;
  testId: string;
}

function SpectrumBar({ score, leftLabel, rightLabel, color, title, testId }: SpectrumBarProps) {
  const pct = ((score + 10) / 20) * 100;
  const centerPct = 50;

  const trackColor = color === "blue" ? "bg-blue-500" : color === "purple" ? "bg-purple-500" : "bg-green-500";
  const markerBorder = color === "blue" ? "border-blue-600" : color === "purple" ? "border-purple-600" : "border-green-600";
  const titleColor = color === "blue" ? "text-blue-700" : color === "purple" ? "text-purple-700" : "text-green-700";

  const fillLeft = Math.min(pct, centerPct);
  const fillWidth = Math.abs(pct - centerPct);

  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-semibold ${titleColor}`}>{title}</span>
        <span className="text-xs text-muted-foreground font-mono">
          {score > 0 ? "+" : ""}{score.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="relative h-3 rounded-full bg-gray-100 overflow-visible">
        <div
          className={`absolute inset-y-0 rounded-full transition-all duration-700 ease-out ${trackColor} opacity-70`}
          style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-gray-400 -translate-x-px z-10" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-md z-20 transition-all duration-700 ease-out ${markerBorder}`}
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
    </div>
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
  const activeVoteCount = voteStats.찬성 + voteStats.반대;
  const computedAttendanceRate = totalVoteCount > 0
    ? Math.round((presentCount / totalVoteCount) * 100)
    : member.score.attendanceRate;
  const computedVotingRate = totalVoteCount > 0
    ? Math.round((activeVoteCount / totalVoteCount) * 100)
    : member.score.votingParticipationRate;
  const displayAttendanceRate = voteHistoryQuery.data && totalVoteCount > 0
    ? computedAttendanceRate
    : member.score.attendanceRate;
  const displayVotingRate = voteHistoryQuery.data && totalVoteCount > 0
    ? computedVotingRate
    : member.score.votingParticipationRate;
  const computedBillScore = Math.min(100, member.score.billProposalCount * 5);
  const computedTotalScore = voteHistoryQuery.data && totalVoteCount > 0
    ? Math.round(displayAttendanceRate * 0.3 + displayVotingRate * 0.4 + computedBillScore * 0.3)
    : member.score.totalScore;

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/members">
        <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-to-members">
          <ArrowLeft className="w-4 h-4 mr-2" />
          국회의원 목록
        </Button>
      </Link>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-2xl font-bold shrink-0">
            {member.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold" data-testid="text-member-detail-name">{member.name}</h1>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <Badge variant="secondary">
                <span className={`w-2 h-2 rounded-full mr-1.5 ${getPartyColor(member.party)}`} />
                {member.party}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {member.district}
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {member.electedYear}년 당선
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">소속 위원회: {member.committee}</p>
          </div>
        </div>

        <Card className="shrink-0 md:w-56">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">종합 평가</p>
            <div className={`text-4xl font-bold ${getScoreColor(computedTotalScore)}`} data-testid="text-total-score">
              {getScoreGrade(computedTotalScore)}
            </div>
            <p className={`text-lg font-semibold ${getScoreColor(computedTotalScore)}`}>
              {computedTotalScore}점
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card data-testid="card-attendance">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">출석률</p>
            <div className="flex items-end gap-2 mb-3">
              <span className={`text-2xl font-bold ${getAttendanceTextColor(displayAttendanceRate)}`}>
                {voteHistoryQuery.isLoading ? "—" : `${displayAttendanceRate}%`}
              </span>
              {displayAttendanceRate >= 90 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] mb-1">우수</Badge>
              )}
              {displayAttendanceRate > 0 && displayAttendanceRate <= 70 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px] mb-1">미흡</Badge>
              )}
            </div>
            <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${getAttendanceColor(displayAttendanceRate)}`}
                style={{ width: `${displayAttendanceRate}%` }}
              />
            </div>
            {totalVoteCount > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">{presentCount}/{totalVoteCount}건 참석</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-voting-participation">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">표결 참여율</p>
            <div className="flex items-end gap-2 mb-3">
              <span className={`text-2xl font-bold ${getAttendanceTextColor(displayVotingRate)}`}>
                {voteHistoryQuery.isLoading ? "—" : `${displayVotingRate}%`}
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${getAttendanceColor(displayVotingRate)}`}
                style={{ width: `${displayVotingRate}%` }}
              />
            </div>
            {totalVoteCount > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">{activeVoteCount}/{totalVoteCount}건 찬/반 투표</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-bill-proposals">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">발의 법안</p>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-2xl font-bold">{member.score.billProposalCount}</span>
              <span className="text-sm text-muted-foreground mb-0.5">건</span>
            </div>
            <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all bg-primary"
                style={{ width: `${computedBillScore}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">발의 점수: {computedBillScore}/100</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6" data-testid="card-score-criteria">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-5">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">평가 기준</h3>
          </div>

          {/* 활동 지표 */}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">활동 지표</p>
          <div className="space-y-4 mb-6">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">출석률 <span className="text-muted-foreground font-normal">(30%)</span></span>
                <span className={`text-base font-bold ${getAttendanceTextColor(displayAttendanceRate)}`} data-testid="text-attendance-rate">
                  {voteHistoryQuery.isLoading ? "—" : `${displayAttendanceRate}%`}
                  {displayAttendanceRate >= 90 && <span className="ml-1.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">우수</span>}
                  {displayAttendanceRate > 0 && displayAttendanceRate <= 70 && <span className="ml-1.5 text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">미흡</span>}
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
                <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${getAttendanceColor(displayAttendanceRate)}`} style={{ width: `${displayAttendanceRate}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">표결 참여율 <span className="text-muted-foreground font-normal">(40%)</span></span>
                <span className={`text-base font-bold ${getAttendanceTextColor(displayVotingRate)}`} data-testid="text-voting-rate">
                  {voteHistoryQuery.isLoading ? "—" : `${displayVotingRate}%`}
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
                <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${getAttendanceColor(displayVotingRate)}`} style={{ width: `${displayVotingRate}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">법안 발의 <span className="text-muted-foreground font-normal">(30%)</span></span>
                <span className="text-base font-bold" data-testid="text-bill-count">{member.score.billProposalCount}건</span>
              </div>
              <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${computedBillScore}%` }} />
              </div>
            </div>
          </div>

          {/* 이념 성향 */}
          <div className="border-t pt-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">이념 성향</p>
              {stanceQuery.data?.scoredBillCount != null && stanceQuery.data.scoredBillCount > 0 && (
                <span className="text-[10px] text-muted-foreground ml-auto">{stanceQuery.data.scoredBillCount}개 법안 기준</span>
              )}
            </div>
            {stanceQuery.isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : !stanceQuery.data?.hasData ? (
              <p className="text-xs text-muted-foreground py-2">
                아직 분석된 법안 점수 데이터가 없습니다.
              </p>
            ) : (
              <div className="space-y-4" data-testid="stance-bars">
                <SpectrumBar
                  score={stanceQuery.data.econScore}
                  title="경제"
                  leftLabel="친기업/성장"
                  rightLabel="친노동/분배"
                  color="blue"
                  testId="spectrum-bar-econ"
                />
                <SpectrumBar
                  score={stanceQuery.data.socialScore}
                  title="사회"
                  leftLabel="보존/질서"
                  rightLabel="변화/인권"
                  color="purple"
                  testId="spectrum-bar-social"
                />
                <SpectrumBar
                  score={stanceQuery.data.envScore}
                  title="환경"
                  leftLabel="개발/성장"
                  rightLabel="환경 보존"
                  color="green"
                  testId="spectrum-bar-env"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="votes" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="votes" data-testid="tab-votes">투표 기록</TabsTrigger>
          <TabsTrigger value="activities" data-testid="tab-activities">공개 활동</TabsTrigger>
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
                    <div className="divide-y max-h-[60vh] overflow-y-auto">
                      {filteredVotes.map((record) => (
                        <div key={record.billId} className="flex items-center gap-3 px-4 py-3" data-testid={`row-vote-${record.billId}`}>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => setSelectedBill({ billId: record.billId, billName: record.billName, vote: record.voteResult })}
                              className="text-sm font-medium text-left hover:text-primary hover:underline underline-offset-2 transition-colors w-full truncate block"
                              data-testid={`button-bill-detail-${record.billId}`}
                            >
                              {record.billName}
                            </button>
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 ${getVoteBadgeVariant(record.voteResult).className}`}
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
