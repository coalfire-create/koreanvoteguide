import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Info, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { getScoreColor, getScoreGrade, getPartyColor } from "@/lib/mock-data";
import { useAssemblyMembers } from "@/lib/api-data";
import { LastUpdated } from "@/components/last-updated";

function EvaluationSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="w-6 h-6" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-10" />
        </div>
      ))}
    </div>
  );
}

export default function Evaluation() {
  const { members, isLoading } = useAssemblyMembers();
  const sorted = [...members].sort((a, b) => b.score.totalScore - a.score.totalScore);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-page-title-evaluation">객관적 평가</h1>
          </div>
          <LastUpdated />
        </div>
        <p className="text-muted-foreground text-sm">
          데이터에 기반한 국회의원 활동 평가 결과입니다. 모든 점수는 공개 지표만을 사용합니다.
        </p>
      </div>

      <Card className="mb-8">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="font-bold">평가 산출 방법</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-muted/50 dark:bg-muted/30 rounded-md p-4">
              <p className="text-xs text-muted-foreground mb-1">출석률 (70%)</p>
              <p className="font-semibold text-sm">본회의 및 위원회 출석 비율</p>
              <p className="text-xs text-muted-foreground mt-2">출석률 × 0.7 = 출석 점수</p>
            </div>
            <div className="bg-muted/50 dark:bg-muted/30 rounded-md p-4">
              <p className="text-xs text-muted-foreground mb-1">법안 발의 (30%)</p>
              <p className="font-semibold text-sm">발의한 법안 수 기반 점수</p>
              <p className="text-xs text-muted-foreground mt-2">최솟값(100, 발의 수 × 5) × 0.3 = 발의 점수</p>
            </div>
          </div>
          <div className="bg-primary/5 dark:bg-primary/10 rounded-md p-4">
            <p className="text-sm font-medium mb-1">종합 점수 계산</p>
            <code className="text-xs text-muted-foreground font-mono" data-testid="text-formula-total">
              종합 점수 = (출석률 × 0.7) + (최솟값(100, 발의 법안 수 × 5) × 0.3)
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              주관적 의견이나 감정적 평가는 포함되지 않습니다. 오직 공개 데이터 기반의 정량적 지표만 사용됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <EvaluationSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm">최고 평가 의원</h3>
                </div>
                {sorted.slice(0, 3).map((m, i) => (
                  <Link key={m.id} href={`/members/${m.id}`}>
                    <div className="flex items-center gap-3 py-2 hover-elevate rounded-md px-2 cursor-pointer" data-testid={`link-top-member-${m.id}`}>
                      <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.party}</p>
                      </div>
                      <span className={`text-lg font-bold ${getScoreColor(m.score.totalScore)}`}>
                        {m.score.totalScore}
                      </span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <h3 className="font-semibold text-sm">개선 필요 의원</h3>
                </div>
                {sorted.slice(-3).reverse().map((m, i) => (
                  <Link key={m.id} href={`/members/${m.id}`}>
                    <div className="flex items-center gap-3 py-2 hover-elevate rounded-md px-2 cursor-pointer" data-testid={`link-bottom-member-${m.id}`}>
                      <span className="text-sm font-bold text-muted-foreground w-5">{sorted.length - i}</span>
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.party}</p>
                      </div>
                      <span className={`text-lg font-bold ${getScoreColor(m.score.totalScore)}`}>
                        {m.score.totalScore}
                      </span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">순위</TableHead>
                      <TableHead>의원</TableHead>
                      <TableHead className="hidden md:table-cell">정당</TableHead>
                      <TableHead className="text-center">출석률</TableHead>
                      <TableHead className="text-center hidden sm:table-cell">발의</TableHead>
                      <TableHead className="text-center">등급</TableHead>
                      <TableHead className="text-center">점수</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((member, index) => (
                      <TableRow key={member.id} data-testid={`row-eval-${member.id}`}>
                        <TableCell className="text-center font-bold text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                              {member.name.charAt(0)}
                            </div>
                            <span className="font-medium text-sm">{member.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="flex items-center gap-1.5 text-sm">
                            <span className={`w-2 h-2 rounded-full ${getPartyColor(member.party)}`} />
                            {member.party}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-medium">{member.score.attendanceRate}%</span>
                            <Progress value={member.score.attendanceRate} className="h-1 w-16" />
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <span className="text-sm font-medium">{member.score.billProposalCount}건</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-lg font-bold ${getScoreColor(member.score.totalScore)}`}>
                            {getScoreGrade(member.score.totalScore)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-bold ${getScoreColor(member.score.totalScore)}`} data-testid={`text-eval-score-${member.id}`}>
                            {member.score.totalScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link href={`/members/${member.id}`}>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          본 평가는 공개된 국회 활동 데이터만을 기반으로 산출되며, 어떠한 주관적 판단도 포함하지 않습니다.
        </p>
      </div>
    </div>
  );
}
