import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Flame, FileText, MessageSquare, TrendingUp, AlertCircle, Newspaper, ExternalLink, ChevronRight, Clock, X, Sparkles, LayoutGrid } from "lucide-react";
import { getBillEmoji } from "@/lib/utils";
import { useAssemblyBills, useAssemblyMembers, useHotBills, useSearchHistory, saveSearchQuery, clearSearchHistory, deleteSearchHistoryItem } from "@/lib/api-data";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { withApiBase } from "@/lib/api-base";
import { useQuery } from "@tanstack/react-query";
import { NewsAnalysisDialog } from "@/components/news-analysis-dialog";
import { useAuth } from "@/lib/auth";

const SOURCE_COLORS: Record<string, string> = {
  yna:        "bg-red-50 text-red-600 border-red-100",
  sbs:        "bg-pink-50 text-pink-600 border-pink-100",
  hani:       "bg-green-50 text-green-600 border-green-100",
  khan:       "bg-teal-50 text-teal-600 border-teal-100",
  chosun:     "bg-slate-50 text-slate-600 border-slate-100",
  donga:      "bg-indigo-50 text-indigo-600 border-indigo-100",
  newsis:     "bg-sky-50 text-sky-600 border-sky-100",
  ohmynews:   "bg-orange-50 text-orange-600 border-orange-100",
  mediatoday: "bg-purple-50 text-purple-600 border-purple-100",
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

function statusLabel(s: string | undefined | null) {
  return !s || s === "" || s === "계류" ? "심사중" : s;
}

function statusPill(label: string) {
  if (label === "심사중") return "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400";
  if (label === "통과") return "bg-primary/10 text-primary";
  return "bg-black/5 text-muted-foreground dark:bg-white/10";
}

const StatusBadge = ({ label }: { label: string }) => (
  <span className={`inline-flex items-center px-1.5 py-px rounded-md text-[10px] font-bold leading-tight ${statusPill(label)}`}>
    {label}
  </span>
);

// 인기 법안 1·2·3위 메달 뱃지
const RANK_STYLES = [
  "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-sm shadow-amber-500/30",
  "bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-sm shadow-slate-400/30",
  "bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow-sm shadow-orange-500/30",
];

export default function BillSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { bills, isLoading: billsLoading } = useAssemblyBills();
  const { members, isLoading: membersLoading } = useAssemblyMembers();
  const { bills: hotBills, isLoading: hotBillsLoading, isError: hotBillsError } = useHotBills();
  const { history: searchHistory, isLoading: historyLoading } = useSearchHistory();
  const queryClient = useQueryClient();

  const isSearching = searchQuery.trim().length > 0;
  const searchResults = isSearching
    ? bills.filter((bill: any) => {
        const q = searchQuery.trim().toLowerCase();
        const name = (bill.name || bill.billName || "").toLowerCase();
        const proposer = (bill.proposer || "").toLowerCase();
        const summary = (bill.summary || bill.committee || "").toLowerCase();
        return name.includes(q) || proposer.includes(q) || summary.includes(q);
      }).slice(0, 30)
    : [];

  const { data: todayBillData } = useQuery<{ date: string; count: number }>({
    queryKey: ["/api/bills/today-count"],
    queryFn: () => apiRequest("GET", "/api/bills/today-count").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const todayBillCount = todayBillData?.count ?? 0;

  const { data: hotDiscussionPost } = useQuery<any>({
    queryKey: ["/api/community/hot-discussion", "bill"],
    queryFn: () => apiRequest("GET", "/api/community/hot-discussion?tagType=bill").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newsData, isLoading: newsLoading } = useQuery<any>({
    queryKey: ["/api/news", "bill"],
    queryFn: () => apiRequest("GET", "/api/news?category=bill").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
  });
  const newsItems = newsData?.items?.slice(0, 5) || [];
  const [selectedNews, setSelectedNews] = useState<{ title: string; url: string; source: string } | null>(null);

  const FILTER_CATEGORIES = ["전체", "경제", "복지", "환경", "교육"];
  const [filterCat, setFilterCat] = useState("전체");

  const latestBills = [...bills]
    .filter((b) => b.proposedDate)
    .sort((a, b) => (a.proposedDate < b.proposedDate ? 1 : a.proposedDate > b.proposedDate ? -1 : 0))
    .slice(0, 5);

  const topMembers = (() => {
    if (!bills.length || !members.length) return members.slice(0, 8);
    const sortedBills = [...bills].sort((a, b) => (b.proposedDate || "").localeCompare(a.proposedDate || ""));
    const recentProposers = new Set<string>();
    const result: any[] = [];
    for (const bill of sortedBills) {
      if (!bill.proposer) continue;
      let proposerName = bill.proposer.split("(")[0].trim();
      proposerName = proposerName.replace(/(의원)?\s*등.*$/, "").trim();
      proposerName = proposerName.replace(/의원$/, "").trim();
      if (!recentProposers.has(proposerName)) {
        const member = members.find((m) => m.name === proposerName);
        if (member) {
          recentProposers.add(proposerName);
          result.push(member);
        }
      }
      if (result.length >= 8) break;
    }
    if (result.length < 8) {
      const remaining = members.filter((m) => !recentProposers.has(m.name)).slice(0, 8 - result.length);
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

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const getCategoryKeywords = (cat: string) => {
    switch (cat) {
      case "경제": return ["기재", "기획재정", "산업", "산자", "정무", "국토", "교통", "경제", "조세"];
      case "복지": return ["보건", "복지", "여가", "여성가족", "연금", "노인", "아동"];
      case "환경": return ["환경", "노동", "환노", "기후", "탄소", "생태"];
      case "교육": return ["교육", "학교", "학생", "교원", "대학"];
      default: return [];
    }
  };

  const filteredBills = bills.filter((bill: any) => {
    if (filterCat === "전체") return true;
    const keywords = getCategoryKeywords(filterCat);
    const committee = bill.summary || bill.committee || "";
    const name = bill.name || bill.billName || "";
    return keywords.some((k) => committee.includes(k) || name.includes(k));
  }).slice(0, 10);

  const highlight = (text: string) => {
    if (!searchQuery.trim()) return text;
    const q = searchQuery.trim();
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-primary/20 text-primary rounded px-0.5">{text.slice(i, i + q.length)}</mark>
        {text.slice(i + q.length)}
      </>
    );
  };

  const hotSlice = hotBills.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black font-sans text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/80 backdrop-blur-2xl pt-[env(safe-area-inset-top)]">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${searchFocused ? "text-primary" : "text-muted-foreground"}`} />
              <input
                className={`w-full h-10 pl-9 pr-9 rounded-xl text-[15px] outline-none placeholder:text-muted-foreground font-medium text-foreground transition-all duration-200 ${
                  searchFocused
                    ? "bg-white dark:bg-[#1C1C1E] ring-2 ring-primary/30 shadow-sm"
                    : "bg-black/5 dark:bg-white/10 ring-2 ring-transparent"
                }`}
                placeholder="법안 검색..."
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/10 dark:bg-white/15 active:scale-90 transition-transform"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
            {user ? (
              <Link href="/more">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-sm cursor-pointer shrink-0 active:opacity-70">
                  {user.name.charAt(0)}
                </div>
              </Link>
            ) : (
              <Link href="/login">
                <button className="text-[14px] font-bold text-primary active:opacity-70 shrink-0">로그인</button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 py-3 space-y-5 pb-[calc(80px+env(safe-area-inset-bottom))]">

        {/* ===== 검색 결과 ===== */}
        {isSearching ? (
          <section className="space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
            {/* 최근 검색어 chips */}
            {!historyLoading && searchHistory.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {searchHistory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSearchQuery(item.query)}
                    className="px-3 py-1.5 bg-white dark:bg-[#1C1C1E] rounded-full text-[12px] font-medium text-foreground shadow-sm shrink-0 active:opacity-70 flex items-center gap-1"
                  >
                    {item.query}
                    <span
                      className="text-muted-foreground/50 ml-0.5"
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                    >
                      ×
                    </span>
                  </button>
                ))}
                <button onClick={handleDeleteAll} className="text-[12px] font-bold text-primary shrink-0 active:opacity-70 px-2">
                  전체삭제
                </button>
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <span className="text-[13px] font-bold text-muted-foreground">
                {billsLoading ? "검색 중..." : `총 ${searchResults.length}건`}
              </span>
              <button onClick={handleClearSearch} className="text-[13px] font-bold text-primary active:opacity-70">
                취소
              </button>
            </div>

            {billsLoading ? (
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                {[1, 2, 3, 4, 5].map((i, idx, arr) => (
                  <div key={i}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="h-3 w-1/2 rounded" />
                      </div>
                    </div>
                    {idx < arr.length - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-14" />}
                  </div>
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm p-8 flex flex-col items-center gap-2 text-muted-foreground">
                <Search className="w-8 h-8 opacity-30" />
                <p className="text-[14px] font-bold">결과가 없습니다</p>
                <p className="text-[12px] opacity-70">다른 키워드로 검색해 보세요</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                {searchResults.map((bill: any, idx: number) => {
                  const sl = statusLabel(bill.status);
                  const billName = bill.name || bill.billName || "이름 없는 법안";
                  const committee = bill.summary || bill.committee || "";
                  return (
                    <div key={bill.id || bill.billId || idx}>
                      <div
                        onClick={() => navigate(`/bills/${bill.id || bill.billId}/vote`)}
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/5 dark:active:bg-white/10"
                      >
                        <span className="text-xl w-8 text-center shrink-0">{getBillEmoji(billName, committee)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-foreground line-clamp-1 leading-snug">{highlight(billName)}</p>
                          <p className="text-[11px] mt-1 flex items-center gap-1.5">
                            <StatusBadge label={sl} />
                            {committee && <span className="text-muted-foreground truncate">{committee}</span>}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      </div>
                      {idx < searchResults.length - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-14" />}
                    </div>
                  );
                })}
                {searchResults.length === 30 && (
                  <p className="text-center text-[11px] text-muted-foreground py-3">상위 30건만 표시됩니다</p>
                )}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* ===== 법안 관련 뉴스 ===== */}
            <section>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-[15px] font-bold text-foreground flex items-center gap-1.5">
                  <Newspaper className="w-4 h-4 text-sky-500" />
                  법안 관련 뉴스
                </h2>
                <Link href="/news" className="text-[12px] text-muted-foreground active:opacity-70">더보기</Link>
              </div>

              {newsLoading ? (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                  {[1, 2, 3].map((i, idx, arr) => (
                    <div key={i}>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-full rounded" />
                          <Skeleton className="h-3 w-1/2 rounded" />
                        </div>
                      </div>
                      {idx < arr.length - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-[72px]" />}
                    </div>
                  ))}
                </div>
              ) : newsItems.length > 0 ? (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                  {newsItems.map((item: any, i: number) => (
                    <div key={i}>
                      <div
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer active:opacity-70"
                        onClick={() => setSelectedNews({ title: item.title, url: item.link, source: item.source })}
                      >
                        {item.thumbnail ? (
                          <img
                            src={withApiBase(item.thumbnail)}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0">
                            <Newspaper className="w-5 h-5 text-muted-foreground/35" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">{item.title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${SOURCE_COLORS[item.sourceCode] ?? "bg-muted text-muted-foreground border-border/30"}`}>
                              {item.source}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {newsTimeAgo(item.pubDate)}
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                      </div>
                      {i < newsItems.length - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-[72px]" />}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            {/* Community Box — full width, above bills */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-[14px] font-bold text-foreground">커뮤니티 토론</span>
                </div>
                <Link href="/community">
                  <span className="text-[11px] text-primary font-medium">전체보기</span>
                </Link>
              </div>
              {hotDiscussionPost ? (
                <Link href={`/community/${hotDiscussionPost.id}`}>
                  <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3.5 active:opacity-70 cursor-pointer">
                    <p className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">{hotDiscussionPost.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      지금 가장 활발한 토론
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3.5">
                  <p className="text-[12px] text-muted-foreground/60 text-center py-1">새 토론이 없습니다.</p>
                </div>
              )}
            </div>

            {/* Main Content Layout: Bills on left, Stats on right */}
            <div className="flex gap-4 items-start">

              {/* Left Column: Bills */}
              <div className="flex-1 min-w-0 space-y-5">

                {/* ===== 인기 법안 Top 3 ===== */}
                <section>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h2 className="text-[15px] font-bold text-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-rose-500" />
                      인기 법안
                    </h2>
                    <span className="text-[11px] text-muted-foreground">뉴스 언급 기반</span>
                  </div>

                  {hotBillsLoading ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                      {[1, 2, 3].map((i, idx, arr) => (
                        <div key={i}>
                          <div className="px-3 py-2.5 flex items-center gap-2.5">
                            <Skeleton className="w-3 h-3 rounded shrink-0" />
                            <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-1">
                              <Skeleton className="h-3 w-3/4 rounded" />
                              <Skeleton className="h-2 w-1/2 rounded" />
                            </div>
                          </div>
                          {idx < arr.length - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-[52px]" />}
                        </div>
                      ))}
                    </div>
                  ) : hotBillsError || hotBills.length === 0 ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm p-4 flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertCircle className="w-5 h-5 opacity-50" />
                      <p className="text-[12px] font-medium">데이터 없음</p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                      {hotSlice.slice(0, 3).map((bill: any, idx: number) => {
                        const sl = statusLabel(bill.result);
                        return (
                          <div key={bill.billId}>
                            <div
                              onClick={() => navigate(`/bills/${bill.billId}/vote`)}
                              className="px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/5 dark:active:bg-white/10"
                            >
                              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-black shrink-0 ${RANK_STYLES[idx] ?? "bg-black/5 text-muted-foreground"}`}>
                                {idx + 1}
                              </span>
                              <span className="text-base w-6 text-center shrink-0">{getBillEmoji(bill.billName, bill.committee)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-foreground line-clamp-1 leading-snug">{bill.billName}</p>
                                <p className="text-[10px] mt-1 flex items-center gap-1.5">
                                  <StatusBadge label={sl} />
                                  {bill.committee && <span className="text-muted-foreground truncate">{bill.committee}</span>}
                                </p>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                            </div>
                            {idx < Math.min(hotSlice.length, 3) - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-[52px]" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* ===== 최신 발의된 법안 Top 3 ===== */}
                <section>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h2 className="text-[15px] font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      최신 발의
                    </h2>
                    <span className="text-[11px] text-muted-foreground">발의일 최신순</span>
                  </div>

                  {billsLoading ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                      {[1, 2, 3].map((i, idx, arr) => (
                        <div key={i}>
                          <div className="px-3 py-2.5 flex items-center gap-2.5">
                            <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-1">
                              <Skeleton className="h-3 w-3/4 rounded" />
                              <Skeleton className="h-2 w-1/2 rounded" />
                            </div>
                          </div>
                          {idx < arr.length - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-[42px]" />}
                        </div>
                      ))}
                    </div>
                  ) : latestBills.length === 0 ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm p-4 flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertCircle className="w-5 h-5 opacity-50" />
                      <p className="text-[12px] font-medium">데이터 없음</p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                      {latestBills.slice(0, 3).map((bill, idx) => {
                        const sl = statusLabel(bill.status);
                        return (
                          <div key={bill.id}>
                            <div
                              onClick={() => navigate(`/bills/${bill.id}/vote`)}
                              className="px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/5 dark:active:bg-white/10"
                            >
                              <span className="text-base w-6 text-center shrink-0">{getBillEmoji(bill.name, bill.summary)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-foreground line-clamp-1 leading-snug">{bill.name}</p>
                                <p className="text-[10px] mt-1 flex items-center gap-1.5">
                                  <StatusBadge label={sl} />
                                  {bill.proposer && <span className="text-muted-foreground truncate">{bill.proposer.split("(")[0].trim()}</span>}
                                </p>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                            </div>
                            {idx < Math.min(latestBills.length, 3) - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-[42px]" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column: Stats */}
              <div className="w-[110px] shrink-0 flex flex-col gap-2">
                <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm p-3 flex flex-col items-center gap-1.5 justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                  <p className="text-[10px] text-muted-foreground font-medium text-center">오늘 발의</p>
                  <p className="text-[16px] font-bold text-foreground leading-none">
                    {todayBillCount}<span className="text-[10px] font-medium text-muted-foreground ml-0.5">건</span>
                  </p>
                </div>

                {hotDiscussionPost ? (
                  <Link href={`/community/${hotDiscussionPost.id}`}>
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm p-3 flex flex-col items-center gap-1.5 justify-center active:opacity-70 cursor-pointer">
                      <MessageSquare className="w-4 h-4 text-rose-500" />
                      <p className="text-[10px] text-muted-foreground font-medium text-center">활발한 토론</p>
                      <p className="text-[11px] font-bold text-foreground line-clamp-2 text-center leading-snug">{hotDiscussionPost.title}</p>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm p-3 flex flex-col items-center gap-1.5 justify-center">
                    <MessageSquare className="w-4 h-4 text-rose-500" />
                    <p className="text-[10px] text-muted-foreground font-medium text-center">활발한 토론</p>
                    <p className="text-[11px] font-bold text-muted-foreground text-center">없음</p>
                  </div>
                )}
                {/* ===== 최근 대표발의한 의원 (Right Column) ===== */}
                <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[11px] font-bold text-foreground">발의 의원</h3>
                    <Link href="/members" className="text-[10px] text-primary">전체</Link>
                  </div>
                  <div className="flex flex-col gap-3">
                    {membersLoading ? (
                      [1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <Skeleton className="w-10 h-10 rounded-full" />
                          <Skeleton className="w-10 h-2 rounded" />
                        </div>
                      ))
                    ) : (
                      topMembers.slice(0, 3).map((member) => (
                        <Link
                          key={member.id}
                          href={`/members/${member.id}`}
                          className="flex flex-col items-center gap-1 active:opacity-70 cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full border-2 border-primary/20 overflow-hidden bg-muted flex items-center justify-center">
                            {member.photo ? (
                              <img src={withApiBase(member.photo)} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[12px] font-bold text-muted-foreground">{member.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="text-center w-full">
                            <p className="text-[11px] font-semibold text-foreground truncate">{member.name}</p>
                            <p className="text-[9px] text-muted-foreground truncate leading-none mt-0.5">
                              {(member.party || "").replace("민주당", "민주").replace("국민의힘", "국힘")}
                            </p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>


            {/* ===== 카테고리별 법안 탐색 ===== */}
            <section>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-[15px] font-bold text-foreground flex items-center gap-1.5">
                  <LayoutGrid className="w-4 h-4 text-teal-500" />
                  카테고리별 탐색
                </h2>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
                {FILTER_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={`px-4 py-1.5 rounded-full text-[13px] font-bold shrink-0 active:opacity-70 ${
                      filterCat === cat
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-white dark:bg-[#1C1C1E] text-foreground shadow-sm"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {billsLoading ? (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                  {[1, 2, 3, 4, 5].map((i, idx, arr) => (
                    <div key={i}>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-3/4 rounded" />
                          <Skeleton className="h-3 w-1/2 rounded" />
                        </div>
                      </div>
                      {idx < arr.length - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-14" />}
                    </div>
                  ))}
                </div>
              ) : filteredBills.length === 0 ? (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm p-6 flex flex-col items-center gap-2 text-muted-foreground">
                  <FileText className="w-6 h-6 opacity-50" />
                  <p className="text-[13px] font-medium">해당 카테고리의 법안이 없습니다</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                  {filteredBills.map((bill: any, idx: number) => {
                    const sl = statusLabel(bill.status);
                    const billName = bill.name || bill.billName || "이름 없는 법안";
                    const committee = bill.summary || bill.committee || "";
                    return (
                      <div key={bill.id || `filtered-${idx}`}>
                        <div
                          onClick={() => navigate(`/bills/${bill.id || bill.billId}/vote`)}
                          className="px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/5 dark:active:bg-white/10"
                        >
                          <span className="text-lg w-8 text-center shrink-0">{getBillEmoji(billName, committee)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-foreground line-clamp-1 leading-snug">{billName}</p>
                            <p className="text-[11px] mt-1 flex items-center gap-1.5">
                              <StatusBadge label={sl} />
                              <span className="text-muted-foreground truncate">
                                {[committee, bill.proposer && bill.proposer.split("(")[0].trim()].filter(Boolean).join(" · ")}
                              </span>
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        </div>
                        {idx < filteredBills.length - 1 && <div className="h-px bg-black/5 dark:bg-white/10 ml-14" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </>
        )}
      </main>

      <NewsAnalysisDialog
        isOpen={!!selectedNews}
        onOpenChange={(open) => !open && setSelectedNews(null)}
        news={selectedNews}
      />
    </div>
  );
}
