import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { useMutation } from "@tanstack/react-query";
import {
  Users, UserCheck, Search, BarChart3, ChevronRight,
  Bell, CircleHelp, LogOut,
  UserCircle2, Moon, Sun, Vote, Bookmark, Award, ShieldCheck, Edit3, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BADGE_LABELS } from "@shared/schema";
import { useAssemblyMembers } from "@/lib/api-data";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Star, StarOff } from "lucide-react";

const politicsMenu = [
  { icon: Users, title: "국회의원", description: "의원 프로필 및 투표 기록", href: "/members", color: "bg-blue-500", shadow: "shadow-blue-500/20" },
  { icon: UserCheck, title: "후보자", description: "각종 후보자 비교 분석", href: "/candidates", color: "bg-amber-500", shadow: "shadow-amber-500/20" },
  { icon: Search, title: "법안 검색", description: "법안별 의원 투표 현황", href: "/bills", color: "bg-emerald-500", shadow: "shadow-emerald-500/20" },
  { icon: BarChart3, title: "객관적 평가", description: "데이터 기반 국회의원 종합 평가", href: "/evaluation", color: "bg-purple-500", shadow: "shadow-purple-500/20" },
];

const customerMenu = [
  { icon: Bell, title: "공지사항", href: "#", color: "bg-slate-400", shadow: "shadow-slate-400/20" },
  { icon: CircleHelp, title: "자주 묻는 질문", href: "#", color: "bg-slate-400", shadow: "shadow-slate-400/20" },
];

