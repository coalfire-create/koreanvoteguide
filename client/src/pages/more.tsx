import { useState } from "react";
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
} from "lucide-react";
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
          className="flex-1 bg-[#6320EE] hover:bg-[#5415D0] text-white rounded-xl h-12 font-bold"
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
          className="w-full h-12 bg-[#6320EE] hover:bg-[#5415D0] text-white rounded-xl font-bold"
          disabled={mutation.isPending || value.trim().length < 2}
          onClick={() => mutation.mutate(value.trim())}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "변경하기"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

export default function More() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [nicknameSheetOpen, setNicknameSheetOpen] = useState(false);

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
    <div className="min-h-screen bg-[#F8F9FB] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-100/50">
        <h1 className="text-xl font-bold text-gray-900">마이페이지</h1>
        {user && (
          <button
            onClick={() => setNicknameSheetOpen(true)}
            className="p-2 text-gray-400 hover:text-indigo-500 transition-colors rounded-xl hover:bg-indigo-50"
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
            className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <Avatar className="w-[88px] h-[88px] border-4 border-indigo-50">
                    <AvatarFallback className="bg-indigo-100 text-indigo-600 text-2xl font-bold">
                      {displayName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold text-gray-900">{displayName} 님</h2>
                    {user.voteVerified && (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-full border border-emerald-100">
                        투표인증
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">@{user.username}</p>
                </div>
              </div>
              <button
                onClick={() => setNicknameSheetOpen(true)}
                className="flex items-center gap-1.5 bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                수정
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-50">
              <div className="text-center space-y-1">
                <p className="text-xl font-bold text-gray-900">{favoriteMemberIds.length}</p>
                <p className="text-[12px] font-medium text-gray-400">관심 의원</p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xl font-bold text-gray-900">
                  {activityQuery.isLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : votedBills.length}
                </p>
                <p className="text-[12px] font-medium text-gray-400">참여 투표</p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xl font-bold text-gray-900">
                  {activityQuery.isLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (activity?.comments?.length ?? 0) + (activity?.posts?.length ?? 0)}
                </p>
                <p className="text-[12px] font-medium text-gray-400">작성 글</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 관심 의원 */}
        {user && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">관심 의원</h3>
              <Link href="/members">
                <span className="text-xs font-semibold text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer">전체보기</span>
              </Link>
            </div>
            <div className="flex items-center gap-5 overflow-x-auto pb-2 no-scrollbar">
              {favoriteMembers.length === 0 && !members.length ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 shrink-0">
                    <div className="w-[68px] h-[68px] rounded-full bg-gray-100 animate-pulse" />
                    <div className="w-12 h-3 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))
              ) : favoriteMembers.length > 0 ? (
                favoriteMembers.map((member) => (
                  <Link key={member.id} href={`/members/${member.id}`}>
                    <div className="flex flex-col items-center gap-3 shrink-0 cursor-pointer group">
                      <div className="w-[68px] h-[68px] rounded-full overflow-hidden border-2 border-transparent group-hover:border-indigo-200 transition-all shadow-sm bg-gray-100">
                        <PoliticianPhoto
                          name={member.name}
                          monaCd={member.id}
                          photo={member.photo}
                          avatarClassName="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 text-xl font-bold"
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600 tracking-tight">{member.name}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-4 text-sm text-gray-400">
                  아직 관심 의원이 없습니다.{" "}
                  <Link href="/members"><span className="text-indigo-500 font-bold cursor-pointer">의원 탐색하기</span></Link>
                </div>
              )}
              <Link href="/members">
                <div className="flex flex-col items-center gap-3 shrink-0 cursor-pointer">
                  <div className="w-[68px] h-[68px] rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-indigo-300 hover:text-indigo-300 transition-all">
                    <Plus className="w-8 h-8 stroke-[1.5]" />
                  </div>
                  <span className="text-xs font-bold text-gray-300">추가</span>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* 내 투표 결과 */}
        {user && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">내 투표 결과</h3>
              <Link href="/bills">
                <span className="text-xs font-semibold text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer">전체보기</span>
              </Link>
            </div>

            {activityQuery.isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[24px] p-6 h-24 animate-pulse border border-gray-50" />
              ))
            ) : recentVotes.length === 0 ? (
              <div className="bg-white rounded-[24px] p-6 text-center text-sm text-gray-400 border border-gray-50">
                아직 투표한 법안이 없습니다.{" "}
                <Link href="/bills"><span className="text-indigo-500 font-bold cursor-pointer">법안 보기</span></Link>
              </div>
            ) : (
              recentVotes.map((vote, idx) => {
                const isAgree = vote.opinion === "agree";
                return (
                  <motion.div
                    key={vote.id ?? idx}
                    whileHover={{ y: -2 }}
                    className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <h4 className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2">
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
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">최근 활동</h3>
              <Link href="/community">
                <span className="text-xs font-semibold text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer">커뮤니티</span>
              </Link>
            </div>

            {activityQuery.isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[20px] p-5 h-20 animate-pulse border border-gray-50" />
              ))
            ) : recentActivities.length === 0 ? (
              <div className="bg-white rounded-[24px] p-6 text-center text-sm text-gray-400 border border-gray-50">
                아직 활동 내역이 없습니다.
              </div>
            ) : (
              recentActivities.map((act, idx) => (
                <motion.div
                  key={idx}
                  className="bg-white rounded-[20px] p-5 flex items-center gap-4 shadow-[0_4px_15px_rgb(0,0,0,0.02)] border border-gray-50"
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    act.type === "post" ? "bg-indigo-50" : "bg-gray-50"
                  }`}>
                    {act.type === "post"
                      ? <FileText className="w-5 h-5 text-indigo-500" />
                      : <MessageSquare className="w-5 h-5 text-gray-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-[13px] text-gray-700 leading-snug truncate">
                      {act.type === "post" ? (
                        <><span className="font-bold text-indigo-500">게시글</span> {act.text}</>
                      ) : (
                        <><span className="font-bold">댓글:</span> {act.text}</>
                      )}
                    </p>
                    <p className="text-[11px] font-medium text-gray-300">{timeAgo(act.time)}</p>
                  </div>
                </motion.div>
              ))
            )}
          </section>
        )}

        {/* 설정 */}
        <section className="space-y-4 pb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">설정</h3>
          <div className="bg-white rounded-[28px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-gray-50 divide-y divide-gray-50 overflow-hidden">
            {/* 지역 설정 */}
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors text-left group"
              onClick={() => setLocation("/onboarding")}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-[15px] font-bold text-gray-700">지역 설정</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-200 group-hover:text-indigo-400 transition-colors" />
            </button>

            {/* 공지사항 */}
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors text-left group"
              onClick={() => toast({ title: "공지사항", description: "현재 등록된 공지사항이 없습니다." })}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                  <Bell className="w-5 h-5" />
                </div>
                <span className="text-[15px] font-bold text-gray-700">공지사항</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-200 group-hover:text-indigo-400 transition-colors" />
            </button>

            {/* FAQ */}
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors text-left group"
              onClick={() => toast({ title: "자주 묻는 질문", description: "준비 중입니다. 문의: coalfireant@gmail.com" })}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                  <CircleHelp className="w-5 h-5" />
                </div>
                <span className="text-[15px] font-bold text-gray-700">자주 묻는 질문</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-200 group-hover:text-indigo-400 transition-colors" />
            </button>

            {/* 다크모드 */}
            <div className="w-full flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#1D1E2C] flex items-center justify-center text-white">
                  {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <span className="text-[15px] font-bold text-gray-700">다크 모드</span>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                className="data-[state=checked]:bg-indigo-500"
              />
            </div>

            {/* 로그아웃 (로그인된 경우만) */}
            {user && (
              <button
                className="w-full flex items-center justify-between p-5 hover:bg-red-50/40 transition-colors text-left group"
                onClick={handleLogout}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-400">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <span className="text-[15px] font-bold text-red-400">로그아웃</span>
                </div>
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
