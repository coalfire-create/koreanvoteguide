import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, MapPin, Calendar, Mic, CalendarDays, Newspaper, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPartyColor, getVoteBgColor, getScoreColor, getScoreGrade } from "@/lib/mock-data";
import { useAssemblyMembers } from "@/lib/api-data";

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const { members, isLoading } = useAssemblyMembers();
  const member = members.find((m) => m.id === id);

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
      case "speech": return <Mic className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
      case "event": return <CalendarDays className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
      case "press": return <Newspaper className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
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

  const scoreFormula = `종합 점수 = (출석률 × 0.3) + (표결 참여율 × 0.4) + (법안 발의 점수 × 0.3)
법안 발의 점수 = 최솟값(100, 발의 법안 수 × 5)

출석률: ${member.score.attendanceRate}% × 0.3 = ${(member.score.attendanceRate * 0.3).toFixed(1)}점
표결 참여율: ${member.score.votingParticipationRate}% × 0.4 = ${(member.score.votingParticipationRate * 0.4).toFixed(1)}점
법안 발의 점수: 최솟값(100, ${member.score.billProposalCount} × 5) = ${Math.min(100, member.score.billProposalCount * 5)}% × 0.3 = ${(Math.min(100, member.score.billProposalCount * 5) * 0.3).toFixed(1)}점
종합: ${member.score.totalScore}점 (${getScoreGrade(member.score.totalScore)})`;

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
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">출석률</p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold">{member.score.attendanceRate}%</span>
            </div>
            <Progress value={member.score.attendanceRate} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">표결 참여율</p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold">{member.score.votingParticipationRate}%</span>
            </div>
            <Progress value={member.score.votingParticipationRate} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">발의 법안</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold">{member.score.billProposalCount}</span>
              <span className="text-sm text-muted-foreground mb-0.5">건</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">평가 산출 공식</h3>
          </div>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 dark:bg-muted/30 rounded-md p-3" data-testid="text-score-formula">
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
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {member.votingRecords.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[250px]">법안명</TableHead>
                        <TableHead className="w-24 text-center">투표</TableHead>
                        <TableHead className="w-28 text-right">날짜</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {member.votingRecords.map((record) => (
                        <TableRow key={record.billId} data-testid={`row-vote-${record.billId}`}>
                          <TableCell className="font-medium">
                            <Link href={`/bills?q=${encodeURIComponent(record.billName.substring(0, 6))}`} className="hover:underline">
                              {record.billName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${getVoteBgColor(record.vote)}`}>
                              {record.vote}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{record.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
    </div>
  );
}
