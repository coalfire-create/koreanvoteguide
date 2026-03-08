import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Search, BarChart3, ArrowRight, TrendingUp, Vote, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssemblyMembers } from "@/lib/api-data";
import { LastUpdated } from "@/components/last-updated";

const features = [
  {
    icon: Users,
    title: "국회의원 활동 추적",
    description: "투표 기록, 출석률, 발의 법안을 한눈에 확인하세요",
    link: "/members",
    color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  {
    icon: UserCheck,
    title: "후보자 비교",
    description: "대통령선거·지방선거 후보자들의 공약과 이력을 비교하세요",
    link: "/candidates",
    color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  {
    icon: Search,
    title: "법안 검색",
    description: "법안별 의원 투표 현황을 검색하고 확인하세요",
    link: "/bills",
    color: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  },
  {
    icon: BarChart3,
    title: "객관적 평가",
    description: "데이터 기반 의원 평가 점수와 산출 근거를 확인하세요",
    link: "/evaluation",
    color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  },
];

function TopMembersSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Home() {
  const { members, isLoading } = useAssemblyMembers();

  const topMembers = [...members]
    .sort((a, b) => b.score.totalScore - a.score.totalScore)
    .slice(0, 3);

  return (
    <div className="min-h-full">
      <div className="relative bg-primary py-16 px-6 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-blue-800 dark:to-blue-950" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
            <Vote className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm text-primary-foreground font-medium">데이터 기반 시민 투명성 플랫폼</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-4 leading-tight" data-testid="text-hero-title">
            이유있는 투표
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto leading-relaxed" data-testid="text-hero-subtitle">
            국회의원의 입법 활동과 투표 기록을 객관적으로 분석하여
            <br className="hidden md:block" />
            유권자의 합리적인 선택을 돕습니다
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/members">
              <Button size="lg" variant="secondary" data-testid="button-hero-members">
                <Users className="w-4 h-4 mr-2" />
                국회의원 보기
              </Button>
            </Link>
            <Link href="/evaluation">
              <Button size="lg" variant="outline" className="bg-white/10 text-primary-foreground border-white/20 backdrop-blur-sm" data-testid="button-hero-evaluation">
                <BarChart3 className="w-4 h-4 mr-2" />
                평가 확인하기
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex justify-end mb-4">
          <LastUpdated />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.link}>
              <Card className="group cursor-pointer hover-elevate h-full" data-testid={`card-feature-${feature.link.replace("/", "")}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-md ${feature.color}`}>
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-semibold">{feature.title}</h3>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">활동 우수 의원</h2>
          </div>
          {isLoading ? (
            <TopMembersSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topMembers.map((member, index) => (
                <Link key={member.id} href={`/members/${member.id}`}>
                  <Card className="hover-elevate cursor-pointer" data-testid={`card-top-member-${member.id}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.party} · {member.district}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Eye className="w-3.5 h-3.5" />
                          <span>출석률 {member.score.attendanceRate}%</span>
                        </div>
                        <div className="text-lg font-bold text-primary">{member.score.totalScore}점</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="text-center py-8 border-t">
          <p className="text-sm text-muted-foreground mb-1">
            이유있는 투표는 공개 데이터를 기반으로 정치인을 객관적으로 평가합니다
          </p>
          <p className="text-xs text-muted-foreground">
            모든 평가는 출석률, 법안 발의 수, 표결 참여율 등 공개 지표만을 사용합니다
          </p>
        </div>
      </div>
    </div>
  );
}
