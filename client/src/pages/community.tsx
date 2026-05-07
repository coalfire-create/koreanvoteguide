import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, PenSquare, X, Eye, ThumbsUp, MessageCircle, ArrowUp, ArrowDown, TrendingUp, Flame, Sparkles, Edit } from "lucide-react";

import { useAssemblyMembers } from "@/lib/api-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { CommunityPost } from "@shared/schema";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DailyPoll } from "@/components/DailyPoll";
import { PostEditor } from "@/components/PostEditor";

type PostWithCount = CommunityPost & {
  commentCount: number;
  displayName: string;
  authorBadges: string[];
  authorType?: string;
  isVerified?: boolean;
  thumbnailUrl?: string | null;
  tagType?: string | null;
  tagName?: string | null;
  topComment?: any;
  topCommentLikes?: number;
};

const BOARDS = [
  { id: "free",        label: "자유게시판" },
  { id: "legislators", label: "의원 게시판" },
  { id: "bills",       label: "법안 게시판" },
] as const;

type BoardId = typeof BOARDS[number]["id"];

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

function AuthorDisplay({ displayName, authorType, isVerified }: { displayName?: string; authorType?: string; isVerified?: boolean }) {
  if (authorType === "realname" && displayName) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-on-surface font-semibold">{displayName}</span>
        <span className="bg-secondary-container/20 text-on-secondary-container text-[9px] font-bold px-1.5 py-0.5 rounded-full">실명</span>
      </span>
    );
  }
  if (authorType === "nickname" && displayName) {
    return <span className="text-on-surface font-semibold">{displayName}</span>;
  }
  return <span className="text-on-surface-variant font-medium">익명</span>;
}

