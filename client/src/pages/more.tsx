import { useState } from "react";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFavorites } from "@/lib/useFavorites";
import { useAssemblyMembers } from "@/lib/api-data";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import {
  Settings, ChevronRight, Bell, CircleHelp, Moon, Sun,
  Plus, MessageSquare, CheckCircle2, LogOut, MapPin,
  Edit3, Loader2, FileText, User, ThumbsUp, ThumbsDown, X,
  Activity, Vote, Sparkles, BadgeCheck, ShieldCheck,
} from "lucide-react";
import { StoryFeed } from "@/components/StoryFeed";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

interface MyActivity {
  posts: { id: string; title: string; content: string; createdAt: string }[];
  comments: { id: string; content: string; postId?: string; createdAt: string }[];
  votedBills: {
    id: number;
    billId: string;
    opinion: "agree" | "disagree";
    billName: string;
    committee: string;
    createdAt: string;
  }[];
}

interface FeedItem {
  type: "bill" | "vote";
  id: string;
  politicianId: string;
  politicianName: string;
  party: string | null;
  photo: string | null;
  title: string;
  subtitle: string;
  billId: string;
  voteResult?: string;
  occurredAt: string;
}

interface FeedResponse {
  items: FeedItem[];
  followCount: number;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function GuestPrompt() {
  const [, setLocation] = useLocation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 text-center space-y-5"
    >
      <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mx-auto">
        <User className="w-9 h-9 text-indigo-400" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-gray-900">로그인이 필요해요</h2>
        <p className="text-sm text-gray-400">관심 의원, 투표 기록, 활동 내역을<br />확인하려면 로그인하세요.</p>
      </div>
      <div className="flex gap-3">
        <Button
          className="flex-1 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-xl h-12 font-bold"
          onClick={() => setLocation("/login")}
        >
          로그인
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-xl h-12 font-bold border-gray-200"
          onClick={() => setLocation("/login")}
        >
          회원가입
        </Button>
      </div>
    </motion.div>
  );
}

