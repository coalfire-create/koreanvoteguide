import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, TrendingUp, Crown, ExternalLink, Newspaper, ChevronRight } from "lucide-react";
import { useAssemblyMembers } from "@/lib/api-data";
import { Card, CardContent } from "@/components/ui/card";
import { getPartyColor, getScoreColor, getScoreGrade } from "@/lib/mock-data";
import { apiRequest } from "@/lib/queryClient";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

function formatRelativeTime(pubDate: string): string {
  if (!pubDate) return "";
  try {
    const date = new Date(pubDate);
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "방금 전";
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  } catch {
    return "";
  }
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const { members } = useAssemblyMembers();
  const [, navigate] = useLocation();

  const { data: trending = [] } = useQuery<{ memberId: string; name: string; count: number }[]>({
    queryKey: ["/api/members/trending"],
    refetchInterval: 30000,
  });

  const { data: news = [], isLoading: newsLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
    refetchInterval: 15 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });

  const filtered = query.trim().length > 0
    ? members.filter(
        (m) =>
          m.name.includes(query) ||
          m.party.includes(query) ||
          m.district.includes(query)
      )
    : [];

  const handleMemberClick = async (memberId: string, memberName: string) => {
    apiRequest("POST", `/api/members/${memberId}/click`, { name: memberName }).catch(() => {});
    navigate(`/members/${memberId}`);
  };

  const trendingWithDetails = trending
    .map((t) => {
      const member = members.find((m) => m.id === t.memberId);
      return member ? { ...t, member } : null;
    })
    .filter(Boolean) as { memberId: string; name: string; count: number; member: (typeof members)[0] }[];

  const topMember = trendingWithDetails[0] ?? null;
  const restTrending = trendingWithDetails.slice(1, 6);
  const isSearching = showResults && query.trim().length > 0;

  return (
    <div className="min-h-[calc(100vh-60px)] bg-gray-50 pb-6">
      {/* 상단 검색 영역 */}
      <div className="bg-white pt-10 pb-8 px-6 flex flex-col items-center shadow-sm">
        <div className="mb-7 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-md">
            <span className="text-primary-foreground font-bold text-2xl">투</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-0.5" data-testid="text-hero-title">
            이유있는 투표
          </h1>
          <p className="text-xs text-gray-400" data-testid="text-hero-subtitle">
            데이터 기반 시민 투명성 플랫폼
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            placeholder="국회의원 이름, 정당, 지역구 검색"
            className="w-full h-11 pl-10 pr-4 rounded-full shadow-sm border-gray-200 text-sm bg-white focus-visible:ring-primary"
            data-testid="input-search-home"
          />

          {/* 검색 드롭다운 */}
          {isSearching && (
            <div className="absolute top-12 left-0 right-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {filtered.length > 0 ? (
                <div className="py-1">
                  {filtered.slice(0, 8).map((member) => (
                    <button
                      key={member.id}
                      onMouseDown={() => handleMemberClick(member.id, member.name)}
                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      data-testid={`search-result-${member.id}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm">{member.name}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                            <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${getPartyColor(member.party)}`} />
                            {member.party}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{member.district}</p>
                      </div>
                      <div className={`text-sm font-bold shrink-0 ${getScoreColor(member.score.totalScore)}`}>
                        {getScoreGrade(member.score.totalScore)}
                      </div>
                    </button>
                  ))}
                  {filtered.length > 8 && (
                    <p className="text-xs text-center text-gray-400 py-2 border-t">
                      외 {filtered.length - 8}명 더 있음
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-5" data-testid="text-no-search-results">
                  검색 결과가 없습니다
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="px-4 mt-5 max-w-lg mx-auto space-y-5">

        {/* 실시간 1위 국회의원 */}
        <section data-testid="section-trending-top">
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">실시간 검색 1위</span>
          </div>

          {topMember ? (
            <button
              onClick={() => handleMemberClick(topMember.memberId, topMember.name)}
              className="w-full text-left"
              data-testid={`trending-top-${topMember.memberId}`}
            >
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* 왼쪽: 순위 + 왕관 */}
                    <div className="w-20 bg-primary flex flex-col items-center justify-center py-5 shrink-0">
                      <Crown className="w-6 h-6 text-yellow-300 mb-1" />
                      <span className="text-white text-2xl font-black">1</span>
                      <span className="text-primary-foreground/70 text-[10px] mt-0.5">위</span>
                    </div>

                    {/* 오른쪽: 의원 정보 */}
                    <div className="flex-1 px-4 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-gray-900">{topMember.member.name}</span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-2 py-0.5"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${getPartyColor(topMember.member.party)}`} />
                              {topMember.member.party}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{topMember.member.district}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>조회 <b className="text-gray-700">{topMember.count}</b>회</span>
                            {topMember.member.score && (
                              <span>
                                활동점수{" "}
                                <b className={getScoreColor(topMember.member.score.totalScore)}>
                                  {topMember.member.score.totalScore.toFixed(0)}점
                                </b>
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className={`text-2xl font-black shrink-0 ${getScoreColor(topMember.member.score.totalScore)}`}
                          data-testid={`grade-top-${topMember.memberId}`}
                        >
                          {getScoreGrade(topMember.member.score.totalScore)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ) : (
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="py-6 text-center text-sm text-gray-400">
                아직 검색 데이터가 없습니다. 국회의원을 검색해보세요!
              </CardContent>
            </Card>
          )}

          {/* 2~5위 */}
          {restTrending.length > 0 && (
            <div className="mt-2 bg-white rounded-2xl shadow-sm overflow-hidden">
              {restTrending.map((item, idx) => (
                <button
                  key={item.memberId}
                  onClick={() => handleMemberClick(item.memberId, item.name)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b last:border-0 border-gray-50"
                  data-testid={`trending-member-${item.memberId}`}
                >
                  <span className="text-xs font-bold text-gray-400 w-4 shrink-0">{idx + 2}</span>
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                    {item.member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800">{item.member.name}</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${getPartyColor(item.member.party)}`} />
                        {item.member.party}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{item.member.district}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{item.count}회</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 정치 뉴스 */}
        <section data-testid="section-news">
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <Newspaper className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">정치 뉴스</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {newsLoading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-4">
                    <Skeleton className="h-3.5 w-full mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : news.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {news.map((item, i) => (
                  <a
                    key={i}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group"
                    data-testid={`news-item-${i}`}
                  >
                    <span className="text-xs font-bold text-primary/50 w-4 shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-primary/70 font-medium">{item.source}</span>
                        {item.pubDate && (
                          <span className="text-[11px] text-gray-400">{formatRelativeTime(item.pubDate)}</span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-400">
                뉴스를 불러오는 중 오류가 발생했습니다
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