export default function Community() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const { members } = useAssemblyMembers();

  const board = (params.get("board") || "free") as BoardId;
  const sort = params.get("sort") || "latest";

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writeAttachments, setWriteAttachments] = useState<any[]>([]);
  const [writeAuthorType, setWriteAuthorType] = useState<"anonymous" | "nickname" | "realname">("anonymous");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRealNameVerified = user?.realNameVerified === true;

  const { data: trending = [] } = useQuery<{ memberId: string; name: string; count: number }[]>({
    queryKey: ["/api/members/trending"],
    refetchInterval: 30000,
  });

  const queryKey = [`/api/community/posts`, board, sort];
  const { data: posts, isLoading: postsLoading } = useQuery<PostWithCount[]>({
    queryKey,
    queryFn: () => {
      const p = new URLSearchParams({ board });
      if (sort && sort !== "latest") p.set("sort", sort);
      return apiRequest("GET", `/api/community/posts?${p}`).then((r) => r.json());
    },
  });

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 300);
  }

  const filteredPosts = debouncedQuery
    ? (posts ?? []).filter(p => p.title.includes(debouncedQuery) || p.content.includes(debouncedQuery) || (p.displayName || "").includes(debouncedQuery))
    : (posts ?? []);

  useEffect(() => {
    if (user) {
      if (isRealNameVerified) setWriteAuthorType("anonymous");
      else if (user.nickname) setWriteAuthorType("nickname");
      else setWriteAuthorType("anonymous");
    }
  }, [user?.id]);

  const trendingWithDetails = trending.map((t) => {
    const member = members.find((m) => m.id === t.memberId);
    return member ? { ...t, member } : null;
  }).filter(Boolean) as any[];
  const topTrending = trendingWithDetails.slice(0, 5);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/community/posts", {
        title: writeTitle, content: writeContent, boardType: board, category: "자유", authorType: writeAuthorType, contentType: "rich", attachments: writeAttachments,
      });
      if (!res.ok) throw new Error((await res.json()).error || "오류");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      toast({ title: "게시글 작성 완료", description: "성공적으로 등록되었습니다." });
      setWriteTitle(""); setWriteContent(""); setWriteAttachments([]); setIsWriteOpen(false);
    },
    onError: (err: any) => toast({ title: "오류", description: err.message || "글 작성 중 오류가 발생했습니다.", variant: "destructive" })
  });

  const quickReactMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: string }) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/react`, { type });
      if (!res.ok) throw new Error("반응을 기록하지 못했습니다.");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/community/posts`] }),
  });

  function switchBoard(b: BoardId) { navigate(`/community?board=${b}`); }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-body-md">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 h-16 w-full bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 flex justify-between items-center px-4 md:px-8 shadow-sm">
        <div className="flex items-center gap-6 flex-1 max-w-2xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary-container rounded-full pl-10 pr-4 py-2 text-sm transition-all text-on-surface outline-none"
              placeholder="토론, 주제 또는 의원 검색..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setDebouncedQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-outline-variant hover:text-on-surface" />
              </button>
            )}
          </div>
        </div>
        <div className="hidden md:block">
           <button onClick={() => navigate(`/community/write?board=${board}`)} className="bg-primary hover:bg-primary/90 text-on-primary font-bold px-4 py-2 rounded-full transition-all active:scale-95 shadow-sm text-sm">
             글쓰기
           </button>
        </div>
      </header>

      {/* Community Content Container */}
      <div className="p-4 md:p-8 max-w-7xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 flex-1">
        
        {/* Center Column: Tabs and Main Content */}
        <div className="col-span-1 md:col-span-8 space-y-8">
          
          {/* Tab Bar */}
          <div className="flex border-b border-outline-variant/30 overflow-x-auto scrollbar-hide">
            {BOARDS.map(b => (
              <button
                key={b.id}
                onClick={() => switchBoard(b.id)}
                className={`px-4 md:px-6 py-4 border-b-2 font-bold text-sm transition-colors whitespace-nowrap ${
                  board === b.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <DailyPoll key={board} board={board} />

          <div className="flex items-center justify-between mt-4">
             <Select value={sort} onValueChange={(v) => { const next = new URLSearchParams(search); next.set("sort", v); navigate(`/community?${next.toString()}`); }}>
               <SelectTrigger className="w-32 h-9 rounded-full bg-surface-container-low border-outline-variant/30 text-sm">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="latest">최신순</SelectItem>
                 <SelectItem value="popular">인기순</SelectItem>
                 <SelectItem value="views">조회순</SelectItem>
               </SelectContent>
             </Select>

             {/* Mobile Write Button */}
             <div className="md:hidden">
               <button onClick={() => navigate(`/community/write?board=${board}`)} className="bg-primary hover:bg-primary/90 text-on-primary font-bold px-4 py-2 rounded-full transition-all active:scale-95 shadow-sm text-sm">
                 <Edit className="w-4 h-4 inline-block mr-1" />글쓰기
               </button>
             </div>
          </div>

          <AnimatePresence>
            {isWriteOpen && board === "free" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-surface-container-lowest p-6 rounded-[24px] border border-outline-variant/30 shadow-sm mb-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-on-surface">{BOARDS.find(b=>b.id===board)?.label}에 글쓰기</h3>
                    <button onClick={() => setIsWriteOpen(false)}><X className="w-5 h-5 text-outline-variant hover:text-on-surface" /></button>
                  </div>
                  
                  {/* Write form details omitted for brevity, keeping it similar to original but with unified classes */}
                  <div className="space-y-4">
                     <Input placeholder="제목을 입력하세요" value={writeTitle} onChange={(e) => setWriteTitle(e.target.value)} className="h-12 bg-surface text-base border-outline-variant/30 focus:border-primary rounded-[12px]" />
                     <PostEditor content={writeContent} onChange={setWriteContent} attachments={writeAttachments} onAttachmentsChange={setWriteAttachments} />
                     <div className="flex justify-between items-center pt-2">
                        <select className="bg-surface-container rounded-full px-4 py-2 text-sm outline-none" value={writeAuthorType} onChange={e=>setWriteAuthorType(e.target.value as any)}>
                           <option value="anonymous">익명</option>
                           <option value="nickname" disabled={!user?.nickname}>닉네임</option>
                           {isRealNameVerified && <option value="realname">실명</option>}
                        </select>
                        <Button onClick={() => createPostMutation.mutate()} disabled={!writeTitle.trim() || !writeContent.trim() || createPostMutation.isPending} className="rounded-full px-8 bg-primary hover:bg-primary/90 text-on-primary font-bold">
                           {createPostMutation.isPending ? "등록 중..." : "등록"}
                        </Button>
                     </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {!postsLoading && filteredPosts.length === 0 && (
            <div className="bg-surface-container-lowest rounded-[24px] p-12 border border-outline-variant/30 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center">
                <PenSquare className="text-primary w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">아직 등록된 게시글이 없습니다</h3>
                <p className="text-sm text-on-surface-variant max-w-xs mx-auto">첫 번째 의견을 나누고 커뮤니티와 대화를 시작해 보세요.</p>
              </div>
              <button onClick={() => navigate(`/community/write?board=${board}`)} className="bg-secondary-container text-on-secondary-container hover:opacity-90 font-bold px-8 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-sm">
                <Edit className="w-4 h-4" /> 글쓰기
              </button>
            </div>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            {postsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-surface-container-low rounded-[16px] animate-pulse" />)
            ) : (
              filteredPosts.map(post => (
                <div key={post.id} onClick={() => setSelectedPostId(post.id)} className="bg-surface-container-lowest border border-outline-variant/30 rounded-[16px] p-5 hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-3 group">
                  <div className="flex justify-between items-start">
                     <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                     {post.tagName && (
                        <span className="shrink-0 ml-4 inline-flex items-center px-2 py-1 rounded-[6px] bg-surface-container text-xs font-bold text-on-surface-variant">
                           {post.tagName}
                        </span>
                     )}
                  </div>
                  <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">{post.content.replace(/<[^>]*>/g, ' ')}</p>
                  
                  {post.topComment && (
                    <div className="mt-2 p-3 bg-surface-container rounded-[12px] border border-outline-variant/20 relative before:absolute before:-top-2 before:left-4 before:w-3 before:h-3 before:bg-surface-container before:rotate-45 before:border-l before:border-t before:border-outline-variant/20">
                      <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                        <span className="text-[10px] font-bold text-on-surface bg-surface-container-high px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Flame className="w-2.5 h-2.5 text-primary" /> 베스트 댓글</span>
                        <span className="text-xs font-bold text-on-surface ml-1">{post.topComment.displayName || "익명"}</span>
                        <span className="text-xs text-primary font-bold ml-auto flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.topCommentLikes || 0}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant line-clamp-2 relative z-10">{post.topComment.content}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-3 border-t border-outline-variant/20">
                     <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <AuthorDisplay displayName={post.displayName} authorType={post.authorType} isVerified={post.isVerified} />
                        <span>·</span>
                        <span>{formatRelativeTime(post.createdAt)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.viewCount ?? 0}</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); quickReactMutation.mutate({ postId: post.id, type: "like" }); }} className="flex items-center gap-1 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors">
                           <ThumbsUp className={`w-3.5 h-3.5 ${post.likes > 0 ? "fill-primary text-primary" : ""}`} /> {post.likes ?? 0}
                        </button>
                        <span className="flex items-center gap-1 text-xs font-bold text-on-surface-variant">
                           <MessageCircle className="w-3.5 h-3.5" /> {post.commentCount ?? 0}
                        </span>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar: Trending & Popular Posts (Desktop only) */}
        <div className="col-span-1 md:col-span-4 space-y-6 hidden md:block">
          {/* Trending Searches Section */}
          <div className="bg-surface-container-lowest p-6 rounded-[24px] border border-outline-variant/30 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-on-surface">실시간 인기 급상승 검색어</h4>
              <TrendingUp className="text-primary w-5 h-5" />
            </div>
            <ol className="space-y-4">
              {topTrending.map((item, idx) => (
                <li key={item.memberId} className="flex items-center gap-4 group cursor-pointer" onClick={() => { setSearchQuery(item.member.name); setDebouncedQuery(item.member.name); }}>
                  <span className="font-bold text-primary text-lg w-4">{idx + 1}</span>
                  <span className="text-on-surface font-medium group-hover:text-primary transition-colors">{item.member.name}</span>
                  <span className="ml-auto text-xs text-secondary flex items-center gap-0.5"><ArrowUp className="w-3 h-3" />{item.count}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Glassmorphism Suggested Topics (Visual interest) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary-container/30 backdrop-blur-sm p-4 rounded-[16px] border border-outline-variant/30 text-center cursor-pointer hover:bg-secondary-container/50 transition-colors">
              <Flame className="text-secondary mx-auto mb-2 w-5 h-5" />
              <p className="text-xs text-on-surface-variant mb-1">인기 주제</p>
              <p className="font-bold text-on-surface text-sm">#경제활성화</p>
            </div>
            <div className="bg-tertiary-container/30 backdrop-blur-sm p-4 rounded-[16px] border border-outline-variant/30 text-center cursor-pointer hover:bg-tertiary-container/50 transition-colors">
              <Sparkles className="text-tertiary mx-auto mb-2 w-5 h-5" />
              <p className="text-xs text-on-surface-variant mb-1">최신 화제</p>
              <p className="font-bold text-on-surface text-sm">#기후위기</p>
            </div>
          </div>
        </div>
      </div>

      <PostDetailDialog postId={selectedPostId} onOpenChange={(open) => { if (!open) setSelectedPostId(null); }} />
    </div>
  );
}
