import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useAssemblyMembers } from "@/lib/api-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPartyColor, getScoreColor, getScoreGrade } from "@/lib/mock-data";

export default function Home() {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const { members } = useAssemblyMembers();
  const [, navigate] = useLocation();

  const filtered = query.trim().length > 0
    ? members.filter(
        (m) =>
          m.name.includes(query) ||
          m.party.includes(query) ||
          m.district.includes(query)
      )
    : [];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] bg-white px-6">
      <div className="w-full max-w-lg mx-auto text-center">
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-5">
            <span className="text-primary-foreground font-bold text-2xl">투</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1" data-testid="text-hero-title">
            이유있는 투표
          </h1>
          <p className="text-sm text-gray-400" data-testid="text-hero-subtitle">
            데이터 기반 시민 투명성 플랫폼
          </p>
        </div>

        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="내 지역구 국회의원 이름이나 동네를 검색해 보세요"
            className="w-full h-12 pl-12 pr-4 rounded-full shadow-md border-gray-200 text-sm bg-white focus-visible:ring-primary"
            data-testid="input-search-home"
          />
        </div>

        {showResults && query.trim().length > 0 && (
          <div className="mt-3 w-full text-left">
            {filtered.length > 0 ? (
              <Card className="shadow-lg">
                <CardContent className="p-2">
                  {filtered.slice(0, 8).map((member) => (
                    <button
                      key={member.id}
                      onClick={() => navigate(`/members/${member.id}`)}
                      className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      data-testid={`search-result-${member.id}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{member.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <span className={`w-1.5 h-1.5 rounded-full mr-1 ${getPartyColor(member.party)}`} />
                            {member.party}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{member.district}</p>
                      </div>
                      <div className={`text-sm font-bold ${getScoreColor(member.score.totalScore)}`}>
                        {getScoreGrade(member.score.totalScore)}
                      </div>
                    </button>
                  ))}
                  {filtered.length > 8 && (
                    <p className="text-xs text-center text-gray-400 py-2">
                      외 {filtered.length - 8}명
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4" data-testid="text-no-search-results">
                검색 결과가 없습니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
