import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, TrendingUp, PenSquare, X, Lock, Shield, ChevronRight, ArrowUp,
  MessageCircle, Eye, ThumbsUp, CheckCircle2, ChevronDown, ChevronUp
} from "lucide-react";

import { useAssemblyMembers } from "@/lib/api-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { CommunityPost } from "@shared/schema";
import { BADGE_LABELS, BADGE_THEMES } from "@shared/schema";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatRelativeTime(d: string | Date): string {
  if (!d) return "";
  try {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "방금";
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  } catch { return ""; }
}

function AuthorBadgesInline({ badges }: { badges: string[] }) {
  if (!badges?.length) return null;
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {badges.map((b) => {
        const info = BADGE_LABELS[b];
        if (!info) return null;
        return (
          <span key={b} className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${info.color}`}>
            {info.emoji} {info.label}
          </span>
        );
      })}
    </span>
  );
}

// 뱃지 전용 테마 탭 구성
const FEED_TABS = [
  { key: "all", label: "전체", icon: null, badge: null },
  { key: "vote_verified_theme", label: "투표 인증자", icon: "🗳️", badge: "vote_verified" },
  { key: "real_name_verified_theme", label: "실명 인증자", icon: "✅", badge: "real_name_verified" },
];

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { members } = useAssemblyMembers();

  const [activeTab, setActiveTab] = useState("all");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [showRealName, setShowRealName] = useState(false);
  const [themeAccessError, setThemeAccessError] = useState<string | null>(null);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [activeRecentTab, setActiveRecentTab] = useState<"recent" | "favorites">("recent");
  const userBadges = user ? (user as any).badges ?? [] : [];
  const isRealNameVerified = userBadges.includes("real_name_verified") || (user as any)?.phoneVerified;

  // 실시간 인기 의원
  const { data: trending = [] } = useQuery<{ memberId: string; name: string; count: number }[]>({
    queryKey: ["/api/members/trending"],
    refetchInterval: 30000,
  });

  // 게시글 쿼리 (탭에 따라 theme 쿼리스트링 전달)
  const postsQueryKey = activeTab === "all"
    ? ["/api/community/posts"]
    : ["/api/community/posts", { theme: activeTab }];

  const { data: posts = [], isLoading: postsLoading, error: postsError } = useQuery<(CommunityPost & { commentCount: number; displayName: string; authorBadges: string[] })[]>({
    queryKey: postsQueryKey,
    queryFn: async () => {
      const url = activeTab === "all"
        ? "/api/community/posts"
        : `/api/community/posts?theme=${activeTab}`;
      const res = await apiRequest("GET", url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "접근 권한이 없습니다");
      }
      return res.json();
    },
    retry: false,
  });

  const trendingWithDetails = trending
    .map((t) => {
      const member = members.find((m) => m.id === t.memberId);
      return member ? { ...t, member } : null;
    })
    .filter(Boolean) as any[];

  const topTrending = trendingWithDetails.slice(0, 5);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/community/posts", {
        title: writeTitle,
        content: writeContent,
        boardType: "open",
        category: "자유",
        showRealName,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      toast({ title: "게시글 작성 완료", description: "성공적으로 등록되었습니다." });
      setWriteTitle("");
      setWriteContent("");
      setShowRealName(false);
      setIsWriteOpen(false);
    },
  });

  const handleMemberClick = async (memberId: string, memberName: string) => {
    apiRequest("POST", `/api/members/${memberId}/click`, { name: memberName }).catch(() => {});
    navigate(`/members/${memberId}`);
  };

  const handleTabChange = (tabKey: string) => {
    setThemeAccessError(null);
    setActiveTab(tabKey);
  };

  const isThemeLocked = (tabKey: string) => {
    if (tabKey === "all") return false;
    const themeConfig = BADGE_THEMES[tabKey];
    if (!themeConfig) return false;
    if (!user) return true;
    // 실명인증 뱃지는 phoneVerified로 자동 체크
    if (themeConfig.badge === "real_name_verified" && (user as any)?.phoneVerified) return false;
    return !userBadges.includes(themeConfig.badge);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 font-sans pb-20">

      {/* 상단 통합 검색 영역 */}
      <div className="bg-[#425091] px-3 pb-3">
        <div className="relative">
          <input 
            type="text" 
            placeholder="의원 및 통합검색" 
            className="w-full h-10 bg-white rounded-sm pl-3 pr-10 text-[15px] font-medium outline-none placeholder:text-slate-400"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#425091] stroke-[2]" />
        </div>
      </div>

      {/* 최근 방문 및 즐겨찾기 탭 */}
      <div className="flex border-b border-slate-300 bg-[#5b6aab] text-white">
        <button 
          onClick={() => {
            if (activeRecentTab === "recent" && isRecentOpen) {
              setIsRecentOpen(false);
            } else {
              setActiveRecentTab("recent");
              setIsRecentOpen(true);
            }
          }}
          className={`flex-1 py-3 text-[14px] font-medium border-r border-[#6c7cbd] flex items-center justify-center gap-1 transition-colors ${
            activeRecentTab === "recent" && isRecentOpen ? "bg-black/10" : ""
          }`}
        >
          최근 방문
          {isRecentOpen && activeRecentTab === "recent" ? <ChevronUp className="w-3.5 h-3.5 opacity-70" /> : <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
        </button>
        <button 
          onClick={() => {
            if (activeRecentTab === "favorites" && isRecentOpen) {
              setIsRecentOpen(false);
            } else {
              setActiveRecentTab("favorites");
              setIsRecentOpen(true);
            }
          }}
          className={`flex-1 py-3 text-[14px] font-medium flex items-center justify-center gap-1 transition-colors ${
            activeRecentTab === "favorites" && isRecentOpen ? "bg-black/10" : ""
          }`}
        >
          즐겨찾기
          {isRecentOpen && activeRecentTab === "favorites" ? <ChevronUp className="w-3.5 h-3.5 opacity-70" /> : <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
        </button>
      </div>
      
      <AnimatePresence>
        {isRecentOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white border-b border-slate-300"
          >
            {activeRecentTab === "recent" ? (
              <div className="py-12 text-center text-slate-600 text-[14px] font-medium tracking-tight border-t-[0.5px] border-black/10">
                최근 방문 목록이 없습니다.
              </div>
            ) : (
              <div className="bg-slate-50/50">
                {(() => {
                  const favIds = (user as any)?.favorites || [];
                  const favoritedMembers = members.filter(m => favIds.includes(m.id));
                  
                  if (favoritedMembers.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <p className="text-slate-500 text-[13px] font-medium mb-2">즐겨찾는 의원이 없습니다.</p>
                        <p className="text-slate-400 text-[11px]">마이페이지에서 관심 의원을 설정해보세요.</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="grid grid-cols-1 divide-y divide-slate-100">
                      {favoritedMembers.map(member => (
                        <Link key={member.id} href={`/members/${member.id}`}>
                          <div className="px-4 py-3 flex items-center gap-3 active:bg-slate-100 transition-colors">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold shrink-0 overflow-hidden text-xs border border-slate-200">
                              {member.photo ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-bold text-slate-800">{member.name}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-sm">{member.party}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{member.district} · {member.committee}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 실시간 인기 리스트 영역 (실북갤 스타일) */}
      <div className="bg-white border-b border-slate-300">
        <div className="flex border-b border-slate-300/80 bg-white">
          <div className="px-4 py-3 bg-[#425091] text-white text-[13px] font-bold shrink-0">실시간 인기</div>
          <div className="flex items-center w-full px-2 overflow-x-auto scrollbar-hide text-[14px] text-slate-400 font-medium">
             <span className="mx-3 shrink-0 py-3">자유</span>
             <span className="mx-3 shrink-0 py-3">토론</span>
             <span className="mx-3 shrink-0 py-3">투표</span>
             <span className="mx-3 shrink-0 py-3">의원게시판</span>
          </div>
        </div>
        
        {topTrending.length > 0 && (
          <div className="py-2.5">
            {topTrending.slice(0, 5).map((item, idx) => (
               <button
                 key={item.memberId}
                 onClick={() => handleMemberClick(item.memberId, item.name)}
                 className="w-full flex items-center px-4 py-2 hover:bg-slate-50 transition-colors group cursor-pointer"
               >
                 <span className="w-6 font-bold text-red-600 text-[15px] text-left">{idx + 1}.</span>
                 <span className="font-semibold text-slate-900 text-[15px]">{item.member.name}</span>
                 <span className="text-slate-400 text-[13px] ml-1">정치인</span>
                 <span className="ml-auto text-slate-400 text-[13px] flex items-center gap-1 font-medium">
                   {item.count} <ArrowUp className="w-3.5 h-3.5 text-red-500 stroke-[3]" />
                 </span>
               </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-2 bg-slate-100 border-b border-slate-200"></div>

      <div className="bg-white w-full">
        {/* 실시간 베스트 헤더 */}
        <div className="flex rounded-md mx-3 mt-4 mb-2 overflow-hidden border border-slate-100">
           <div className="flex-1 py-4 flex items-center justify-center gap-1.5 bg-slate-50/50">
               <div className="w-5 h-5 bg-[#425091] rounded-full text-white text-[12px] font-bold flex items-center justify-center">I</div>
               <span className="text-[16px] font-bold text-[#425091]">실시간 베스트</span>
           </div>
        </div>

        {/* 2. 탭 영역 */}
        <div className="flex items-center w-full border-b border-slate-300">
          {FEED_TABS.map((tab) => {
            const locked = isThemeLocked(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-3 text-[14px] font-bold transition-colors ${
                  isActive
                      ? "text-[#425091] border-b-[3px] border-[#425091]"
                      : locked
                      ? "text-slate-400 border-b-[3px] border-transparent cursor-pointer"
                      : "text-slate-600 border-b-[3px] border-transparent hover:bg-slate-50"
                }`}
              >
                {tab.label}
                {locked && <Lock className="w-3 h-3 ml-0.5 opacity-40" />}
              </button>
            );
          })}
        </div>

        {/* 우측 글쓰기 툴바 (디시의 버튼 형태) */}
        {!isWriteOpen && !postsError && (
          <div className="flex justify-end px-3 py-2 border-b border-slate-200 bg-slate-50/50">
             <button
               onClick={() => setIsWriteOpen(!isWriteOpen)}
               className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold text-white bg-[#425091] rounded hover:bg-[#323f7a] transition-colors"
             >
               <PenSquare className="w-4 h-4" />
               글쓰기
             </button>
          </div>
        )}

        {/* 뱃지 접근 오류 또는 테마 잠금 안내 */}
        <AnimatePresence>
          {postsError && activeTab !== "all" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-5 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 text-center"
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-slate-200/50 flex items-center justify-center">
                <Shield className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-[15px] font-extrabold text-slate-700 mb-1.5">프리미엄 라운지</h3>
              <p className="text-[13px] text-slate-500 font-medium leading-relaxed mb-4">
                {(postsError as Error).message}
              </p>
              {!user && (
                <Link href="/login">
                  <Button size="sm" className="rounded-xl font-bold px-6 shadow-md shadow-primary/20">
                    로그인하고 입장하기
                  </Button>
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>



        {/* 글쓰기 확장 패널 */}
        <AnimatePresence>
          {isWriteOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-50 p-4 border-b border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[15px] font-extrabold text-[#425091]">새 글 작성</h3>
                  <button onClick={() => setIsWriteOpen(false)}>
                    <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>
                <Input
                  placeholder="제목을 입력하세요"
                  maxLength={30}
                  value={writeTitle}
                  onChange={(e) => setWriteTitle(e.target.value)}
                  className="mb-3 h-12 text-[15px] font-bold border-slate-200 rounded-sm bg-white"
                />
                <Textarea
                  placeholder="내용을 작성해보세요..."
                  value={writeContent}
                  onChange={(e) => setWriteContent(e.target.value)}
                  className="mb-4 resize-none min-h-[100px] text-[14px] border-slate-200 rounded-sm bg-white"
                />
                {/* 실명 표시 토글 */}
                {isRealNameVerified && (
                  <label className="flex items-center gap-2.5 mb-4 cursor-pointer group">
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        showRealName ? "bg-teal-500 border-teal-500" : "border-slate-300 group-hover:border-teal-400"
                      }`}
                      onClick={() => setShowRealName(!showRealName)}
                    >
                      {showRealName && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <span className="text-[14px] font-bold text-slate-700">실명으로 작성하기</span>
                      <span className="text-[12px] text-teal-600 font-bold ml-1.5">✅ 실명인증</span>
                    </div>
                  </label>
                )}
                <Button
                  onClick={() => {
                    if (!user) { toast({ title: "로그인 필요", description: "글 작성을 위해 로그인해주세요." }); return; }
                    createPostMutation.mutate();
                  }}
                  disabled={!writeTitle.trim() || !writeContent.trim() || createPostMutation.isPending}
                  className="w-full h-12 rounded-sm font-bold text-[15px] bg-[#425091] hover:bg-[#323f7a]"
                >
                  등록
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. 고밀도 리스트 피드 (DC 형태) */}
        <div className="bg-white border-y border-slate-300 divide-y divide-slate-100">
          {postsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="py-2.5 px-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-1.5" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            ))
          ) : !postsError && posts.length > 0 ? (
            posts.slice(0, 40).map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className="w-full text-left py-2.5 px-3 hover:bg-slate-50 transition-colors group flex flex-col gap-1 cursor-pointer"
              >
                <div className="flex flex-col mb-1.5 w-full pr-1">
                  <div className="flex items-start gap-1 justify-between">
                    <h3 className="text-[15px] text-slate-900 line-clamp-2 hover:text-[#425091] transition-colors leading-snug">
                      {post.title}
                    </h3>
                  </div>
                  {(post as any).commentCount > 0 && (
                    <span className="text-[12px] font-medium text-[#425091] mt-0.5">
                      [{((post as any).commentCount)}]
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-[12px] text-slate-500 font-medium tracking-tight mt-0.5">
                  <div className="flex items-center gap-1 line-clamp-1 shrink-0">
                    <span className="truncate max-w-[80px]">{(post as any).displayName || "익명"}</span>
                    <AuthorBadgesInline badges={(post as any).authorBadges || []} />
                  </div>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="shrink-0">{formatRelativeTime(post.createdAt)}</span>
                </div>
              </button>
            ))
          ) : !postsError && (
            <div className="py-12 text-center text-slate-500 text-[13px]">
              등록된 게시글이 없습니다.
            </div>
          )}
        </div>


      </div>

      {/* 인라인 소통 팝업 */}
      <PostDetailDialog postId={selectedPostId} onOpenChange={(open) => { if (!open) setSelectedPostId(null); }} />
    </div>
  );
}
