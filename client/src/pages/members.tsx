import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Search, Bell, SlidersHorizontal, Zap, Star, TrendingUp, Users, ChevronDown, Flame, Newspaper, FileText, RefreshCw, ChevronRight, ExternalLink, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAssemblyMembers } from "@/lib/api-data";
import { getPartyRank } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { LoginPrompt } from "@/components/LoginPrompt";
import { StoryFeed } from "@/components/StoryFeed";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceCode: string;
  thumbnail?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  yna:      "bg-red-50 text-red-600 border-red-100",
  kbs:      "bg-blue-50 text-blue-600 border-blue-100",
  mbc:      "bg-purple-50 text-purple-600 border-purple-100",
  sbs:      "bg-pink-50 text-pink-600 border-pink-100",
  jtbc:     "bg-orange-50 text-orange-600 border-orange-100",
  ytn:      "bg-sky-50 text-sky-600 border-sky-100",
  hani:     "bg-green-50 text-green-600 border-green-100",
  khan:     "bg-teal-50 text-teal-600 border-teal-100",
  chosun:   "bg-slate-50 text-slate-600 border-slate-100",
  joongang: "bg-amber-50 text-amber-600 border-amber-100",
  donga:    "bg-indigo-50 text-indigo-600 border-indigo-100",
  news1:    "bg-rose-50 text-rose-600 border-rose-100",
};

