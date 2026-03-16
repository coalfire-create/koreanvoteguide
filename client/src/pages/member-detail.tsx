import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

  const dbVotesQuery = useQuery<{ billId: string; billName: string; voteResult: string; proposeDate: string | null }[]>({
    queryKey: ["/api/db/legislators", id, "voting-records"],
    queryFn: () => fetch(`/api/db/legislators/${id}/voting-records`).then((r) => r.json()),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const dbVotingRecords = (dbVotesQuery.data ?? []).map((r) => ({
    billId: r.billId,
    billName: r.billName ?? r.billId,
    vote: r.voteResult as "찬성" | "반대" | "불출석" | "미참석",
    date: r.proposeDate ?? "",
  }));

  const displayVotingRecords = dbVotingRecords.length > 0 ? dbVotingRecords : member.votingRecords;

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

  const billProposalScore = Math.min(100, member.score.billProposalCount * 5);

  const scoreFormula = `종합 점수 = (출석률 × 0.3) + (표결 참여율 × 0.4) + (법안 발의 점수 × 0.3)
법안 발의 점수 = 최솟값(100, 발의 법안 수 × 5)

출석률: ${member.score.attendanceRate}% × 0.3 = ${(member.score.attendanceRate * 0.3).toFixed(1)}점
표결 참여율: ${member.score.votingParticipationRate}% × 0.4 = ${(member.score.votingParticipationRate * 0.4).toFixed(1)}점
법안 발의 점수: 최솟값(100, ${member.score.billProposalCount} × 5) = ${billProposalScore}% × 0.3 = ${(billProposalScore * 0.3).toFixed(1)}점
종합: ${member.score.totalScore}점 (${getScoreGrade(member.score.totalScore)})`;

  const voteStats = displayVotingRecords.reduce(
    (acc, r) => {
      if (r.vote === "찬성") acc.agree++;
      else if (r.vote === "반대") acc.disagree++;
      else acc.other++;
      return acc;
    },
    { agree: 0, disagree: 0, other: 0 }
  );
  const totalVotes = displayVotingRecords.length;

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
            <div className={`text-4xl font-bold ${getScoreColor(member.score.totalScore)}`} data-testid="text-total-score">
              {getScoreGrade(member.score.totalScore)}
            </div>
            <p className={`text-lg font-semibold ${getScoreColor(member.score.totalScore)}`}>
              {member.score.totalScore}점
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card data-testid="card-attendance">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">출석률</p>
            <div className="flex items-end gap-2 mb-3">
              <span className={`text-2xl font-bold ${getAttendanceTextColor(member.score.attendanceRate)}`}>
                {member.score.attendanceRate}%
              </span>
              {member.score.attendanceRate >= 90 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] mb-1">우수</Badge>
              )}
              {member.score.attendanceRate <= 70 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px] mb-1">미흡</Badge>
              )}
            </div>
            <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${getAttendanceColor(member.score.attendanceRate)}`}
                style={{ width: `${member.score.attendanceRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-voting-participation">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">표결 참여율</p>
            <div className="flex items-end gap-2 mb-3">
              <span className={`text-2xl font-bold ${getAttendanceTextColor(member.score.votingParticipationRate)}`}>
                {member.score.votingParticipationRate}%
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${getAttendanceColor(member.score.votingParticipationRate)}`}
                style={{ width: `${member.score.votingParticipationRate}%` }}
              />
            </div>
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
                style={{ width: `${billProposalScore}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">발의 점수: {billProposalScore}/100</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6" data-testid="card-stance">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">이념 성향 분석</h3>
            {stanceQuery.data?.scoredBillCount != null && stanceQuery.data.scoredBillCount > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {stanceQuery.data.scoredBillCount}개 법안 기준
              </span>
            )}
          </div>
          {stanceQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !stanceQuery.data?.hasData ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              아직 분석된 법안 점수 데이터가 없습니다.<br />
              관리자가 법안 성향 점수를 입력하면 자동으로 계산됩니다.
            </p>
          ) : (
            <div className="space-y-5" data-testid="stance-bars">
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
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">평가 산출 공식</h3>
          </div>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded-md p-3" data-testid="text-score-formula">
            {scoreFormula}
          </pre>
        </CardContent>
      </Card>

      <Tabs defaultValue="votes" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="votes" data-testid="tab-votes">투표 기록</TabsTrigger>
          <TabsTrigger value="activities" data-testid="tab-activities">공개 활동</TabsTrigger>
        </TabsList>

        <TabsContent value="votes">
          {totalVotes > 0 && (
            <div className="flex items-center gap-3 mb-4 flex-wrap" data-testid="vote-stats-summary">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                찬성 {voteStats.agree}건
              </Badge>
              <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                반대 {voteStats.disagree}건
              </Badge>
              <Badge className="bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100">
                기권/불출석 {voteStats.other}건
              </Badge>
              <span className="text-xs text-muted-foreground">총 {totalVotes}건</span>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {displayVotingRecords.length > 0 ? (
                  <div className="divide-y">
                    {displayVotingRecords.map((record) => (
                      <div key={record.billId} className="flex items-center gap-3 px-4 py-3" data-testid={`row-vote-${record.billId}`}>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => setSelectedBill({ billId: record.billId, billName: record.billName, vote: record.vote })}
                            className="text-sm font-medium text-left hover:text-primary hover:underline underline-offset-2 transition-colors w-full"
                            data-testid={`button-bill-detail-${record.billId}`}
                          >
                            {record.billName}
                          </button>
                          <p className="text-xs text-muted-foreground mt-0.5">{record.date}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${getVoteBadgeVariant(record.vote).className}`}
                          data-testid={`badge-vote-${record.billId}`}
                        >
                          {record.vote}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    투표 기록이 없습니다
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
