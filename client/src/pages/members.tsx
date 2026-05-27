import { Link } from "wouter";
import { useState, useMemo } from "react";
import {
  Search, Users, ChevronDown, FileText, Vote, Sparkles,
  UserPlus, UserCheck, Heart, Compass, Rss, TrendingUp, Newspaper,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAssemblyMembers } from "@/lib/api-data";
import { getPartyRank } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { withApiBase } from "@/lib/api-base";
import { LoginPrompt } from "@/components/LoginPrompt";
import { motion, AnimatePresence } from "framer-motion";
import { StoryFeed } from "@/components/StoryFeed";
import { NewsAnalysisDialog } from "@/components/news-analysis-dialog";

// ─── 피드 타입 ──────────────────────────────────────────────────────────────
interface FeedItem {
  type: "bill" | "vote";
  id: string;
  politicianId: string;
  politicianName: string;
  party: string | null;
  photo: string | null;
  title: string;
  summary: string;
  subtitle: string;
  billId: string;
  occurredAt: string;
  isRecommended: boolean;
  voteResult?: string;
}
interface TimelineResponse {
  items: FeedItem[];
  followCount: number;
  hasMore: boolean;
}
interface FollowsResponse {
  follows: { id: string; name: string }[];
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceCode: string;
  thumbnail?: string;
  summary?: string;
}

// ─── 당색 ──────────────────────────────────────────────────────────────────
function partyChip(party: string | null | undefined): string {
  const p = party ?? "";
  if (p.includes("민주당")) return "bg-blue-50 text-blue-600 border-blue-100";
  if (p.includes("국민의힘")) return "bg-red-50 text-red-600 border-red-100";
  if (p.includes("조국혁신당")) return "bg-indigo-50 text-indigo-700 border-indigo-100";
  if (p.includes("개혁신당")) return "bg-orange-50 text-orange-600 border-orange-100";
  if (p.includes("진보당")) return "bg-rose-50 text-rose-600 border-rose-100";
  return "bg-gray-50 text-gray-500 border-gray-100";
}


function voteColor(result?: string): string {
  if (!result) return "bg-gray-100 text-gray-600";
  if (result.includes("찬성")) return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  if (result.includes("반대")) return "bg-red-50 text-red-600 border border-red-100";
  if (result.includes("기권") || result.includes("불참")) return "bg-amber-50 text-amber-600 border border-amber-100";
  return "bg-gray-50 text-gray-500 border border-gray-100";
}

