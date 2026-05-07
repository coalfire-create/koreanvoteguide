import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Flame, Bell, Settings, FileText, MessageSquare, TrendingUp, Loader2, AlertCircle, Newspaper, ExternalLink, ChevronRight, Clock, Building2 } from "lucide-react";
import { getBillEmoji } from "@/lib/utils";
import { useAssemblyBills, useAssemblyMembers, useHotBills, useSearchHistory, saveSearchQuery, clearSearchHistory, deleteSearchHistoryItem } from "@/lib/api-data";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { NewsAnalysisDialog } from "@/components/news-analysis-dialog";

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

export default function BillSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const { bills, isLoading: billsLoading } = useAssemblyBills();
  const { members, isLoading: membersLoading } = useAssemblyMembers();
  const { bills: hotBills, isLoading: hotBillsLoading, isError: hotBillsError } = useHotBills();
  const { history: searchHistory, isLoading: historyLoading } = useSearchHistory();
  const queryClient = useQueryClient();

  // 오늘 발의 법안 수 계산
  const today = new Date().toISOString().slice(0, 10);
  const todayBillCount = bills.filter(b => b.proposedDate?.startsWith(today)).length;

  // 가장 활발한 토론 법안 (커뮤니티에서 태그된 bill 게시글 중 가장 인기 있는 것)
  const { data: trendingBillPosts } = useQuery<any[]>({
    queryKey: ["/api/community/posts", "trending-bill"],
    queryFn: () => apiRequest("GET", "/api/community/posts?sort=popular&tagType=bill").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const hotDiscussionPost = trendingBillPosts?.[0];
  
  // 뉴스 API 데이터 (법안 관련)
  const { data: newsData, isLoading: newsLoading } = useQuery<any>({
    queryKey: ["/api/news", "bill"],
    queryFn: () => apiRequest("GET", "/api/news?category=bill").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
  });
  const newsItems = newsData?.items?.slice(0, 6) || [];
  const [selectedNews, setSelectedNews] = useState<{ title: string; url: string; source: string } | null>(null);

  const FILTER_CATEGORIES = ["전체", "경제", "복지", "환경", "교육"];
  const [filterCat, setFilterCat] = useState("전체");
  const [votedBills, setVotedBills] = useState<Record<string, boolean>>({});
  const [followedMembers, setFollowedMembers] = useState<Record<string, boolean>>({});

  // 최근 대표발의한 의원 (최근 발의 법안 기반으로 동적 추출)
  const topMembers = (() => {
    if (!bills.length || !members.length) return members.slice(0, 4);
    
    // 최근 발의된 법안 순으로 정렬 (id가 큰 것이 최신일 가능성이 높거나, proposedDate 기준)
    const sortedBills = [...bills].sort((a, b) => {
      const dateA = a.proposedDate || "";
      const dateB = b.proposedDate || "";
      return dateB.localeCompare(dateA);
    });

    const recentProposers = new Set<string>();
    const result: any[] = [];

    for (const bill of sortedBills) {
      if (!bill.proposer) continue;
      
      // 대표발의자 이름 추출 (예: "홍길동(더불어민주당/서울...)" -> "홍길동")
      const proposerName = bill.proposer.split('(')[0].trim();
      
      if (!recentProposers.has(proposerName)) {
        // 이름이 일치하는 의원 찾기
        const member = members.find(m => m.name === proposerName);
        if (member) {
          recentProposers.add(proposerName);
          result.push(member);
        }
      }
      
      if (result.length >= 4) break;
    }

    // 만약 발의자 기반 추출이 부족하면 기존 상위 의원으로 보충
    if (result.length < 4) {
      const remaining = members.filter(m => !recentProposers.has(m.name)).slice(0, 4 - result.length);
      return [...result, ...remaining];
    }

    return result;
  })();

  const handleSearchClick = async () => {
    if (!searchQuery.trim()) return;
    await saveSearchQuery(searchQuery.trim());
    queryClient.invalidateQueries({ queryKey: ["/api/search-history"] });
  };

  const handleDeleteAll = async () => {
    await clearSearchHistory();
    queryClient.invalidateQueries({ queryKey: ["/api/search-history"] });
  };

  const handleDeleteItem = async (id: number) => {
    await deleteSearchHistoryItem(id);
    queryClient.invalidateQueries({ queryKey: ["/api/search-history"] });
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full h-[72px] bg-white border-b border-slate-100 flex items-center px-8">
        <div className="flex-1 flex items-center">
          <div className="relative w-full max-w-[600px] flex items-center gap-3">
            <div className="relative w-full">
              <Search 
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 cursor-pointer" 
                onClick={handleSearchClick}
              />
              <input
                className="w-full h-12 pl-12 pr-4 bg-slate-100 border-none rounded-full text-[15px] focus:ring-2 focus:ring-[#6D28D9]/20 outline-none transition-all placeholder:text-slate-400 font-medium"
                placeholder="법안 제목, 발의자, 키워드로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
              />
            </div>
            <button 
              className="h-12 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[14px] font-bold transition-all flex items-center gap-2 shrink-0"
              onClick={handleSearchClick}
            >
              <SlidersIcon className="w-4 h-4" />
              필터
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-slate-50 transition-colors">
            <Bell className="w-5 h-5 text-slate-600" />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-50 transition-colors">
            <Settings className="w-5 h-5 text-slate-600" />
          </button>
          <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-100 overflow-hidden cursor-pointer shadow-sm">
            {/* Avatar placeholder */}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="p-8 max-w-[1536px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          
          {/* Main Content */}
          <div className="space-y-8">
            
            {/* Filter Chips */}
            <section className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {FILTER_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-6 py-2.5 rounded-full text-[14px] font-bold transition-all active:scale-95 border-none shadow-sm ${
                    filterCat === cat
                      ? "bg-[#6D28D9] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </section>

            {/* 인기 법안 Top 5 */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[18px] font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-[10px] bg-[#FFF4ED] flex items-center justify-center">
                    <Flame className="w-4.5 h-4.5 text-[#FB923C]" />
                  </span>
                  인기 법안
                </h2>
                <span className="text-[12px] font-bold text-slate-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  뉴스 언급 기반 · 심사중인 법안
                </span>
              </div>

              {hotBillsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="bg-white rounded-[14px] p-5 shadow-sm border border-slate-100 flex gap-4">
                      <Skeleton className="w-8 h-8 rounded-[8px] shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4 rounded" />
                        <Skeleton className="h-3 w-1/2 rounded" />
                      </div>
                      <Skeleton className="w-20 h-8 rounded-[8px] shrink-0" />
                    </div>
                  ))}
                </div>
              ) : hotBillsError || hotBills.length === 0 ? (
                <div className="bg-white rounded-[16px] p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-[15px] font-medium">인기 법안 데이터를 불러올 수 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hotBills.map((bill: any, idx: number) => {
                    const rankColors = [
                      { bg: "bg-[#FB923C]", text: "text-white", border: "border-[#FB923C]/20", card: "border-l-[#FB923C]" },
                      { bg: "bg-[#6D28D9]", text: "text-white", border: "border-[#6D28D9]/20", card: "border-l-[#6D28D9]" },
                      { bg: "bg-slate-500", text: "text-white", border: "border-slate-200", card: "border-l-slate-400" },
                      { bg: "bg-slate-300", text: "text-slate-700", border: "border-slate-100", card: "border-l-slate-300" },
                      { bg: "bg-slate-200", text: "text-slate-600", border: "border-slate-100", card: "border-l-slate-200" },
                    ];
                    const rank = rankColors[idx] ?? rankColors[4];
                    const isTop = idx === 0;

                    const statusLabel = !bill.result || bill.result === "" || bill.result === "계류" ? "심사중" : bill.result;
                    const statusColor = statusLabel === "심사중" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";

                    return (
                      <div
                        key={bill.billId}
                        onClick={() => navigate(`/bills/${bill.billId}/vote`)}
                        className={`bg-white rounded-[14px] px-5 py-4 shadow-sm border border-slate-100 border-l-4 ${rank.card} flex gap-4 items-start cursor-pointer hover:shadow-md transition-all active:scale-[0.99] group ${isTop ? "ring-2 ring-[#FB923C]/20" : ""}`}
                      >
                        {/* 순위 배지 및 이모지 */}
                        <div className="relative shrink-0">
                          <div className={`px-2 h-8 min-w-[32px] rounded-[8px] ${rank.bg} ${rank.text} flex items-center justify-center text-[11px] font-extrabold shadow-sm whitespace-nowrap`}>
                            {getBillInitial(bill.billName, bill.committee)}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] shadow-sm border border-slate-50">
                            {getBillEmoji(bill.billName, bill.committee)}
                          </div>
                        </div>

                        {/* 법안 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {isTop && (
                              <span className="px-2 py-0.5 bg-[#FFF4ED] text-[#FB923C] text-[10px] font-bold rounded-full flex items-center gap-1">
                                <Flame className="w-2.5 h-2.5" /> HOT
                              </span>
                            )}
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColor}`}>
                              {statusLabel}
                            </span>
                            {bill.mediaMentionCount > 0 && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full flex items-center gap-1">
                                <Newspaper className="w-2.5 h-2.5" />
                                뉴스 {bill.mediaMentionCount}건
                              </span>
                            )}
                          </div>

                          <h3 className={`text-[14px] font-extrabold text-slate-900 leading-snug mb-1.5 group-hover:text-[#6D28D9] transition-colors line-clamp-2 ${isTop ? "text-[15px]" : ""}`}>
                            {bill.billName}
                          </h3>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium flex-wrap">
                            {bill.committee && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {bill.committee}
                              </span>
                            )}
                            {bill.proposer && (
                              <span className="truncate max-w-[160px]">
                                {bill.proposer.split("(")[0].trim()} 외 {bill.coProposerCount ?? 0}인
                              </span>
                            )}
                            {bill.proposeDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {bill.proposeDate}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 우측 액션 */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/bills/${bill.billId}/vote`); }}
                            className="px-3 py-1.5 rounded-[8px] text-[12px] font-bold bg-[#6D28D9] text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap"
                          >
                            투표 →
                          </button>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            조회 {(bill.viewCount ?? 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>


            {/* 최근 대표발의한 의원 (실데이터) */}
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">최근 대표발의한 의원</h3>
                <Link href="/members" className="text-[13px] font-bold text-[#6D28D9]">전체 보기 →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {membersLoading
                  ? [1, 2, 3, 4].map(i => (
                      <div key={i} className="bg-white p-5 rounded-[16px] border border-slate-100 flex flex-col items-center text-center shadow-sm">
                        <Skeleton className="w-20 h-20 rounded-full mb-4" />
                        <Skeleton className="h-4 w-20 mb-2 rounded" />
                        <Skeleton className="h-3 w-16 mb-4 rounded" />
                        <Skeleton className="h-9 w-full rounded-[8px]" />
                      </div>
                    ))
                  : topMembers.length === 0
                  ? (
                      <div className="col-span-4 py-10 bg-white rounded-[16px] border border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <AlertCircle className="w-6 h-6" />
                        <p className="text-[13px] font-medium">데이터를 불러올 수 없습니다</p>
                      </div>
                    )
                  : topMembers.map(member => {
                      const isFollowed = followedMembers[member.id];
                      return (
                        <Link key={member.id} href={`/members/${member.id}`} className="bg-white p-5 rounded-[16px] border border-slate-100 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all cursor-pointer block">
                          <div className="w-20 h-20 rounded-full mb-4 border-2 border-[#6D28D9] overflow-hidden hover:scale-105 transition-transform bg-slate-100 flex items-center justify-center">
                            {member.photo ? (
                              <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-2xl font-bold text-slate-400">{member.name.charAt(0)}</span>
                            )}
                          </div>
                          <h4 className="text-[14px] font-bold text-slate-900 mb-1 hover:text-[#6D28D9]">{member.name}</h4>
                          <p className="text-[11px] text-slate-400 mb-4">{member.party} · {member.district}</p>
                          <button 
                            onClick={(e) => { e.preventDefault(); setFollowedMembers(prev => ({...prev, [member.id]: !prev[member.id]})); }}
                            className={`w-full py-2 rounded-[8px] text-[13px] font-bold transition-all ${
                              isFollowed 
                                ? 'bg-[#6D28D9] text-white' 
                                : 'bg-[#FFF4ED] text-[#FB923C] hover:bg-[#FFE8D6]'
                            }`}
                          >
                            {isFollowed ? '팔로우 중' : '팔로우'}
                          </button>
                        </Link>
                      );
                    })
                }
              </div>
            </section>
            
          </div>

          {/* Middle Widgets Column */}
          <aside className="space-y-6">
            {/* Widget 0: 최근 검색어 (이동됨) */}
            <div className="bg-white rounded-[16px] p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
                  최근 검색어
                </h3>
                {searchHistory.length > 0 && (
                  <button
                    onClick={handleDeleteAll}
                    className="text-[12px] font-bold text-[#6D28D9]"
                  >
                    삭제
                  </button>
                )}
              </div>
              {historyLoading ? (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-7 w-16 rounded-[6px]" />)}
                </div>
              ) : searchHistory.length === 0 ? (
                <p className="text-[12px] text-slate-400 font-medium">검색 기록이 없습니다</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map(item => (
                    <div
                      key={item.id}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[12px] font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer hover:border-[#6D28D9]/40 transition-colors"
                      onClick={() => setSearchQuery(item.query)}
                    >
                      {item.query}
                      <span
                        className="text-slate-300 hover:text-slate-500"
                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Widget 1: 오늘 발의된 법안 수 */}
            <div className="bg-white rounded-[16px] p-6 shadow-sm border border-slate-100 flex items-start gap-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#F4F1FF] flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-[#6D28D9]" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-slate-500 mb-1">오늘 발의된 법안</p>
                {billsLoading ? (
                  <Skeleton className="h-9 w-12 rounded mb-1" />
                ) : (
                  <h3 className="text-[28px] font-extrabold text-slate-900 leading-none mb-1">
                    {todayBillCount}
                  </h3>
                )}
                <p className="text-[11px] font-medium text-slate-400">오늘 기준 발의 건수</p>
              </div>
            </div>

            {/* Widget 2: 가장 활발한 토론 */}
            <div className="bg-white rounded-[16px] p-6 shadow-sm border border-slate-100 flex items-start gap-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#FFF1F2] flex items-center justify-center shrink-0">
                <MessageSquare className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-slate-500 mb-1.5">가장 활발한 토론</p>
                {!hotDiscussionPost ? (
                  <h3 className="text-[16px] font-bold text-slate-900 leading-snug mb-1 line-clamp-2">
                    {hotBills?.[0]?.billName ?? "법안 토론 불러오는 중..."}
                  </h3>
                ) : (
                  <Link href={`/community/${hotDiscussionPost.id}`}>
                    <h3 className="text-[16px] font-bold text-slate-900 leading-snug mb-1 hover:text-[#6D28D9] transition-colors cursor-pointer line-clamp-2">
                      {getBillEmoji(hotDiscussionPost.tagName || hotDiscussionPost.title)} {hotDiscussionPost.tagName ?? hotDiscussionPost.title}
                    </h3>
                  </Link>
                )}
                <p className="text-[11px] font-medium text-slate-400">
                  {hotDiscussionPost
                    ? `${hotDiscussionPost.commentCount ?? 0}개의 댓글`
                    : "커뮤니티 토론 중"}
                </p>
              </div>
            </div>

            {/* Widget 3: 법안 관련 뉴스 */}
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                    <Newspaper className="w-4 h-4 text-violet-500" />
                  </div>
                  <h3 className="text-[15px] font-bold text-slate-900">법안 관련 뉴스</h3>
                </div>
                <Link href="/news">
                  <span className="text-[11px] font-bold text-slate-400 hover:text-[#6D28D9] transition-colors cursor-pointer">더보기</span>
                </Link>
              </div>

              {newsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : newsItems.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-8 font-medium">뉴스를 불러오는 중입니다...</p>
              ) : (
                <div className="space-y-1">
                  {newsItems.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedNews({ title: item.title, url: item.link, source: item.source })}
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
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 mt-0.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-200 hover:text-[#6D28D9] transition-colors" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>


        </div>
      </main>

      <NewsAnalysisDialog
        isOpen={!!selectedNews}
        onOpenChange={(open) => !open && setSelectedNews(null)}
        news={selectedNews}
      />
    </div>
  );
}

// Simple icon for the filter button
function SlidersIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="21" y2="14" />
      <line x1="4" x2="20" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="8" x2="16" y1="14" y2="14" />
      <line x1="8" x2="16" y1="10" y2="10" />
    </svg>
  );
}
