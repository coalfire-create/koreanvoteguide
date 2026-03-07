import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Search, Users, MapPin } from "lucide-react";
import { assemblyMembers, getPartyColor, getScoreColor, getScoreGrade } from "@/lib/mock-data";

export default function Members() {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = assemblyMembers.filter(
    (m) =>
      m.name.includes(searchQuery) ||
      m.party.includes(searchQuery) ||
      m.district.includes(searchQuery)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title-members">국회의원</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          국회의원의 활동 내역과 투표 기록을 확인하세요
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="이름, 정당, 지역구로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-member-search"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((member) => (
          <Link key={member.id} href={`/members/${member.id}`}>
            <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-member-${member.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold shrink-0">
                    {member.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg" data-testid={`text-member-name-${member.id}`}>{member.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-party-${member.id}`}>
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${getPartyColor(member.party)}`} />
                        {member.party}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{member.district}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-1 text-xs mb-1">
                      <span className="text-muted-foreground">출석률</span>
                      <span className="font-medium">{member.score.attendanceRate}%</span>
                    </div>
                    <Progress value={member.score.attendanceRate} className="h-1.5" />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t">
                    <div className="text-xs text-muted-foreground">
                      발의 {member.score.billProposalCount}건 · 참여율 {member.score.votingParticipationRate}%
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-lg font-bold ${getScoreColor(member.score.totalScore)}`} data-testid={`text-score-${member.id}`}>
                        {getScoreGrade(member.score.totalScore)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground" data-testid="text-no-results">검색 결과가 없습니다</p>
        </div>
      )}
    </div>
  );
}