export default function More() {
  const { user, isLoading, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const verifyVoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/verify-vote", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "투표 인증 완료! 🗳️", description: data.message });
    },
    onError: () => {
      toast({ title: "오류", description: "투표 인증 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const [showRealNameModal, setShowRealNameModal] = useState(false);
  const [realNameInput, setRealNameInput] = useState("");
  const [nicknameInput, setNicknameInput] = useState(user?.nickname || "");

  const verifyRealNameMutation = useMutation({
    mutationFn: async (realName: string) => {
      const res = await apiRequest("POST", "/api/auth/verify-realname", { realName });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "실명 인증 완료! ✅", description: data.message });
      setShowRealNameModal(false);
      setRealNameInput("");
    },
    onError: (err: any) => {
      toast({ title: "오류", description: err.message || "실명인증 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const updateNicknameMutation = useMutation({
    mutationFn: async (nickname: string) => {
      const res = await apiRequest("PATCH", "/api/users/nickname", { nickname });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "닉네임 변경 완료", description: "닉네임이 업데이트되었습니다." });
    },
    onError: (err: any) => {
      toast({ title: "변경 불가", description: err.message || "닉네임 변경 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const { members = [] } = useAssemblyMembers();
  
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const currentFavorites = (user as any)?.favorites || [];
      const isFav = currentFavorites.includes(memberId);
      const updatedFavorites = isFav 
        ? currentFavorites.filter((id: string) => id !== memberId)
        : [...currentFavorites, memberId];
        
      const res = await apiRequest("PATCH", "/api/auth/favorites", { favorites: updatedFavorites });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      toast({ title: "오류", description: "즐겨찾기 업데이트 중 오류가 발생했습니다.", variant: "destructive" });
    }
  });

  const filteredMembers = searchQuery 
    ? members.filter(m => m.name.includes(searchQuery) || m.party.includes(searchQuery)).slice(0, 10)
    : [];

  const favoriteIds = (user as any)?.favorites || [];
  const favoriteMembers = members.filter(m => favoriteIds.includes(m.id));

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-20">
      <div className="max-w-lg mx-auto">
      
        {/* 헤더 타이틀 */}
        <div className="pt-10 pb-5 px-6">
          <motion.h1 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="text-[28px] font-black text-slate-900 tracking-tight"
            data-testid="text-page-title-more"
          >
            마이페이지
          </motion.h1>
        </div>

        {/* 프로필 / 로그인 배너 */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="px-5 mb-7"
        >
          <div className="bg-card rounded-[1.5rem] p-6 shadow-sm border border-border/40">
            {isLoading ? (
              <div className="h-16 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : user ? (
              <div className="flex items-center gap-4">
                <div className="w-[60px] h-[60px] rounded-[1.25rem] bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                  <span className="text-white text-[22px] font-black">{user.name.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-[19px] font-extrabold text-slate-900 tracking-tight">{user.name} 님</h2>
                  <p className="text-[14px] font-medium text-slate-500 mt-0.5">환영합니다! 슬기로운 유권자님</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-[60px] h-[60px] rounded-[1.25rem] bg-slate-100 flex items-center justify-center shrink-0">
                    <UserCircle2 className="w-8 h-8 text-slate-400 stroke-[1.5]" />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-extrabold text-slate-900 tracking-tight">로그인이 필요해요</h2>
                    <p className="text-[13px] font-medium text-slate-500 mt-0.5">커뮤니티와 투표 기능을 사용해보세요</p>
                  </div>
                </div>
                <Link href="/login">
                  <Button className="rounded-xl shadow-md bg-slate-900 hover:bg-slate-800 shrink-0 tracking-wide font-bold px-4 h-11">
                    로그인
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* 배지 & 투표 인증 (로그인 시만 표시) */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="px-5 mb-7"
          >
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-3">내 활동 & 배지</h3>
            <div className="bg-card rounded-[1.5rem] shadow-sm border border-border/40 overflow-hidden">
              {/* 배지 현황 */}
              <div className="p-4 border-b border-border/20">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-slate-700">보유 배지</span>
                  <span className="ml-auto text-xs text-muted-foreground">글 {user.postCount}개 작성</span>
                </div>
                {user.badges.length === 0 ? (
                  <p className="text-xs text-muted-foreground">아직 획득한 배지가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.badges.map((b) => {
                      const info = BADGE_LABELS[b];
                      if (!info) return null;
                      return (
                        <span
                          key={b}
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${info.color}`}
                        >
                          {info.emoji} {info.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  글 10개 → ⭐ 활동왕 · 글 50개 → 🏅 베테랑 · 투표 인증 → 🗳️ 투표인증
                </p>
              </div>

              {/* 투표 인증 */}
              <div className="p-4 border-b border-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Vote className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">투표 인증</p>
                      <p className="text-xs text-muted-foreground">
                        {user.voteVerified ? "인증 완료 ✓" : "투표했다면 인증해 이름 옆에 배지가 달려요"}
                      </p>
                    </div>
                  </div>
                  {user.voteVerified ? (
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                      🗳️ 인증됨
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      disabled={verifyVoteMutation.isPending}
                      onClick={() => verifyVoteMutation.mutate()}
                    >
                      {verifyVoteMutation.isPending ? "처리 중..." : "인증하기"}
                    </Button>
                  )}
                </div>
              </div>

              {/* 닉네임 설정 */}
              <div className="p-4 border-b border-border/20">
                <div className="flex items-center gap-2 mb-3">
                  <Edit3 className="w-4 h-4 text-violet-500" />
                  <p className="text-sm font-bold text-slate-700">닉네임</p>
                  {user.nickname && (
                    <span className="ml-auto text-xs text-slate-400">현재: <span className="font-bold text-slate-600">{user.nickname}</span></span>
                  )}
                </div>
                {(() => {
                  // 7일 제한 체크
                  const nextAvailable = user.nicknameUpdatedAt
                    ? new Date(new Date(user.nicknameUpdatedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
                    : null;
                  const canChange = !nextAvailable || Date.now() >= nextAvailable.getTime();
                  return (
                    <div className="flex gap-2">
                      <Input
                        placeholder={canChange ? "닉네임 입력 (2~20자)" : `${nextAvailable?.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 이후 변경 가능`}
                        className="h-9 text-sm border-slate-200 bg-white"
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        disabled={!canChange}
                        maxLength={20}
                      />
                      <Button
                        size="sm"
                        className="h-9 px-3 text-xs font-bold shrink-0"
                        disabled={!canChange || !nicknameInput.trim() || updateNicknameMutation.isPending}
                        onClick={() => updateNicknameMutation.mutate(nicknameInput.trim())}
                      >
                        {updateNicknameMutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  );
                })()}
              </div>

              {/* 실명 인증 */}
              <div className="p-4 border-b border-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">실명 인증</p>
                      <p className="text-xs text-muted-foreground">
                        {user.realNameVerified ? "실명 인증 완료 – 게시글에 실명 배지 표시" : "실명으로 게시글을 작성할 수 있어요"}
                      </p>
                    </div>
                  </div>
                  {user.realNameVerified ? (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                      🔵 실명인증 완료
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                      onClick={() => setShowRealNameModal(true)}
                    >
                      실명인증 하기
                    </Button>
                  )}
                </div>
              </div>

              {/* 북마크 게시글 바로가기 */}
              <Link href="/community/bookmarks">
                <div className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                  <Bookmark className="w-4 h-4 text-slate-500" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">북마크한 게시글</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </div>
          </motion.div>
        )}

        {/* 실명 인증 모달 */}
        <AnimatePresence>
          {showRealNameModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setShowRealNameModal(false); }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900">실명 인증</h3>
                  <button onClick={() => setShowRealNameModal(false)}>
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <p className="text-sm text-slate-500 mb-4">실명을 입력하세요. 인증 후 게시글에 "파란 실명 배지" 가 표시됩니다.</p>
                <Input
                  placeholder="실제 이름 (2자 이상)"
                  className="mb-4 h-11"
                  value={realNameInput}
                  onChange={(e) => setRealNameInput(e.target.value)}
                  maxLength={20}
                />
                <Button
                  className="w-full h-11 font-bold"
                  disabled={realNameInput.trim().length < 2 || verifyRealNameMutation.isPending}
                  onClick={() => verifyRealNameMutation.mutate(realNameInput.trim())}
                >
                  {verifyRealNameMutation.isPending ? "인증 중..." : "인증하기"}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 즐겨찾기 관리 (로그인 시만 표시) */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.09 }}
            className="px-5 mb-7"
          >
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-3">즐겨찾는 의원 관리</h3>
            <div className="bg-card rounded-[1.5rem] shadow-sm border border-border/40 overflow-hidden">
              <div className="p-4 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="의원 이름 또는 정당 검색..."
                    className="pl-9 h-11 bg-white border-slate-200 rounded-xl text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                {filteredMembers.length > 0 && (
                  <div className="mt-3 bg-white border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 max-h-[200px] overflow-y-auto shadow-inner">
                    {filteredMembers.map(m => {
                      const isFav = favoriteIds.includes(m.id);
                      return (
                        <div key={m.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-400 shrink-0 overflow-hidden border border-slate-200">
                              {m.photo ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" /> : m.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-bold text-slate-800 tracking-tight">{m.name}</p>
                              <p className="text-[11px] font-medium text-slate-400 truncate">{m.party} · {m.district}</p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant={isFav ? "ghost" : "outline"} 
                            className={`h-8 w-8 p-0 rounded-lg ${isFav ? "text-amber-500" : "text-slate-300"}`}
                            onClick={() => toggleFavoriteMutation.mutate(m.id)}
                            disabled={toggleFavoriteMutation.isPending}
                          >
                            <Star className={`w-4 h-4 ${isFav ? "fill-amber-500" : ""}`} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="divide-y divide-border/10">
                {favoriteMembers.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-xs font-bold text-slate-300">즐겨찾는 의원이 없습니다.</p>
                  </div>
                ) : (
                  favoriteMembers.map((m) => (
                    <div key={m.id} className="p-4 flex items-center justify-between group bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400 overflow-hidden">
                          {m.photo ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" /> : m.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{m.name}</p>
                          <p className="text-[11px] font-bold text-slate-400">{m.party}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleFavoriteMutation.mutate(m.id)}
                        disabled={toggleFavoriteMutation.isPending}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <StarOff className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 첫번째 메뉴 그룹: 정치 데이터 */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="px-5 mb-7"
        >
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-3">정치 데이터</h3>
          <div className="bg-card rounded-[1.5rem] shadow-sm border border-border/40 overflow-hidden divide-y divide-border/20">
            {politicsMenu.map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer group active:bg-slate-100">
                  <div className={`w-11 h-11 rounded-[0.85rem] flex items-center justify-center shrink-0 text-white shadow-md ${item.color} ${item.shadow}`}>
                    <item.icon className="w-[22px] h-[22px] stroke-[2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-[16px] text-slate-800 tracking-tight">{item.title}</p>
                    <p className="text-[13px] font-medium text-slate-400 mt-0.5">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* 두번째 메뉴 그룹: 설정 및 고객센터 */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="px-5 mb-8"
        >
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-3">고객지원 & 설정</h3>
          <div className="bg-card rounded-[1.5rem] shadow-sm border border-border/40 overflow-hidden divide-y divide-border/20">
            {customerMenu.map((item, idx) => (
              <button key={idx} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer group text-left active:bg-slate-100">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm ${item.color} ${item.shadow}`}>
                  <item.icon className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] text-slate-700 tracking-tight">{item.title}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
            
            {/* 다크 모드 토글 스위치 (인라인 디자인) */}
            <div className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors group text-left">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm bg-slate-800 shadow-slate-800/20">
                {theme === "dark" ? <Moon className="w-4 h-4 stroke-[2]" /> : <Sun className="w-4 h-4 stroke-[2]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] text-slate-700 tracking-tight">다크 모드</p>
              </div>
              <div 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 relative ${theme === 'dark' ? 'bg-primary' : 'bg-slate-200'}`}
              >
                <div 
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </div>
            </div>
            
          </div>
        </motion.div>

        {/* 로그아웃 및 하단 정보 */}
        {user ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="px-8 flex flex-col items-center pb-8"
          >
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-red-500 font-extrabold hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              <LogOut className="w-[18px] h-[18px] stroke-[2.5]" />
              <span className="text-[15px]">로그아웃</span>
            </button>
            
            <p className="text-[11px] font-bold text-slate-300 mt-6 text-center leading-relaxed">
              Iyu v1.0.0<br />
              © 2026 Iyu. All rights reserved.
            </p>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="px-8 flex flex-col items-center pb-8"
          >
            <p className="text-[11px] font-bold text-slate-300 mt-6 text-center leading-relaxed">
              Iyu v1.0.0<br />
              © 2026 Iyu. All rights reserved.
            </p>
          </motion.div>
        )}

      </div>
    </div>
  );
}
