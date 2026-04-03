import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ThumbsUp, ThumbsDown, MessageCircle, PenSquare, Eye, Lock, Globe, Trophy, Star, TrendingUp
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { BADGE_LABELS } from "@shared/schema";
import type { CommunityPost } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { CommunityPoll } from "@/components/CommunityPoll";

type PostWithCount = CommunityPost & {
  commentCount: number;
  authorBadges: string[];
};

const CATEGORIES = ["전체", "자유", "토론", "정보공유", "질문"] as const;

function AuthorBadges({ badges }: { badges: string[] }) {
  if (!badges?.length) return null;
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {badges.map((b) => {
        const info = BADGE_LABELS[b];
        if (!info) return null;
        return (
          <span
            key={b}
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${info.color}`}
          >
            {info.emoji} {info.label}
          </span>
        );
      })}
    </span>
  );
}

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

export default function Community() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const board = params.get("board") || "open";
  const category = params.get("category") || "";
  const sort = params.get("sort") || "latest";

  function setParam(key: string, val: string) {
    const next = new URLSearchParams(search);
    if (!val || val === "전체" || val === "latest") next.delete(key);
    else next.set(key, val);
    navigate(`/community?${next.toString()}`);
  }

  const queryKey = [`/api/community/posts`, board, category, sort];
  const { data: posts, isLoading } = useQuery<PostWithCount[]>({
    queryKey,
    queryFn: () => {
      const p = new URLSearchParams({ board });
      if (category && category !== "전체") p.set("category", category);
      if (sort && sort !== "latest") p.set("sort", sort);
      return apiRequest("GET", `/api/community/posts?${p}`).then((r) => r.json());
    },
    enabled: board !== "members" || !!user,
  });

  function handleWriteClick() {
    if (!user) navigate("/login");
    else navigate(`/community/write?board=${board}`);
  }

  const isMembersBoard = board === "members";

  return (
    <div className="w-full bg-white pb-20">
      
      {/* 초소형 유저 상태 바 */}
      {user && (
         <div className="flex items-center justify-between px-4 py-2 bg-[#f4f5f8] border-b border-slate-200">
            <div className="flex items-center gap-2">
               <span className="text-[12px] font-bold text-[#425091] bg-white px-1.5 py-0.5 rounded border border-[#425091]/20">Lv.3 열혈유권자</span>
               <span className="text-[13px] font-bold text-slate-800">{user.name}</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400">82 XP</div>
         </div>
      )}

      {/* 게시판 탭 (디시 스타일) */}
      <div className="flex w-full border-b border-slate-300">
         <button 
           onClick={() => { const n = new URLSearchParams(); n.set("board", "open"); navigate(`/community?${n}`); }}
           className={`flex-1 py-3 text-[14px] font-bold transition-colors ${board === "open" ? "text-[#425091] border-b-[3px] border-[#425091]" : "text-slate-600 border-b-[3px] border-transparent"}`}
         >
           자유게시판
         </button>
         <button 
           onClick={() => { const n = new URLSearchParams(); n.set("board", "members"); navigate(`/community?${n}`); }}
           className={`flex-1 flex items-center justify-center gap-1 py-3 text-[14px] font-bold transition-colors ${board === "members" ? "text-[#425091] border-b-[3px] border-[#425091]" : "text-slate-600 border-b-[3px] border-transparent"}`}
         >
           회원게시판 {board !== "members" && <Lock className="w-3 h-3 opacity-40 ml-0.5"/>}
         </button>
      </div>

      {/* 회원 게시판 비로그인 차단 */}
      {isMembersBoard && !user ? (
        <div className="py-20 text-center flex flex-col items-center border-b border-slate-200">
           <div className="mx-auto mb-3 text-slate-300"><Lock className="w-10 h-10"/></div>
           <h2 className="text-[16px] font-bold text-slate-700 mb-1">회원전용 게시판입니다</h2>
           <p className="text-[13px] text-slate-500 mb-5">로그인 후 이용할 수 있습니다.</p>
           <Button size="sm" className="bg-[#425091] hover:bg-[#323f7a]" onClick={() => navigate("/login")}>로그인하기</Button>
        </div>
      ) : (
        <div className="w-full">
          {/* 상단 툴바 (필터, 글쓰기 버튼) */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-3 py-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setParam("category", cat)}
                  className={`shrink-0 text-[13px] px-2.5 py-1 rounded-[4px] font-bold transition-colors ${
                    (category || "전체") === cat
                      ? "bg-[#425091] text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:text-[#425091]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
               <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
                 <SelectTrigger className="h-7 border-slate-200 bg-white text-[12px] font-bold px-2 py-0 border-[0.5px]">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="latest" className="text-[12px] font-medium">최신순</SelectItem>
                   <SelectItem value="popular" className="text-[12px] font-medium text-red-600">인기순</SelectItem>
                   <SelectItem value="views" className="text-[12px] font-medium">조회순</SelectItem>
                 </SelectContent>
               </Select>
               <button onClick={handleWriteClick} className="flex items-center gap-1 bg-[#425091] hover:bg-[#323f7a] text-white px-2.5 py-1 text-[12px] font-bold rounded-[4px] transition-colors">
                 <PenSquare className="w-3.5 h-3.5" /> 글쓰기
               </button>
            </div>
          </div>

          {/* 투표 컴포넌트 (초박형으로 표시) */}
          <div className="border-b border-slate-200">
             <CommunityPoll />
          </div>

          {/* 고밀도 리스트 피드 */}
          <div className="bg-white border-b border-slate-300 divide-y divide-slate-100">
            {isLoading ? (
              Array.from({length:5}).map((_, i) => (
                 <div key={i} className="py-2.5 px-3 animate-pulse">
                   <div className="h-4 bg-slate-200 rounded w-2/3 mb-1.5" />
                   <div className="h-3 bg-slate-100 rounded w-1/3" />
                 </div>
              ))
            ) : !posts || posts.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-[13px]">
                 아직 등록된 글이 없습니다.
              </div>
            ) : (
              posts.map((post, idx) => {
                const isHot = sort === "popular" && idx < 2;
                return (
                  <Link key={post.id} href={`/community/${post.id}`}>
                    <div className="w-full text-left py-2.5 px-3 hover:bg-slate-50 transition-colors group flex flex-col gap-1 cursor-pointer">
                      <div className="flex flex-col mb-1.5 w-full pr-1">
                        <div className="flex items-start gap-1 justify-between">
                          <h3 className={`text-[15px] line-clamp-2 hover:text-[#425091] transition-colors leading-snug ${isHot ? 'text-red-600 font-bold' : 'text-slate-900'}`}>
                            {isHot && <span className="text-[12px] bg-red-600 text-white px-1.5 py-0.5 rounded-sm mr-1.5 shadow-sm align-text-bottom">BEST</span>}
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
                          <span className="text-slate-500">{post.category && post.category !== "전체" ? post.category : "자유"}</span>
                          <span className="w-0.5 h-0.5 rounded-full bg-slate-400 mx-0.5"></span>
                          <span className="truncate max-w-[80px]">{(post as any).displayName || "익명"}</span>
                          <AuthorBadges badges={(post as any).authorBadges || []} />
                        </div>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="shrink-0">{formatRelativeTime(post.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}


    </div>
  );
}
