import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Search, Users, MapPin, FileText, CheckCircle2, Star, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LastUpdated } from "@/components/last-updated";
import { FavoriteMiniCard } from "@/components/FavoriteMiniCard";
import { Flame, Newspaper } from "lucide-react";
import { useMemo } from "react";
import { useAssemblyMembers } from "@/lib/api-data";
import { useFavorites } from "@/lib/useFavorites";
import { getPartyColor, getScoreColor, getScoreGrade } from "@/lib/mock-data";

// ─── 뉴스 타입 ──────────────────────────────────────────────────────────────
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}
interface NewsResponse {
  items: NewsItem[];
}

function formatTime(pubDate: string): string {
  if (!pubDate) return "";
  try {
    const date = new Date(pubDate);
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "방금";
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch {
    return "";
  }
}

function MembersSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Card key={i} className="border-border/50 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="h-1.5 bg-muted/20" />
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <Skeleton className="w-16 h-16 rounded-full shrink-0" />
                <div className="space-y-2 flex-1 pt-1">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-5 w-8" />
                  </div>
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full" />
                <div className="flex justify-between items-center pt-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Members() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParty, setSelectedParty] = useState("전체");
  const [selectedRegion, setSelectedRegion] = useState("전체");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFavorite, setSelectedFavorite] = useState<{ id: string; type: "member" | "candidate" } | null>(null);

  const { members, isLoading } = useAssemblyMembers();
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();

  // 의원 데이터에 존재하는 정당 목록 추출 (기본 '전체' 포함)
  const parties = ["전체", ...Array.from(new Set(members.map(m => m.party)))];
  // 주요 지역구 목록
  const regions = ["전체", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "비례"];

  const filtered = members.filter(
    (m) =>
      (m.name.includes(searchQuery) ||
       m.party.includes(searchQuery) ||
       m.district.includes(searchQuery)) &&
      (selectedParty === "전체" || m.party === selectedParty) &&
      (selectedRegion === "전체" || m.district.startsWith(selectedRegion))
  );

  const { data: trending = [] } = useQuery<{ memberId: string; name: string; count: number }[]>({
    queryKey: ["/api/members/trending"],
    refetchInterval: 30000,
  });

  const { data: newsData } = useQuery<NewsResponse>({
    queryKey: ["/api/news", "member"],
    queryFn: async () => {
      const res = await fetch(`/api/news?category=member`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
  });

  const trendingWithDetails = trending
    .map((t) => {
      const member = members.find((m) => m.id === t.memberId);
      return member ? { ...t, member } : null;
    })
    .filter(Boolean) as any[];
  const topTrending = trendingWithDetails.slice(0, 5);

  const { data: billsData } = useQuery({
    queryKey: ["/api/bills"],
    queryFn: async () => {
      const res = await fetch(`/api/bills`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  const recentProposers = useMemo(() => {
    const list: { member: typeof members[0], billName: string, summary: string }[] = [];
    for (const bill of (billsData?.data || [])) {
      if (!bill.proposer) continue;
      const member = members.find(m => bill.proposer.includes(m.name));
      if (member && !list.some(l => l.member.id === member.id)) {
        list.push({ member, billName: bill.billName, summary: bill.summary || "" });
        if (list.length >= 5) break;
      }
    }
    return list;
  }, [billsData?.data, members]);

  // ── 공통 필터 컨트롤 (지역/정당 필터는 UI에서 제거, 검색창만 유지) ──
  const FilterControls = (
    <div className="relative group w-full max-w-xl mx-auto">
      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <Input
        type="search"
        placeholder="국회의원 이름으로 검색..."
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setHasSearched(true); }}
        className="pl-14 pr-5 py-3 text-base rounded-2xl border border-gray-200 shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all w-full bg-white h-[50px]"
        data-testid="input-member-search"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* ── 검색 전: 중앙 레이아웃 ── */}
      {!hasSearched && (
        <div className="flex flex-col items-center justify-center min-h-[55vh] gap-6 px-6 mt-10">

          {/* 핫한 국회의원 & 관련 뉴스 & 최근 발의 */}
          <div className="w-full max-w-xl flex flex-col gap-6 w-full mt-2">
            {/* 최근 대표발의한 국회의원 */}
            {recentProposers.length > 0 && (
              <div className="w-full">
                <h2 className="font-bold text-sm text-gray-800 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    최근 대표발의한 국회의원 <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full ml-1">매일 업데이트</span>
                  </span>
                </h2>
                <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                  {recentProposers.map(({ member, billName, summary }) => (
                    <Link key={member.id} href={`/members/${member.id}`}>
                      <div className="shrink-0 flex flex-col gap-2 bg-white border border-gray-100 shadow-sm rounded-xl py-3 px-4 hover:border-emerald-200 transition-colors cursor-pointer min-w-[220px] max-w-[260px]">
                        {/* 의원 정보 */}
                        <div className="flex items-center gap-2">
                          {member.photo ? (
                            <img src={member.photo} alt={member.name} className="w-8 h-8 rounded-full object-cover border border-gray-100" />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${getPartyColor(member.party)}`}>
                              {member.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-800">{member.name}</span>
                            <span className="text-[10px] text-gray-400 font-medium truncate">{member.party}</span>
                          </div>
                        </div>
                        {/* 법안 이름 */}
                        <div className="bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-100">
                          <p className="text-[11px] font-bold text-emerald-700 line-clamp-2 leading-tight">{billName}</p>
                        </div>
                        {/* 법안 요약 */}
                        {summary && (
                          <p className="text-[10px] text-gray-500 line-clamp-3 leading-relaxed">
                            {summary}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* 핫한 국회의원 */}
            {topTrending.length > 0 && (
              <div className="w-full">
                <h2 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  실시간 핫한 국회의원
                </h2>
                <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                  {topTrending.map((item, idx) => (
                    <Link key={item.memberId} href={`/members/${item.memberId}`}>
                      <div className="shrink-0 flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-xl py-2 px-3 hover:border-indigo-200 transition-colors cursor-pointer">
                        <span className="font-black text-red-500 text-xs">{idx + 1}</span>
                        {item.member.photo ? (
                          <img src={item.member.photo} alt={item.member.name} className="w-6 h-6 rounded-full object-cover border border-gray-100" />
                        ) : (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${getPartyColor(item.member.party)}`}>
                            {item.member.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-bold text-gray-800">{item.member.name}</span>
                        <span className="text-[10px] text-gray-400 font-medium ml-1 flex items-center gap-0.5">
                          조회 {item.count}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 관련 뉴스 */}
            {newsData && newsData.items && newsData.items.length > 0 && (
              <div className="w-full">
                <h2 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
                  <Newspaper className="w-4 h-4 text-blue-500" />
                  국회의원 관련 주요 뉴스
                </h2>
                <div className="flex flex-col gap-2">
                  {newsData.items.slice(0, 3).map((news: any, idx: number) => (
                    <a key={idx} href={news.link} target="_blank" rel="noopener noreferrer" className="block bg-white border border-gray-100 shadow-sm rounded-xl p-3 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
                      <h3 className="text-sm font-bold text-gray-900 line-clamp-1 mb-1" dangerouslySetInnerHTML={{ __html: news.title }} />
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span dangerouslySetInnerHTML={{ __html: news.source || "뉴스" }} />
                        <span>{formatTime(news.pubDate)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 검색창 */}
          <div className="w-full max-w-xl mt-2">
            {FilterControls}
          </div>

          {/* 관심 인물 섭션 - 핵심 정보 바로 표시 */}
          {favorites.length > 0 && (
            <div className="w-full max-w-xl" data-testid="section-favorites">
              <h2 className="font-semibold text-sm text-gray-500 mb-3">⭐ 관심 인물</h2>
              <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                {favorites.map((fav) => {
                  const memberData = fav.type === "member" ? members.find(m => m.id === fav.id) : null;
                  return (
                    <div key={fav.id} className="relative shrink-0" data-testid={`favorite-card-${fav.id}`}>
                      {/* ✕ 즐겨찾기 취소 버튼 */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFavorite(fav.id); }}
                        className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors"
                        aria-label={`${fav.name} 관심 취소`}
                        data-testid={`btn-remove-favorite-${fav.id}`}
                      >
                        <X className="w-2.5 h-2.5 text-gray-400 hover:text-red-400" />
                      </button>
                      <Link href={fav.type === "member" ? `/members/${fav.id}` : `/candidates/${fav.id}`}>
                        <div className="w-[150px] bg-white border border-gray-100 rounded-2xl shadow-sm p-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                          {/* 프로필 + 이름 */}
                          <div className="flex items-center gap-2.5 mb-3">
                            {fav.imageUrl ? (
                              <img src={fav.imageUrl} alt={fav.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-sm font-bold text-purple-400 shrink-0">
                                {fav.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{fav.name}</p>
                              {memberData && (
                                <p className="text-[10px] text-gray-400 truncate">{memberData.district}</p>
                              )}
                            </div>
                          </div>

                          {/* 핵심 정보 */}
                          {memberData ? (
                            <div className="space-y-2">
                              <div>
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span className="text-gray-400">출석률</span>
                                  <span className="font-semibold text-gray-700">{memberData.score.attendanceRate}%</span>
                                </div>
                                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-purple-400 rounded-full" style={{ width: `${memberData.score.attendanceRate}%` }} />
                                </div>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-400">발의법안</span>
                                <span className="font-semibold text-gray-700">{memberData.score.billProposalCount}건</span>
                              </div>
                              <div className="flex justify-between text-[10px] items-center">
                                <span className="text-gray-400">종합평가</span>
                                <span className="font-black text-xs text-purple-600">{getScoreGrade(memberData.score.totalScore)}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-gray-400">{fav.type === "candidate" ? "대선 후보" : "데이터 로딩 중..."}</p>
                          )}
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 힌트 텍스트 */}
          <p className="text-gray-300 text-xs">
            이름으로 검색하면 결과가 표시됩니다
          </p>
        </div>
      )}

      {/* ── 검색 후: sticky 필터 바 + 카드 그리드 ── */}
      {hasSearched && (
        <div className="max-w-6xl mx-auto px-6 pt-8">
          {/* sticky 필터 바 */}
          <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-border/40 py-4 mb-8 -mx-6 px-6">
            <div className="max-w-6xl mx-auto flex items-center justify-center">
              {FilterControls}
            </div>
          </div>

          {/* 관심 인물 섹션 - 핵심 정보 바로 표시 */}
          {favorites.length > 0 && (
            <div className="mb-6" data-testid="section-favorites">
              <h2 className="font-semibold text-sm text-gray-500 mb-3">⭐ 관심 인물</h2>
              <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                {favorites.map((fav) => {
                  const memberData = fav.type === "member" ? members.find(m => m.id === fav.id) : null;
                  return (
                    <div key={fav.id} className="relative shrink-0" data-testid={`favorite-card-${fav.id}`}>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFavorite(fav.id); }}
                        className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors"
                        aria-label={`${fav.name} 관심 취소`}
                        data-testid={`btn-remove-favorite-${fav.id}`}
                      >
                        <X className="w-2.5 h-2.5 text-gray-400" />
                      </button>
                      <Link href={fav.type === "member" ? `/members/${fav.id}` : `/candidates/${fav.id}`}>
                        <div className="w-[150px] bg-white border border-gray-100 rounded-2xl shadow-sm p-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                          <div className="flex items-center gap-2.5 mb-3">
                            {fav.imageUrl ? (
                              <img src={fav.imageUrl} alt={fav.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-sm font-bold text-purple-400 shrink-0">
                                {fav.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{fav.name}</p>
                              {memberData && (
                                <p className="text-[10px] text-gray-400 truncate">{memberData.district}</p>
                              )}
                            </div>
                          </div>
                          {memberData ? (
                            <div className="space-y-2">
                              <div>
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span className="text-gray-400">출석률</span>
                                  <span className="font-semibold text-gray-700">{memberData.score.attendanceRate}%</span>
                                </div>
                                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-purple-400 rounded-full" style={{ width: `${memberData.score.attendanceRate}%` }} />
                                </div>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-400">발의법안</span>
                                <span className="font-semibold text-gray-700">{memberData.score.billProposalCount}건</span>
                              </div>
                              <div className="flex justify-between text-[10px] items-center">
                                <span className="text-gray-400">종합평가</span>
                                <span className="font-black text-xs text-purple-600">{getScoreGrade(memberData.score.totalScore)}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-gray-400">{fav.type === "candidate" ? "대선 후보" : "데이터 로딩 중..."}</p>
                          )}
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 카드 그리드 */}
          {isLoading ? (
            <MembersSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filtered.map((member) => (
                <Link key={member.id} href={`/members/${member.id}`}>
                  <Card
                    className="group overflow-hidden cursor-pointer h-full border-border/40 shadow-sm bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/20"
                    data-testid={`card-member-${member.id}`}
                  >
                    <div className={`h-1.5 w-full ${getPartyColor(member.party)} opacity-90`} />
                    <CardContent className="p-6 relative">
                      {/* ⭐ 즐겨찾기 버튼 */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isFavorite(member.id)) {
                            removeFavorite(member.id);
                          } else {
                            addFavorite({
                              id: member.id,
                              name: member.name,
                              type: "member",
                              imageUrl: member.photo ?? undefined,
                            });
                          }
                        }}
                        className="absolute top-4 right-4 z-10 p-1 rounded-full hover:bg-yellow-50 transition-colors"
                        aria-label={isFavorite(member.id) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                        data-testid={`btn-favorite-${member.id}`}
                      >
                        <Star
                          className={`w-5 h-5 transition-colors ${
                            isFavorite(member.id)
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-none text-gray-300 group-hover:text-gray-400"
                          }`}
                        />
                      </button>

                      <div className="flex items-start gap-4 mb-6">
                        <div className="relative shrink-0">
                          {member.photo ? (
                            <div className="w-16 h-16 rounded-full overflow-hidden border shadow-sm">
                              <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/5 to-primary/20 text-primary flex items-center justify-center text-xl font-black border shadow-sm">
                              {member.name.charAt(0)}
                            </div>
                          )}
                          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-background border shadow-sm flex items-center justify-center">
                            <div className={`w-3 h-3 rounded-full ${getPartyColor(member.party)}`} />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <div className="flex items-center justify-between mb-1">
                            <h3
                              className="font-bold text-xl tracking-tighter group-hover:text-primary transition-colors truncate"
                              data-testid={`text-member-name-${member.id}`}
                            >
                              {member.name}
                            </h3>
                            <span
                              className={`text-xl font-black tracking-tighter ${getScoreColor(member.score.totalScore)} shrink-0`}
                              data-testid={`text-score-${member.id}`}
                            >
                              {getScoreGrade(member.score.totalScore)}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5 items-start mt-0.5">
                            <Badge
                              variant="outline"
                              className={`px-1.5 py-0 text-[10px] bg-transparent font-bold border ${
                                getPartyColor(member.party).replace("bg-", "text-").replace("text-white", "")
                              } border-current opacity-80 uppercase tracking-widest`}
                            >
                              {member.party}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground w-full">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{member.district}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border/50">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold mb-2">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>본회의 출석률</span>
                            </div>
                            <span className="text-foreground">{member.score.attendanceRate}%</span>
                          </div>
                          <Progress value={member.score.attendanceRate} className="h-2 bg-secondary" />
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold pt-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <FileText className="w-3.5 h-3.5" />
                            <span>대표 발의 법안</span>
                          </div>
                          <span className="text-foreground">{member.score.billProposalCount}건</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-32 bg-card rounded-3xl border border-dashed border-border shadow-sm">
              <Search className="w-16 h-16 text-muted-foreground/30 mx-auto mb-6" />
              <h3 className="text-xl font-bold mb-2">검색 결과가 없습니다</h3>
              <p className="text-muted-foreground" data-testid="text-no-results">
                다른 검색어를 입력하거나 필터를 확인해 보세요
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── FavoriteMiniCard 바텀시트 ── */}
      {selectedFavorite && (
        <FavoriteMiniCard
          personId={selectedFavorite.id}
          type={selectedFavorite.type}
          onClose={() => setSelectedFavorite(null)}
        />
      )}
    </div>
  );
}
