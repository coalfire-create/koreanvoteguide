import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, Search, BarChart3, ChevronRight } from "lucide-react";

const menuItems = [
  { icon: Users, title: "국회의원", description: "의원 프로필, 투표 기록, 활동 내역", href: "/members" },
  { icon: UserCheck, title: "후보자", description: "대통령·지방선거 후보자 비교", href: "/candidates" },
  { icon: Search, title: "법안 검색", description: "법안별 의원 투표 현황 조회", href: "/bills" },
  { icon: BarChart3, title: "객관적 평가", description: "데이터 기반 의원 평가", href: "/evaluation" },
];

export default function More() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-lg font-bold mb-4" data-testid="text-page-title-more">더보기</h1>
      <div className="space-y-2">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:bg-gray-50 transition-colors cursor-pointer" data-testid={`card-more-${item.href.replace("/", "")}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