function newsTimeAgo(pubDate: string) {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return pubDate;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export default function Members() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParty, setSelectedParty] = useState("전체");
  const [followedMembers, setFollowedMembers] = useState<Record<string, boolean>>({});
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const { user } = useAuth();
  const { members, isLoading } = useAssemblyMembers();
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    if (user?.favorites) {
      const followMap: Record<string, boolean> = {};
      user.favorites.forEach(id => {
        followMap[id] = true;
      });
      setFollowedMembers(followMap);
    }
  }, [user?.favorites]);

  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, selectedParty]);

  const handleSearchClick = () => {};

  // Extract unique parties for the filter and sort by seat count
  const parties = ["전체", ...Array.from(new Set(members.map(m => m.party))).sort((a, b) => getPartyRank(a) - getPartyRank(b))];

  const filtered = members.filter(
    (m) => {
      const matchesSearch = m.name.includes(searchQuery) ||
                          m.party.includes(searchQuery) ||
                          m.district.includes(searchQuery);
      const matchesParty = selectedParty === "전체" || m.party === selectedParty;
      return matchesSearch && matchesParty;
    }
  ).sort((a, b) => getPartyRank(a.party) - getPartyRank(b.party));

  // ===== 최근 주목받는 의원 크롤링 =====
  const {
    data: trendingData,
    isLoading: isTrendingLoading,
    refetch: refetchTrending,
  } = useQuery<{ success: boolean; data: any[]; cachedAt: string }>({
    queryKey: ["/api/trending-members"],
    queryFn: () => fetch("/api/trending-members").then(r => r.json()).catch(() => ({ success: false, data: [] })),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const trendingMembers = trendingData?.data || [];
  const [trendingRefreshing, setTrendingRefreshing] = useState(false);

  async function handleRefreshTrending() {
    setTrendingRefreshing(true);
    await refetchTrending();
    setTrendingRefreshing(false);
  }

  const { data: billsData } = useQuery({
    queryKey: ["/api/bills"],
    queryFn: async () => {
      const res = await fetch(`/api/bills`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  const { data: activeMembers = [] } = useQuery<{
    id: string;
    name: string;
    party: string;
    district: string;
    photo: string;
    recentBill: string;
    recentBillDescription: string | null;
    recentBillCommittee: string;
    billId: string;
    proposeDate: string;
  }[]>({
    queryKey: ["/api/members/active"],
  });

  const { data: memberNews, isLoading: isMemberNewsLoading } = useQuery<{ items: NewsItem[] }>({
    queryKey: ["/api/news", "member"],
    queryFn: () => fetch("/api/news?category=member").then((r) => r.json()),
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const newsItems = (memberNews?.items ?? []).slice(0, 6);

  const visibleMembers = filtered.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-[#F8F9FC] font-sans text-slate-900 overflow-x-hidden">
      {/* Premium Top Bar */}
      <header className="sticky top-0 z-40 w-full h-[72px] bg-white border-b border-gray-100 flex items-center px-8">
        <div className="flex-1 flex items-center">
          <div className="relative w-full max-w-[500px] group">
            <Search 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#6D28D9] transition-colors cursor-pointer" 
              onClick={handleSearchClick}
            />
            <input
              className="w-full h-10 pl-11 pr-12 bg-gray-50 border border-gray-100 rounded-xl text-[14px] focus:bg-white focus:border-[#6D28D9]/30 outline-none transition-all placeholder:text-gray-400 font-medium"
              placeholder="국회의원 이름으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-100 rounded shadow-sm">
              <span className="text-[10px] font-bold text-gray-400">⌘K</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 shadow-sm cursor-pointer"></div>
        </div>
      </header>

      <main className="p-8 w-full max-w-full lg:max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Main Content (Center) */}
          <div className="flex-1 min-w-0 space-y-12">
            {/* Elegant Title Section */}
            <section className="space-y-3">
              <h1 className="text-[32px] font-black text-gray-900 tracking-tight leading-tight">의원을 팔로우하세요</h1>
              <p className="text-gray-500 text-[15px] font-medium leading-relaxed max-w-2xl">
                관심 의원의 활동을 받아보고, 한 명씩 알아가보세요.
              </p>
            </section>

            {/* Story-style 팔로우 피드 */}
            <div className="bg-white rounded-[2rem] border border-gray-100 py-2 -mx-4 sm:mx-0">
              <StoryFeed />
            </div>

            {/* List Section */}
            <section className="space-y-8">
              <div className="flex items-center gap-6 border-b border-gray-100 overflow-x-auto scrollbar-hide">
                {["추천"].map((tab) => (
                  <button
                    key={tab}
                    className={`whitespace-nowrap shrink-0 pb-4 text-[14px] font-bold transition-all relative ${
                      tab === "추천" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {tab}
                    {tab === "추천" && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900 rounded-t-full" />
                    )}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-white rounded-2xl animate-pulse border border-gray-100" />)
                ) : filtered.length > 0 ? (
                  visibleMembers.map((member, idx) => {
                    const isFollowed = followedMembers[member.id];

                    return (
                      <div 
                        key={member.id} 
                        className="bg-white rounded-[2rem] border border-gray-100 p-8 flex flex-col items-center transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 group relative overflow-hidden"
                      >
                        {/* Glassy Background Effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-indigo-100/40 transition-colors" />
                        
                        <Link href={`/members/${member.id}`} className="w-32 h-32 rounded-full overflow-hidden mb-8 relative shadow-xl border-4 border-white group-hover:scale-105 transition-transform duration-500 z-10">
                          <PoliticianPhoto
                            name={member.name}
                            photo={member.photo}
                            monaCd={member.id}
                            className="w-full h-full object-cover"
                            avatarClassName="text-[32px] font-black bg-gray-50 text-gray-200"
                          />
                        </Link>
                        
                        <div className="text-center space-y-2 mb-8 relative z-10">
                          <h3 className="text-[20px] font-black text-gray-900 group-hover:text-[#6D28D9] transition-colors">{member.name}</h3>
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[11px] font-black px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md uppercase tracking-wider">{member.party}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-200" />
                            <span className="text-[12px] font-bold text-gray-400">{member.district}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 mb-8 text-[11px] font-bold text-gray-400 relative z-10 bg-gray-50/50 px-4 py-2 rounded-2xl">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-gray-900">{(Math.random() * 30).toFixed(1)}k</span>
                            <span className="opacity-60">팔로워</span>
                          </div>
                          <div className="w-px h-3 bg-gray-200" />
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-gray-900">활동적</span>
                          </div>
                        </div>

                        <button 
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!user) {
                              setShowLoginPrompt(true);
                              return;
                            }
                            
                            const isFollowed = followedMembers[member.id];
                            const newFavorites = isFollowed 
                              ? user.favorites.filter(id => id !== member.id)
                              : [...user.favorites, member.id];
                            
                            try {
                              const res = await fetch("/api/auth/favorites", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ favorites: newFavorites }),
                              });
                              
                              if (res.ok) {
                                setFollowedMembers(prev => ({...prev, [member.id]: !prev[member.id]}));
                              }
                            } catch (e) {
                              console.error("Follow error:", e);
                            }
                          }}
                          className={`w-full py-4 rounded-[1.25rem] text-[14px] font-black transition-all relative z-10 ${
                            followedMembers[member.id] 
                            ? 'bg-gray-100 text-gray-400 border border-gray-200' 
                            : 'bg-[#6D28D9] text-white hover:bg-[#5B21B6] shadow-lg shadow-indigo-500/20 active:scale-95'
                          }`}
                        >
                          {followedMembers[member.id] ? '팔로우 중' : '팔로우 시작하기'}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <p className="text-slate-400 font-medium text-lg">해당 조건에 맞는 의원이 없습니다.</p>
                    <button onClick={() => {setSelectedParty("전체"); setSearchQuery("");}} className="text-[#6D28D9] font-bold hover:underline">필터 초기화</button>
                  </div>
                )}
              </div>
              
              {filtered.length > visibleCount && (
                <div className="flex justify-center pt-8">
                  <button 
                    onClick={() => setVisibleCount(prev => prev + 12)}
                    className="px-10 py-3.5 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[14px] font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-3 group"
                  >
                    더 많은 의원 보기
                    <ChevronDown className="w-5 h-5 text-slate-400 group-hover:translate-y-1 transition-transform" />
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="w-full lg:w-[320px] space-y-8 flex-shrink-0">

            {/* Widget: 국회의원 관련 뉴스 */}
            <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Newspaper className="w-4 h-4 text-blue-500" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-[15px]">국회의원 뉴스</h3>
                </div>
                <Link href="/news">
                  <span className="text-[11px] font-bold text-gray-400 hover:text-[#6D28D9] transition-colors cursor-pointer">더보기</span>
                </Link>
              </div>

              {isMemberNewsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : newsItems.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  뉴스를 불러오는 중입니다...
                </div>
              ) : (
                <div className="space-y-1">
                  {newsItems.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-100"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                          <Newspaper className="w-5 h-5 text-slate-200" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-[13px] font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-[#6D28D9] transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${SOURCE_COLORS[item.sourceCode] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}>
                            {item.source}
                          </span>
                          <span className="text-[10px] text-slate-300 font-medium flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {newsTimeAgo(item.pubDate)}
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-200 group-hover:text-[#6D28D9] transition-colors flex-shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Widget: 최근 주목받는 의원 (크롤링) */}
            <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Flame className="w-4 h-4 text-orange-500" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-[15px]">최근 주목받는 의원</h3>
                </div>
                <button
                  onClick={handleRefreshTrending}
                  disabled={trendingRefreshing || isTrendingLoading}
                  className="text-gray-300 hover:text-indigo-500 transition-colors disabled:opacity-40"
                  title="새로고침"
                >
                  <RefreshCw className={`w-4 h-4 ${trendingRefreshing ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* 로딩 상태 */}
              {isTrendingLoading && (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-2 w-32" />
                      </div>
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </div>
                  ))}
                </div>
              )}

              {/* 의원 목록 */}
              {!isTrendingLoading && trendingMembers.length > 0 && (
                <div className="space-y-3">
                  {trendingMembers.slice(0, 5).map((member: any, idx: number) => {
                    const partyColor =
                      member.party?.includes("더불어민주당") ? "bg-blue-500" :
                      member.party?.includes("국민의힘") ? "bg-red-500" :
                      member.party?.includes("조국혁신당") ? "bg-blue-800" :
                      member.party?.includes("개혁신당") ? "bg-orange-500" :
                      "bg-gray-400";
                    const rankColors = ["text-orange-500", "text-gray-400", "text-amber-600"];
                    const rankBg = ["bg-orange-50", "bg-gray-50", "bg-amber-50"];

                    return (
                      <Link
                        key={member.id || member.name}
                        href={`/members/${member.id || encodeURIComponent(member.name)}`}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                      >
                        {/* 순위 뱃지 */}
                        <div className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-black mt-0.5 ${idx < 3 ? rankBg[idx] : "bg-gray-50"} ${idx < 3 ? rankColors[idx] : "text-gray-400"}`}>
                          {idx + 1}
                        </div>

                        {/* 프로필 이미지 */}
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 relative">
                          <PoliticianPhoto
                            name={member.name}
                            photo={member.photo}
                            monaCd={member.id}
                            avatarClassName={`${partyColor} text-white text-sm font-black`}
                          />
                          {idx === 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
                              <Flame className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>

                        {/* 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[13px] font-bold text-gray-900 group-hover:text-[#6D28D9] transition-colors">
                              {member.name}
                            </span>
                            <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full ${partyColor}`}>
                              {member.party?.replace("더불어민주당", "민주당").replace("국민의힘", "국힘").replace("조국혁신당", "조혁당")}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            {member.primaryKeyword && (
                              <span className="text-[10px] font-medium text-slate-500 truncate max-w-[140px]">
                                {member.primaryKeyword}
                              </span>
                            )}
                            {(member.recentNewsCount ?? member.mentionCount ?? 0) > 0 && (
                              <div className="flex items-center gap-0.5 text-blue-500 text-[9px] font-bold">
                                <Newspaper className="w-2.5 h-2.5" />
                                {member.recentNewsCount ?? member.mentionCount}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-[#6D28D9] transition-colors self-center" />
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* 데이터 없을 때 */}
              {!isTrendingLoading && trendingMembers.length === 0 && (
                <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Flame className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-[12px] text-gray-400 font-medium">실시간 데이터 분석 중...</p>
                </div>
              )}
              
              {/* 범례 */}
              {!isTrendingLoading && trendingMembers.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-[9px] text-gray-400">
                  <span>팔로워·조회·뉴스 가중치 합산</span>
                  <span>실시간 DB 랭킹</span>
                </div>
              )}
            </div>

            <section className="space-y-6">
              <div className="flex items-center justify-between pl-1">
                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold text-slate-900">최근 활동 의원</h2>
                  <p className="text-[12px] font-medium text-slate-400">최근 법안을 대표발의한 의원</p>
                </div>
                <div className="p-2.5 bg-[#6D28D9]/10 rounded-2xl">
                   <Zap className="w-5 h-5 text-[#6D28D9] fill-[#6D28D9]" />
                </div>
              </div>
              
              <div className="space-y-4">
                {activeMembers.length > 0 ? (
                  activeMembers.map((member, idx) => (
                    <Link key={member.id} href={`/members/${member.id}`} className="block group">
                      <div className={`relative overflow-hidden rounded-[32px] p-6 transition-all duration-500 border ${
                        idx === 0 
                        ? "bg-gradient-to-br from-[#6D28D9] to-[#4F1AB8] border-transparent text-white shadow-xl shadow-[#6D28D9]/20 hover:scale-[1.02]" 
                        : "bg-white border-slate-100 text-slate-900 hover:border-[#6D28D9]/30 hover:shadow-lg hover:-translate-y-1"
                      }`}>
                        {idx === 0 && (
                          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                        )}
                        
                        <div className="flex items-center gap-4 mb-4 relative z-10">
                            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                              <PoliticianPhoto
                                name={member.name}
                                photo={member.photo}
                                monaCd={member.id}
                                avatarClassName={`text-lg font-bold ${idx === 0 ? "bg-white/10 text-white" : "bg-slate-50 text-slate-300"}`}
                              />
                            </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-[17px] font-black tracking-tight ${idx === 0 ? "text-white" : "text-slate-900 group-hover:text-[#6D28D9]"}`}>{member.name} 의원</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${idx === 0 ? "bg-white/20 text-white" : "bg-[#6D28D9]/10 text-[#6D28D9]"}`}>
                                {member.party}
                              </span>
                              <span className={`text-[11px] font-bold opacity-60 ${idx === 0 ? "text-white" : "text-slate-400"}`}>
                                {member.proposeDate}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={`rounded-2xl p-4 border relative z-10 ${
                          idx === 0 ? "bg-white/10 border-white/10 backdrop-blur-md" : "bg-slate-50 border-slate-100/50"
                        }`}>
                          <div className="flex items-center gap-2 mb-2 opacity-80 flex-wrap">
                             <Star className={`w-3 h-3 ${idx === 0 ? "fill-amber-300 text-amber-300" : "fill-amber-500 text-amber-500"}`} />
                             <p className={`text-[10px] font-bold uppercase tracking-widest ${idx === 0 ? "text-white" : "text-slate-400"}`}>대표발의 법안</p>
                             {member.recentBillCommittee && (
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                 idx === 0 ? "bg-white/15 text-white" : "bg-white text-slate-500 border border-slate-100"
                               }`}>
                                 {member.recentBillCommittee}
                               </span>
                             )}
                          </div>
                          <p className={`text-[13px] font-bold leading-snug line-clamp-2 ${idx === 0 ? "text-white" : "text-slate-800"}`}>
                            {member.recentBill}
                          </p>
                          {/* AI 풀이 — null/공란이면 안내 문구로 폴백 */}
                          <p className={`mt-2 text-[12px] leading-relaxed line-clamp-3 ${
                            idx === 0 ? "text-white/80" : "text-slate-500"
                          }`}>
                            {member.recentBillDescription
                              ? member.recentBillDescription
                              : "AI 요약이 아직 준비되지 않은 법안입니다. 의원실 페이지에서 본문을 확인하세요."}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="bg-white rounded-[32px] p-10 text-center border border-slate-100 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                      <Zap className="w-6 h-6 text-slate-200" />
                    </div>
                    <p className="text-slate-400 text-[14px] font-bold">활동 데이터를 수집하고 있습니다...</p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>

      <LoginPrompt isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />
    </div>
  );
}