function NicknameSheet({
  open, onClose, currentNickname,
}: {
  open: boolean;
  onClose: () => void;
  currentNickname?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(currentNickname || "");

  const mutation = useMutation({
    mutationFn: async (nickname: string) => {
      const res = await apiRequest("PATCH", "/api/users/nickname", { nickname });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "변경 실패");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "닉네임이 변경되었습니다" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "변경 실패", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-[28px] p-6 space-y-5">
        <SheetHeader>
          <SheetTitle className="text-left text-lg font-bold">닉네임 변경</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-gray-400">닉네임은 7일에 한 번만 변경할 수 있어요 (2~20자)</p>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="새 닉네임 입력"
          maxLength={20}
          className="h-12 rounded-xl border-gray-200 text-base"
        />
        <Button
          className="w-full h-12 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-xl font-bold"
          disabled={mutation.isPending || value.trim().length < 2}
          onClick={() => mutation.mutate(value.trim())}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "변경하기"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function formatDemographic(ageGroup?: number | null, gender?: string | null): string | null {
  if (!ageGroup && !gender) return null;
  const parts: string[] = [];
  if (ageGroup) {
    parts.push(ageGroup >= 60 ? "60대 이상" : `${ageGroup}대`);
  }
  if (gender === "M") parts.push("남성");
  else if (gender === "F") parts.push("여성");
  return parts.length > 0 ? parts.join(" • ") : null;
}

export default function More() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleThemeToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setTheme(nextTheme);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme);
      });
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ],
        },
        {
          duration: 450,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [nicknameSheetOpen, setNicknameSheetOpen] = useState(false);

  // ===== 본인인증 모킹 (PortOne/PASS 연동 전 테스트용) =====
  // POST /api/auth/verify-identity 에 고정된 mock payload를 보내 본인확인 콜백 시뮬레이션.
  const verifyIdentityMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/verify-identity", {
        name: "테스터",
        birthDate: "19980515",
        gender: "M",
        ci: `mock_ci_${user?.id ?? "anon"}`,
        provider: "mock_pass",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "본인인증 완료", description: "프로필이 업데이트되었습니다." });
    },
    onError: (err: any) => {
      const raw = String(err?.message || "");
      // apiRequest는 "<status>: <body>" 형식으로 throw — 409면 이미 인증된 계정
      if (raw.startsWith("409")) {
        toast({ title: "이미 인증된 계정입니다.", variant: "destructive" });
        return;
      }
      let detail = raw.replace(/^\d+:\s*/, "") || "본인인증 처리 중 오류가 발생했습니다.";
      try {
        const parsed = JSON.parse(detail);
        if (parsed?.error) detail = parsed.error;
      } catch {}
      toast({ title: "본인인증 실패", description: detail, variant: "destructive" });
    },
  });

  const { favorites } = useFavorites();
  const { members = [] } = useAssemblyMembers();

  const favoriteMemberIds = favorites.filter((f) => f.type === "member").map((f) => f.id);
  const favoriteMembers = members
    .filter((m) => favoriteMemberIds.includes(m.id))
    .slice(0, 5);

  const activityQuery = useQuery<MyActivity>({
    queryKey: ["/api/auth/my-activity"],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // 팔로우한 의원의 실시간 활동 피드
  const feedQuery = useQuery<FeedResponse>({
    queryKey: ["/api/users/me/feed"],
    enabled: !!user,
    staleTime: 60 * 1000,
  });
  const feedItems = feedQuery.data?.items ?? [];
  const followCount = feedQuery.data?.followCount ?? 0;

  const activity = activityQuery.data;
  const votedBills = activity?.votedBills ?? [];
  const recentVotes = votedBills.slice(0, 3);

  const recentActivities = [
    ...(activity?.posts ?? []).map((p) => ({ type: "post" as const, text: p.title, time: p.createdAt })),
    ...(activity?.comments ?? []).map((c) => ({ type: "comment" as const, text: c.content, time: c.createdAt })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 4);

  const displayName = user ? (user.nickname || user.name) : null;

  const handleLogout = async () => {
    await logout();
    toast({ title: "로그아웃 되었습니다" });
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-border/40">
        <h1 className="text-xl font-bold text-foreground">마이페이지</h1>
        {user && (
          <button
            onClick={() => setNicknameSheetOpen(true)}
            className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-xl hover:bg-primary/10"
          >
            <Settings className="w-6 h-6" />
          </button>
        )}
      </header>

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-8">
        {/* Profile or Guest */}
        {!user ? (
          <GuestPrompt />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/30 relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <Avatar className="w-[88px] h-[88px] border-4 border-muted">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {displayName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-4 border-card rounded-full shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold text-foreground">{displayName} 님</h2>
                    {user.realNameVerified && (
                      <BadgeCheck
                        className="w-6 h-6 text-blue-500"
                        aria-label="본인인증 완료"
                        data-testid="verified-badge"
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                  {(() => {
                    const demo = formatDemographic(user.ageGroup, user.gender);
                    return demo ? (
                      <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3" />
                        {demo}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
              <button
                onClick={() => setNicknameSheetOpen(true)}
                className="flex items-center gap-1.5 bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border/40 rounded-xl px-3 py-2 text-sm font-bold transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                수정
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/30">
              <div className="text-center space-y-1">
                <p className="text-xl font-bold text-foreground">{favoriteMemberIds.length}</p>
                <p className="text-[12px] font-medium text-muted-foreground">관심 의원</p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xl font-bold text-foreground">
                  {activityQuery.isLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : votedBills.length}
                </p>
                <p className="text-[12px] font-medium text-muted-foreground">참여 투표</p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xl font-bold text-foreground">
                  {activityQuery.isLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (activity?.comments?.length ?? 0) + (activity?.posts?.length ?? 0)}
                </p>
                <p className="text-[12px] font-medium text-muted-foreground">작성 글</p>
              </div>
            </div>

            {/* ===== 본인인증 (PortOne/PASS 연동 전 mock 테스트 버튼) ===== */}
            <div className="mt-5 pt-5 border-t border-border/30">
              {user.realNameVerified ? (
                <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 border border-blue-100 rounded-2xl py-3 px-4">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[13px] font-bold">본인인증 완료</span>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => verifyIdentityMutation.mutate()}
                  disabled={verifyIdentityMutation.isPending}
                  data-testid="mock-verify-identity"
                  className="w-full h-12 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold shadow-sm flex items-center justify-center gap-2"
                >
                  {verifyIdentityMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  본인인증 하기 (테스트)
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* 관심 의원 — Story 스타일 */}
        {user && (
          <section className="bg-card rounded-[28px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-border/30 py-3 -mx-1">
            <StoryFeed />
          </section>
        )}

        {/* 내 관심 의원 실시간 활동 — 개인화 타임라인 */}
        {user && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-500" />
                내 관심 의원 실시간 활동
              </h3>
              {followCount > 0 && (
                <span className="text-[11px] font-bold text-muted-foreground">
                  {followCount}명 팔로잉
                </span>
              )}
            </div>

            {feedQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card rounded-[24px] p-5 h-24 animate-pulse border border-border/30" />
              ))
            ) : followCount === 0 ? (
              <div className="bg-card rounded-[24px] p-7 text-center border border-border/30 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-50 to-rose-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-fuchsia-500" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground">팔로우한 의원이 없어요</p>
                  <p className="text-[11px] text-muted-foreground mt-1">의원을 팔로우하면 발의·표결 활동이 실시간으로 표시됩니다</p>
                </div>
                <Link href="/members">
                  <button className="text-[12px] font-bold text-white bg-primary hover:opacity-90 transition px-4 py-2 rounded-xl">
                    의원 탐색하기
                  </button>
                </Link>
              </div>
            ) : feedItems.length === 0 ? (
              <div className="bg-card rounded-[24px] p-6 text-center text-sm text-muted-foreground border border-border/30">
                아직 새로운 활동이 없습니다.
              </div>
            ) : (
              feedItems.slice(0, 12).map((item) => {
                const isBill = item.type === "bill";
                const accent = isBill
                  ? "from-indigo-50 to-purple-50 text-indigo-500"
                  : item.voteResult?.includes("찬")
                    ? "from-emerald-50 to-teal-50 text-emerald-500"
                    : "from-orange-50 to-rose-50 text-orange-500";
                return (
                  <motion.div
                    key={item.id}
                    whileHover={{ y: -2 }}
                    className="bg-card rounded-[24px] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/30 flex items-start gap-4"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-2 ring-white shadow-sm bg-gray-100">
                      <PoliticianPhoto
                        name={item.politicianName}
                        monaCd={item.politicianId}
                        photo={item.photo ?? undefined}
                        avatarClassName="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-sm font-bold"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/members/${item.politicianId}`}>
                          <span className="text-[13px] font-bold text-foreground hover:text-primary cursor-pointer">
                            {item.politicianName}
                          </span>
                        </Link>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${accent} text-[10px] font-black uppercase tracking-wide`}>
                          {isBill ? <FileText className="w-2.5 h-2.5" /> : <Vote className="w-2.5 h-2.5" />}
                          {isBill ? "법안 발의" : "표결"}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
                        {item.title}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span className="truncate">{item.subtitle}</span>
                        <span className="shrink-0 ml-2">{timeAgo(item.occurredAt)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </section>
        )}

        {/* 내 투표 결과 */}
        {user && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-foreground tracking-tight">내 투표 결과</h3>
              <Link href="/bills">
                <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer">전체보기</span>
              </Link>
            </div>

            {activityQuery.isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-card rounded-[24px] p-6 h-24 animate-pulse border border-border/30" />
              ))
            ) : recentVotes.length === 0 ? (
              <div className="bg-card rounded-[24px] p-6 text-center text-sm text-muted-foreground border border-border/30">
                아직 투표한 법안이 없습니다.{" "}
                <Link href="/bills"><span className="text-primary font-bold cursor-pointer">법안 보기</span></Link>
              </div>
            ) : (
              recentVotes.map((vote, idx) => {
                const isAgree = vote.opinion === "agree";
                return (
                  <motion.div
                    key={vote.id ?? idx}
                    whileHover={{ y: -2 }}
                    className="bg-card rounded-[24px] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/30"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <h4 className="text-[14px] font-bold text-foreground leading-snug line-clamp-2">
                        {vote.billName}
                      </h4>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-bold shrink-0 ${
                        isAgree
                          ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                          : "text-orange-500 bg-orange-50 border-orange-100"
                      }`}>
                        {isAgree ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                        {isAgree ? "찬성" : "반대"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-300 font-medium">
                      <span>{vote.committee}</span>
                      <span>{timeAgo(vote.createdAt)}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </section>
        )}

        {/* 최근 활동 */}
        {user && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-foreground tracking-tight">최근 활동</h3>
              <Link href="/community">
                <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer">커뮤니티</span>
              </Link>
            </div>

            {activityQuery.isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-card rounded-[20px] p-5 h-20 animate-pulse border border-border/30" />
              ))
            ) : recentActivities.length === 0 ? (
              <div className="bg-card rounded-[24px] p-6 text-center text-sm text-muted-foreground border border-border/30">
                아직 활동 내역이 없습니다.
              </div>
            ) : (
              recentActivities.map((act, idx) => (
                <motion.div
                  key={idx}
                  className="bg-card rounded-[20px] p-5 flex items-center gap-4 shadow-[0_4px_15px_rgb(0,0,0,0.02)] border border-border/30"
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    act.type === "post" ? "bg-primary/10" : "bg-muted"
                  }`}>
                    {act.type === "post"
                      ? <FileText className="w-5 h-5 text-primary" />
                      : <MessageSquare className="w-5 h-5 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-[13px] text-foreground leading-snug truncate">
                      {act.type === "post" ? (
                        <><span className="font-bold text-primary">게시글</span> {act.text}</>
                      ) : (
                        <><span className="font-bold">댓글:</span> {act.text}</>
                      )}
                    </p>
                    <p className="text-[11px] font-medium text-muted-foreground/60">{timeAgo(act.time)}</p>
                  </div>
                </motion.div>
              ))
            )}
          </section>
        )}

        {/* 설정 */}
        <section className="space-y-4 pb-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">설정</h3>
          <div className="bg-card rounded-[28px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-border/30 divide-y divide-border/30 overflow-hidden">
            {/* 지역 설정 */}
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors text-left group"
              onClick={() => setLocation("/onboarding")}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-[15px] font-bold text-foreground">지역 설정</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </button>

            {/* 공지사항 */}
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors text-left group"
              onClick={() => toast({ title: "공지사항", description: "현재 등록된 공지사항이 없습니다." })}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <Bell className="w-5 h-5" />
                </div>
                <span className="text-[15px] font-bold text-foreground">공지사항</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </button>

            {/* FAQ */}
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors text-left group"
              onClick={() => toast({ title: "자주 묻는 질문", description: "준비 중입니다. 문의: coalfireant@gmail.com" })}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <CircleHelp className="w-5 h-5" />
                </div>
                <span className="text-[15px] font-bold text-foreground">자주 묻는 질문</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </button>

            {/* 다크모드 */}
            <div className="w-full flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center text-foreground">
                  {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <span className="text-[15px] font-bold text-foreground">다크 모드</span>
              </div>
              <Switch
                checked={theme === "dark"}
                onClick={handleThemeToggle}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {/* 로그아웃 (로그인된 경우만) */}
            {user && (
              <button
                className="w-full flex items-center justify-between p-5 hover:bg-red-50/40 transition-colors text-left group"
                onClick={handleLogout}
                aria-label="로그아웃"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-400">
                    <LogOut className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="text-[15px] font-bold text-red-400">로그아웃</span>
                </div>
              </button>
            )}
          </div>
        </section>

        {/* 법적 고지 */}
        <section className="space-y-2 pb-4">
          <div className="bg-card rounded-[24px] shadow-[0_4px_15px_rgb(0,0,0,0.02)] border border-border/30 divide-y divide-border/30 overflow-hidden text-sm">
            <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="block px-5 py-4 hover:bg-muted/50 text-muted-foreground">이용약관</a>
            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="block px-5 py-4 hover:bg-muted/50 text-muted-foreground">개인정보처리방침</a>
            {user && (
              <button
                className="w-full text-left px-5 py-4 hover:bg-red-50/40 text-red-500"
                onClick={async () => {
                  if (!confirm("정말 탈퇴하시겠습니까? 식별정보는 즉시 비식별화되며 30일 후 완전 삭제됩니다.")) return;
                  const res = await apiRequest("DELETE", "/api/auth/me");
                  if (res.ok) {
                    toast({ title: "탈퇴가 완료되었습니다" });
                    setLocation("/");
                    window.location.reload();
                  } else {
                    toast({ title: "탈퇴 실패", variant: "destructive" });
                  }
                }}
              >
                회원 탈퇴
              </button>
            )}
          </div>
        </section>
      </div>

      {/* 닉네임 변경 시트 */}
      {user && (
        <NicknameSheet
          open={nicknameSheetOpen}
          onClose={() => setNicknameSheetOpen(false)}
          currentNickname={user.nickname}
        />
      )}
    </div>
  );
}
