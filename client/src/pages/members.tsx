import { Link } from "wouter";
import { useState, useMemo } from "react";
import {
  Search, Users, ChevronDown, FileText, Vote, Sparkles,
  UserPlus, UserCheck, Heart, Compass, Rss,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAssemblyMembers } from "@/lib/api-data";
import { getPartyRank } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { LoginPrompt } from "@/components/LoginPrompt";
import { motion, AnimatePresence } from "framer-motion";
import { StoryFeed } from "@/components/StoryFeed";

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

// ─── 당색 ──────────────────────────────────────────────────────────────────
function partyChip(party: string | null | undefined): string {
  const p = party ?? "";
  if (p.includes("더불어민주당")) return "bg-blue-50 text-blue-600 border-blue-100";
  if (p.includes("국민의힘")) return "bg-red-50 text-red-600 border-red-100";
  if (p.includes("조국혁신당")) return "bg-indigo-50 text-indigo-700 border-indigo-100";
  if (p.includes("개혁신당")) return "bg-orange-50 text-orange-600 border-orange-100";
  if (p.includes("진보당")) return "bg-rose-50 text-rose-600 border-rose-100";
  return "bg-gray-50 text-gray-500 border-gray-100";
}

function timeAgo(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return `${Math.floor(day / 30)}개월 전`;
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
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className="bg-card rounded-3xl border border-border/30 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
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
      <div className="px-5 pb-4">
        <div className="bg-muted/70 rounded-2xl p-4 border border-border/30">
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
      <div className="flex items-center border-t border-border/30">
        <Link
          href={`/members/${item.politicianId}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-bold text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors"
        >
          <Users className="w-3.5 h-3.5" /> 의원 프로필
        </Link>
        <div className="w-px h-5 bg-border/30" />
        <Link
          href={`/bills?q=${encodeURIComponent(item.title)}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-bold text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" /> 법안 보기
        </Link>
      </div>
    </motion.article>
  );
}

function FeedSkeleton() {
  return (
    <div className="bg-card rounded-3xl border border-border/30 p-5 space-y-4">
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

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { members, isLoading } = useAssemblyMembers();

  // 팔로우 타임라인 (인스타 피드)
  const { data: timeline, isLoading: feedLoading } = useQuery<TimelineResponse>({
    queryKey: ["/api/feed/timeline"],
    queryFn: () => fetch("/api/feed/timeline?limit=30").then((r) => r.json()),
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
        .sort((a, b) => getPartyRank(a.party) - getPartyRank(b.party)),
    [members, searchQuery, selectedParty],
  );
  const visibleMembers = filtered.slice(0, visibleCount);

  const feedItems = timeline?.items ?? [];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* ── 상단 헤더 ── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[26px] font-black text-foreground tracking-tight flex items-center gap-2">
              <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-foreground" />
              </span>
              인물
            </h1>
            <Link href="/more">
              <div className="w-9 h-9 rounded-full bg-muted border border-border/30 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                <Heart className="w-4 h-4" />
              </div>
            </Link>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full h-11 pl-11 pr-4 bg-muted border border-border/30 rounded-2xl text-[14px] focus:bg-background focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground font-medium text-foreground"
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
          <div className="flex gap-1 mt-4 -mb-3">
            {[
              { key: "feed", label: "팔로우 피드", icon: Rss },
              { key: "discover", label: "탐색", icon: Compass },
            ].map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key as "feed" | "discover")}
                  className={`relative flex items-center gap-1.5 px-4 py-3 text-[14px] font-bold transition-colors ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {active && (
                    <motion.div
                      layoutId="memberTabUnderline"
                      className="absolute bottom-0 left-3 right-3 h-1 bg-primary rounded-t-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 pb-28">
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
                <div className="bg-card rounded-3xl border border-border/30 py-16 px-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[16px] font-black text-foreground">아직 피드가 비어있어요</p>
                    <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                      관심 있는 의원을 팔로우하면<br />법안 발의·표결 활동이 여기에 모입니다.
                    </p>
                  </div>
                  <button
                    onClick={() => setTab("discover")}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-[14px] font-bold hover:opacity-90 transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    <Compass className="w-4 h-4" /> 의원 탐색하기
                  </button>
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
              {/* 정당 필터 */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                {parties.map((p) => {
                  const active = selectedParty === p;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setSelectedParty(p);
                        setVisibleCount(12);
                      }}
                      className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-bold border transition-all ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-indigo-500/20"
                          : "bg-card text-muted-foreground border-border/30 hover:border-primary/40"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              {/* 의원 그리드 */}
              <div className="grid grid-cols-2 gap-4">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] bg-card rounded-3xl animate-pulse border border-border/30"
                    />
                  ))
                ) : visibleMembers.length > 0 ? (
                  visibleMembers.map((m, idx) => {
                    const followed = followedSet.has(m.id);
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.25) }}
                        className="bg-card rounded-3xl border border-border/30 p-5 flex flex-col items-center hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
                      >
                        <Link
                          href={`/members/${m.id}`}
                          className="w-20 h-20 rounded-full overflow-hidden mb-3 ring-4 ring-muted shadow-sm"
                        >
                          <PoliticianPhoto
                            name={m.name}
                            photo={m.photo}
                            monaCd={m.id}
                            context={m.party}
                            className="w-full h-full object-cover"
                            avatarClassName="text-[22px] font-black bg-muted text-muted-foreground/40"
                          />
                        </Link>
                        <Link href={`/members/${m.id}`}>
                          <h3 className="text-[15px] font-black text-foreground hover:text-primary transition-colors text-center">
                            {m.name}
                          </h3>
                        </Link>
                        <div className="flex flex-col items-center gap-1 mt-1.5 mb-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${partyChip(
                              m.party,
                            )}`}
                          >
                            {m.party}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground text-center line-clamp-1">
                            {m.district}
                          </span>
                        </div>
                        <button
                          onClick={() => handleFollow(m.id)}
                          disabled={followMutation.isPending}
                          className={`w-full py-2.5 rounded-2xl text-[12.5px] font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60 ${
                            followed
                              ? "bg-muted text-muted-foreground border border-border/30"
                              : "bg-primary text-primary-foreground hover:opacity-90 shadow-md shadow-indigo-500/20"
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
                      </motion.div>
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
    </div>
  );
}