// ─── 피드 카드 (인스타 포스트 스타일) ───────────────────────────────────────
function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const isVote = item.type === "vote";
  return (
    <article
      className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden"
    >
      {/* 헤더: 작성자 */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <Link href={`/members/${item.politicianId}`} className="shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-gray-50">
            <PoliticianPhoto
              name={item.politicianName}
              photo={item.photo ?? undefined}
              monaCd={item.politicianId}
              context={item.party ?? undefined}
              avatarClassName="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold"
            />
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={`/members/${item.politicianId}`}>
              <span className="text-[14px] font-bold text-foreground hover:text-primary transition-colors truncate">
                {item.politicianName}
              </span>
            </Link>
            {item.isRecommended && (
              <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                추천
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${partyChip(item.party)}`}>
              {item.party || "무소속"}
            </span>
            <span className="text-[11px] text-muted-foreground/30">·</span>
            <span className="text-[11px] text-muted-foreground font-medium">{timeAgo(item.occurredAt)}</span>
          </div>
        </div>
        <span
          className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${
            isVote ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
          }`}
        >
          {isVote ? <Vote className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
          {isVote ? "표결" : "법안발의"}
        </span>
      </div>

      {/* 본문 */}
      <div className="px-4 pb-4">
        <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3.5">
          <p className="text-[14px] font-bold text-foreground leading-snug line-clamp-2">
            {item.title}
          </p>
          {item.summary && item.summary !== item.title && (
            <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-2 line-clamp-3">
              {item.summary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {isVote && item.voteResult && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${voteColor(item.voteResult)}`}>
                {item.voteResult}
              </span>
            )}
            {item.subtitle && (
              <span className="text-[11px] font-medium text-muted-foreground">{item.subtitle}</span>
            )}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div className="flex items-center border-t border-black/5 dark:border-white/10">
        <Link
          href={`/members/${item.politicianId}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-muted-foreground active:bg-black/5 dark:active:bg-white/5 transition-colors"
        >
          <Users className="w-3.5 h-3.5" /> 의원 프로필
        </Link>
        <div className="w-px h-5 bg-black/5 dark:bg-white/10" />
        <Link
          href={`/bills?q=${encodeURIComponent(item.title)}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-muted-foreground active:bg-black/5 dark:active:bg-white/5 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" /> 법안 보기
        </Link>
      </div>
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  );
}

export default function Members() {
  const [tab, setTab] = useState<"feed" | "discover">("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParty, setSelectedParty] = useState("전체");
  const [visibleCount, setVisibleCount] = useState(12);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [selectedNews, setSelectedNews] = useState<{ title: string; url: string; source: string } | null>(null);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { members, isLoading } = useAssemblyMembers();

  interface TrendingMember {
    id: string; name: string; party: string; district: string;
    photo: string; primaryKeyword: string;
    recentNewsCount: number; profileViewCount: number; followerCount: number; score: number;
  }
  const { data: trendingRaw } = useQuery<{ success: boolean; data: TrendingMember[] }>({
    queryKey: ["/api/trending-members"],
    queryFn: () => fetch("/api/trending-members").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
  });
  const trendingMembers = trendingRaw?.data ?? [];

  // 팔로우 타임라인 (인스타 피드)
  const { data: timeline, isLoading: feedLoading } = useQuery<TimelineResponse>({
    queryKey: ["/api/feed/timeline"],
    queryFn: () => fetch("/api/feed/timeline?limit=30").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  // 팔로우 없을 때 보여줄 국회의원 뉴스
  const followCount = timeline?.followCount ?? 0;
  const { data: memberNewsData } = useQuery<{ items: NewsItem[] }>({
    queryKey: ["/api/news", "member"],
    queryFn: () => fetch("/api/news?category=member").then((r) => r.json()),
    enabled: followCount === 0,
    staleTime: 5 * 60 * 1000,
  });

  // 내 팔로우 목록 → 팔로우 여부 판단
  const { data: followsData } = useQuery<FollowsResponse>({
    queryKey: ["/api/users/me/follows"],
    enabled: !!user,
    staleTime: 60 * 1000,
  });
  const followedSet = useMemo(
    () => new Set((followsData?.follows ?? []).map((f) => f.id)),
    [followsData],
  );

  const followMutation = useMutation({
    mutationFn: async ({ id, follow }: { id: string; follow: boolean }) => {
      const method = follow ? "POST" : "DELETE";
      const res = await apiRequest(method, `/api/users/me/follows/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/follows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed/timeline"] });
    },
  });

  const handleFollow = (id: string) => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    followMutation.mutate({ id, follow: !followedSet.has(id) });
  };

  const parties = useMemo(
    () => [
      "전체",
      ...Array.from(new Set(members.map((m) => m.party))).sort(
        (a, b) => getPartyRank(a) - getPartyRank(b),
      ),
    ],
    [members],
  );

  const filtered = useMemo(
    () =>
      members
        .filter((m) => {
          const q =
            m.name.includes(searchQuery) ||
            m.party.includes(searchQuery) ||
            m.district.includes(searchQuery);
          const p = selectedParty === "전체" || m.party === selectedParty;
          return q && p;
        })
        .sort((a, b) => {
          // 전체 탭: 이름(가나다)순 — 특정 정당만 보면 쏠리지 않게
          if (selectedParty === "전체" && !searchQuery) return a.name.localeCompare(b.name, "ko");
          return getPartyRank(a.party) - getPartyRank(b.party);
        }),
    [members, searchQuery, selectedParty],
  );
  const visibleMembers = filtered.slice(0, visibleCount);

  const feedItems = timeline?.items ?? [];

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] font-sans text-foreground">
      {/* ── 상단 헤더 ── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/80 backdrop-blur-2xl">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[22px] font-bold text-foreground">인물</h1>
            <Link href="/more">
              <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-muted-foreground active:opacity-70">
                <Heart className="w-4 h-4" />
              </div>
            </Link>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full h-10 pl-10 pr-4 bg-black/5 dark:bg-white/10 rounded-xl text-[14px] outline-none placeholder:text-muted-foreground font-medium text-foreground"
              placeholder="국회의원 이름·정당·지역구 검색"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) setTab("discover");
                setVisibleCount(12);
              }}
            />
          </div>

          {/* 탭 */}
          <div className="flex items-center bg-black/5 dark:bg-white/10 rounded-xl p-1 mt-3">
            {[
              { key: "feed", label: "팔로우 피드", icon: Rss },
              { key: "discover", label: "탐색", icon: Compass },
            ].map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key as "feed" | "discover")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold transition-all active:opacity-70 ${
                    active
                      ? "bg-white dark:bg-[#2C2C2E] text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4 pb-[calc(80px+env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          {tab === "feed" ? (
            <motion.div
              key="feed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* 스토리 (관심 의원) */}
              <StoryFeed className="mb-4" />

              {/* 피드 */}
              {feedLoading ? (
                <div className="space-y-5">
                  <FeedSkeleton />
                  <FeedSkeleton />
                  <FeedSkeleton />
                </div>
              ) : feedItems.length === 0 ? (
                <div className="space-y-4">
                  {/* 최근 국회 뉴스 스토리 */}
                  {memberNewsData && memberNewsData.items.length > 0 && (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-5 pt-5 pb-3">
                        <div className="flex items-center gap-2">
                          <Newspaper className="w-4 h-4 text-muted-foreground" />
                          <span className="text-[14px] font-bold text-foreground">최근 국회 뉴스</span>
                        </div>
                        <Link href="/news">
                          <span className="text-[12px] text-muted-foreground">전체보기</span>
                        </Link>
                      </div>
                      {/* 가로 스크롤 스토리 카드 */}
                      <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 pb-5 -mx-0">
                        {memberNewsData.items.slice(0, 10).map((item, i) => {
                          const sourceInitial = item.source.slice(0, 2);
                          const sourceColors = [
                            "bg-blue-500", "bg-rose-500", "bg-emerald-500",
                            "bg-amber-500", "bg-violet-500", "bg-cyan-500",
                            "bg-orange-500", "bg-teal-500", "bg-fuchsia-500", "bg-lime-600",
                          ];
                          const color = sourceColors[i % sourceColors.length];
                          const diff = Date.now() - new Date(item.pubDate).getTime();
                          const hours = Math.floor(diff / 3600000);
                          const timeStr = hours < 1 ? "방금" : hours < 24 ? `${hours}시간 전` : `${Math.floor(hours / 24)}일 전`;
                          return (
                            <button
                              key={i}
                              onClick={() => setSelectedNews({ title: item.title, url: item.link, source: item.source })}
                              className="shrink-0 w-[140px] flex flex-col gap-2 active:opacity-70 transition-opacity text-left"
                            >
                              <div className={`w-full h-[90px] rounded-xl ${color} flex items-center justify-center relative overflow-hidden`}>
                                {item.thumbnail ? (
                                  <img src={withApiBase(item.thumbnail)} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-white text-[22px] font-black opacity-90">{sourceInitial}</span>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 h-[45px] bg-gradient-to-t from-black/50 to-transparent" />
                                <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white/90">{item.source}</span>
                              </div>
                              <div>
                                <p className="text-[12px] font-semibold text-foreground leading-snug line-clamp-2">{item.title}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{timeStr}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* 팔로우 유도 */}
                  <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm py-8 px-6 text-center space-y-3">
                    <p className="text-[15px] font-bold text-foreground">관심 의원을 팔로우해보세요</p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      법안 발의·표결 활동이<br />여기 피드에 모입니다.
                    </p>
                    <button
                      onClick={() => setTab("discover")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-[14px] font-bold active:opacity-80"
                    >
                      <Compass className="w-4 h-4" /> 의원 탐색하기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {!user && (
                    <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-5 text-primary-foreground flex items-center gap-4">
                      <Sparkles className="w-8 h-8 shrink-0" />
                      <div className="flex-1">
                        <p className="text-[14px] font-black">로그인하고 나만의 피드를 만드세요</p>
                        <p className="text-[12px] text-primary-foreground/80 font-medium mt-0.5">
                          지금은 추천 활동을 보여드리고 있어요.
                        </p>
                      </div>
                      <Link href="/login">
                        <span className="px-4 py-2 bg-background text-primary rounded-xl text-[12px] font-black whitespace-nowrap">
                          로그인
                        </span>
                      </Link>
                    </div>
                  )}
                  {feedItems.map((item, i) => (
                    <FeedCard key={item.id} item={item} index={i} />
                  ))}
                  <p className="text-center text-[12px] text-gray-300 font-medium pt-2">
                    팔로우한 의원의 활동을 모아 보여드려요
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* ── 요즘 핫한 의원 ── */}
              {trendingMembers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-[9px] bg-orange-50 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                    <span className="text-[14px] font-black text-foreground">요즘 핫한 의원</span>
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2 }}
                      className="text-sm leading-none"
                    >
                      🔥
                    </motion.span>
                    <span className="text-[11px] text-muted-foreground ml-1">이번 주 급상승</span>
                  </div>

                  <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1">
                    {trendingMembers.map((m, i) => {
                      const rankColors = ["#f59e0b", "#94a3b8", "#cd7c43", "#a1a1aa", "#a1a1aa"];
                      const trendLabel =
                        m.recentNewsCount > 0 ? `뉴스 ${m.recentNewsCount}건`
                        : m.profileViewCount > 0 ? `조회 ${m.profileViewCount.toLocaleString()}`
                        : m.followerCount > 0 ? `팔로워 ${m.followerCount}명`
                        : "주목 의원";
                      return (
                        <div key={m.id} className="shrink-0">
                          <Link href={`/members/${m.id}`}>
                            <div className="w-[100px] bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm p-3 flex flex-col items-center active:opacity-70 transition-opacity">
                              {/* Rank badge */}
                              <div className="relative w-full flex justify-end mb-1.5">
                                <span
                                  className="text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ color: rankColors[i] ?? "#a1a1aa", background: `${rankColors[i] ?? "#a1a1aa"}18` }}
                                >
                                  {i + 1}
                                </span>
                              </div>
                              {/* Photo */}
                              <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-border/40 shadow-sm mb-2.5">
                                <PoliticianPhoto
                                  name={m.name}
                                  photo={m.photo}
                                  monaCd={m.id}
                                  context={m.party}
                                  className="w-full h-full object-cover"
                                  avatarClassName="w-full h-full flex items-center justify-center bg-muted text-muted-foreground/40 text-[18px] font-black"
                                />
                              </div>
                              {/* Name */}
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-[13px] font-black text-foreground truncate">{m.name}</span>
                                {i === 0 && (
                                  <motion.span
                                    animate={{ scale: [1, 1.15, 1] }}
                                    transition={{ duration: 1.2, repeat: Infinity }}
                                    className="text-[10px] leading-none"
                                  >🔥</motion.span>
                                )}
                              </div>
                              {/* Party */}
                              <span className="text-[9px] font-bold truncate w-full text-center text-muted-foreground">
                                {m.party.replace("더불어", "").replace("당", "당")}
                              </span>
                              {/* Trend */}
                              <div className="flex items-center gap-0.5 mt-1.5">
                                <TrendingUp className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                                <span className="text-[9px] font-bold text-orange-500 truncate">{trendLabel}</span>
                              </div>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 정당 필터 */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-3 px-3">
                {parties.map((p) => {
                  const active = selectedParty === p;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setSelectedParty(p);
                        setVisibleCount(12);
                      }}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all active:opacity-70 ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-white dark:bg-[#1C1C1E] text-muted-foreground shadow-sm"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              {/* 의원 그리드 */}
              <div className="grid grid-cols-2 gap-3">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] bg-white dark:bg-[#1C1C1E] rounded-2xl animate-pulse shadow-sm"
                    />
                  ))
                ) : visibleMembers.length > 0 ? (
                  visibleMembers.map((m, idx) => {
                    const followed = followedSet.has(m.id);
                    return (
                      <div
                        key={m.id}
                        className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm p-4 flex flex-col items-center"
                      >
                        <Link
                          href={`/members/${m.id}`}
                          className="w-18 h-18 rounded-full overflow-hidden mb-2.5 active:opacity-70"
                        >
                          <div className="w-[72px] h-[72px] rounded-full overflow-hidden">
                            <PoliticianPhoto
                              name={m.name}
                              photo={m.photo}
                              monaCd={m.id}
                              context={[m.party, m.district, "국회의원"].filter(Boolean).join(" ")}
                              className="w-full h-full object-cover"
                              avatarClassName="text-[22px] font-bold bg-muted text-muted-foreground/40"
                            />
                          </div>
                        </Link>
                        <Link href={`/members/${m.id}`}>
                          <h3 className="text-[14px] font-bold text-foreground text-center">
                            {m.name}
                          </h3>
                        </Link>
                        <div className="flex flex-col items-center gap-0.5 mt-1 mb-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${partyChip(m.party)}`}>
                            {m.party.replace('더불어', '').replace('당', '')}
                          </span>
                          <span className="text-[11px] text-muted-foreground text-center line-clamp-1">
                            {m.district}
                          </span>
                        </div>
                        <button
                          onClick={() => handleFollow(m.id)}
                          disabled={followMutation.isPending}
                          className={`w-full py-2 rounded-full text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 active:opacity-70 disabled:opacity-60 ${
                            followed
                              ? "bg-black/5 dark:bg-white/10 text-muted-foreground"
                              : "bg-primary text-primary-foreground shadow-sm"
                          }`}
                        >
                          {followed ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" /> 팔로잉
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" /> 팔로우
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-20 text-center space-y-3">
                    <Users className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground font-medium">조건에 맞는 의원이 없습니다.</p>
                    <button
                      onClick={() => {
                        setSelectedParty("전체");
                        setSearchQuery("");
                      }}
                      className="text-primary font-bold hover:underline text-[13px]"
                    >
                      필터 초기화
                    </button>
                  </div>
                )}
              </div>

              {filtered.length > visibleCount && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setVisibleCount((v) => v + 12)}
                    className="px-8 py-3 bg-card border border-border/30 text-foreground rounded-2xl text-[13px] font-bold hover:bg-muted/50 transition-all shadow-sm flex items-center gap-2 group"
                  >
                    더 많은 의원 보기
                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <LoginPrompt isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />
      <NewsAnalysisDialog
        isOpen={!!selectedNews}
        onOpenChange={(open) => !open && setSelectedNews(null)}
        news={selectedNews}
      />
    </div>
  );
}
