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
  topComment?: { displayName?: string; content: string };
  topCommentLikes?: number;
};

const BOARDS = [
  { id: "free",        label: "자유 게시판" },
  { id: "candidate",   label: "선거 게시판" },
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
  const [writeAttachments, setWriteAttachments] = useState<{ type: string; [key: string]: unknown }[]>([]);
  const [writeAuthorType, setWriteAuthorType] = useState<"anonymous" | "nickname">("anonymous");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

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
      if (user.nickname) setWriteAuthorType("nickname");
      else setWriteAuthorType("anonymous");
    }
  }, [user?.id]);

  const trendingWithDetails = trending.map((t) => {
    const member = members.find((m) => m.id === t.memberId);
    return member ? { ...t, member } : null;
  }).filter((x): x is NonNullable<typeof x> => Boolean(x));
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
    onError: (err: Error) => toast({ title: "오류", description: err.message || "글 작성 중 오류가 발생했습니다.", variant: "destructive" })
  });

  const quickReactMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: string }) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/react`, { type });
      if (!res.ok) throw new Error("반응을 기록하지 못했습니다.");
      return res.json();
    },
    onSuccess: (_data, { postId }) => {
      setLikedPosts(prev => { const n = new Set(prev); n.delete(postId); return n; });
      queryClient.invalidateQueries({ queryKey: [`/api/community/posts`] });
    },
    onError: (_err, { postId }) => {
      setLikedPosts(prev => { const n = new Set(prev); n.delete(postId); return n; });
    },
  });

  const inlineCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/comments`, { content });
      if (!res.ok) throw new Error((await res.json()).error || "댓글 작성 실패");
      return res.json();
    },
    onSuccess: (_data, { postId }) => {
      setCommentDrafts(prev => ({ ...prev, [postId]: "" }));
      setOpenCommentPostId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/community/posts`] });
      toast({ title: "댓글이 작성되었습니다" });
    },
    onError: (err: Error) => toast({ title: "오류", description: err.message, variant: "destructive" }),
  });

  function switchBoard(b: BoardId) { navigate(`/community?board=${b}`); }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-foreground overflow-x-hidden">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 h-[60px] md:h-[72px] w-full bg-background/80 backdrop-blur-xl border-b border-border/40 flex justify-between items-center px-4 md:px-8 shadow-sm will-change-transform">
        <div className="flex items-center gap-6 flex-1 max-w-2xl">
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              className="w-full h-11 bg-muted border border-border/30 focus:bg-background focus:border-primary/30 focus:shadow-[0_0_0_4px_rgba(var(--primary),0.05)] rounded-[14px] pl-11 pr-4 py-2 text-[14px] transition-all text-foreground outline-none placeholder:text-muted-foreground font-medium"
              placeholder="토론, 주제 또는 의원 검색..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setDebouncedQuery(""); }} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}
          </div>
        </div>
        <div className="hidden md:block">
           <button onClick={() => navigate(`/community/write?board=${board}`)} className="bg-primary hover:opacity-90 text-primary-foreground font-bold px-5 py-2.5 rounded-[12px] transition-all active:scale-95 shadow-sm shadow-indigo-500/20 text-[14px]">
             글쓰기
           </button>
        </div>
      </header>

      {/* Community Content Container */}
      <div className="p-3 md:p-8 max-w-7xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 flex-1">
        
        {/* Center Column: Tabs and Main Content */}
        <div className="col-span-1 md:col-span-8 space-y-8">

          {/* Mobile Trending — desktop에선 사이드바에 표시 */}
          {topTrending.length > 0 && (
            <div className="md:hidden bg-card border border-border/30 rounded-[20px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-black text-foreground">실시간 인기 급상승 검색어</span>
              </div>
              <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                <ol className="flex gap-2 w-max">
                  {topTrending.map((item, idx) => (
                    <li key={item.memberId}>
                      <button
                        onClick={() => { setSearchQuery(item.member.name); setDebouncedQuery(item.member.name); }}
                        className="flex items-center gap-1.5 bg-muted hover:bg-primary/10 hover:text-primary transition-colors px-3 py-2 rounded-full text-[13px] font-bold text-foreground whitespace-nowrap"
                      >
                        <span className="text-primary font-black text-[12px]">{idx + 1}</span>
                        {item.member.name}
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 ml-0.5">
                          <ArrowUp className="w-2.5 h-2.5 text-red-400" />{item.count}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Tab Bar */}
          <div className="w-full">
            <div className="grid grid-cols-4 md:flex md:w-max gap-1 md:gap-2 p-1 md:p-1.5 bg-muted rounded-2xl">
              {BOARDS.map(b => (
                <button
                  key={b.id}
                  onClick={() => switchBoard(b.id)}
                  className={`px-1.5 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-[11px] md:text-[14px] transition-all whitespace-nowrap text-center leading-tight ${
                    board === b.id ? "bg-card text-primary shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <DailyPoll key={board} board={board} />

          <div className="flex items-center justify-between mt-4">
             <Select value={sort} onValueChange={(v) => { const next = new URLSearchParams(search); next.set("sort", v); navigate(`/community?${next.toString()}`); }}>
               <SelectTrigger className="w-32 h-10 rounded-full bg-card border-border/30 text-[13px] font-bold shadow-sm">
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
               <button onClick={() => navigate(`/community/write?board=${board}`)} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-[12px] transition-all active:scale-95 shadow-sm text-[13px]">
                 <Edit className="w-4 h-4 inline-block mr-1" />글쓰기
               </button>
             </div>
          </div>

          <AnimatePresence>
            {isWriteOpen && board === "free" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-card p-6 rounded-[24px] border border-border/30 shadow-sm mb-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-foreground">{BOARDS.find(b=>b.id===board)?.label}에 글쓰기</h3>
                    <button onClick={() => setIsWriteOpen(false)}><X className="w-5 h-5 text-muted-foreground hover:text-foreground" /></button>
                  </div>
                  
                  {/* Write form details */}
                  <div className="space-y-4">
                     <Input placeholder="제목을 입력하세요" value={writeTitle} onChange={(e) => setWriteTitle(e.target.value)} className="h-12 bg-muted text-[15px] border-border/30 focus:border-primary rounded-[12px]" />
                     <PostEditor content={writeContent} onChange={setWriteContent} attachments={writeAttachments} onAttachmentsChange={setWriteAttachments} />
                     <div className="flex justify-between items-center pt-2">
                        <select className="bg-muted border border-border/30 rounded-[12px] px-4 py-2.5 text-[13px] font-bold text-foreground outline-none" value={writeAuthorType} onChange={e=>setWriteAuthorType(e.target.value as "anonymous" | "nickname")}>
                           <option value="anonymous">익명</option>
                           <option value="nickname" disabled={!user?.nickname}>닉네임</option>
                        </select>
                        <Button onClick={() => createPostMutation.mutate()} disabled={!writeTitle.trim() || !writeContent.trim() || createPostMutation.isPending} className="rounded-[12px] px-8 py-2.5 h-auto bg-primary text-primary-foreground font-bold shadow-sm shadow-indigo-500/20">
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
            <div className="bg-card rounded-[24px] p-8 md:p-12 border border-border/30 shadow-sm flex flex-col items-center justify-center text-center space-y-4 md:space-y-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <PenSquare className="text-primary w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-[18px] font-bold text-foreground">아직 등록된 게시글이 없습니다</h3>
                <p className="text-[14px] text-muted-foreground max-w-xs mx-auto">첫 번째 의견을 나누고 커뮤니티와 대화를 시작해 보세요.</p>
              </div>
              <button onClick={() => navigate(`/community/write?board=${board}`)} className="bg-primary/15 text-primary hover:bg-primary/20 font-bold px-8 py-3 rounded-2xl flex items-center gap-2 transition-all active:scale-95">
                <Edit className="w-4 h-4" /> 글쓰기
              </button>
            </div>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            {postsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-card rounded-[24px] border border-border/30 animate-pulse" />)
            ) : (
              filteredPosts.map(post => (
                <div key={post.id} onClick={() => setSelectedPostId(post.id)} className="bg-card border border-border/30 rounded-[20px] p-4 md:p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20 transition-all cursor-pointer flex flex-col gap-2 md:gap-3 group">
                  <div className="flex justify-between items-start">
                     <h3 className="text-[14px] md:text-[16px] font-extrabold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">{post.title}</h3>
                     {post.tagName && (
                        <span className="shrink-0 ml-4 inline-flex items-center px-2 py-1 rounded-md bg-muted text-[11px] font-bold text-muted-foreground border border-border/30">
                           {post.tagName}
                        </span>
                     )}
                  </div>
                  <p className="text-[13px] md:text-[14px] text-muted-foreground line-clamp-2 leading-relaxed">{post.content.replace(/<[^>]*>/g, ' ')}</p>
                  
                  {post.topComment && (
                    <div className="hidden md:block mt-2 p-3 bg-primary/5 rounded-2xl border border-primary/10 relative before:absolute before:-top-2 before:left-6 before:w-3 before:h-3 before:bg-primary/5 before:rotate-45 before:border-l before:border-t before:border-primary/10">
                      <div className="flex items-center gap-2 mb-1.5 relative z-10">
                        <span className="text-[10px] font-bold text-primary bg-background px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border border-primary/5"><Flame className="w-3 h-3 text-orange-500" /> 베스트 댓글</span>
                        <span className="text-[12px] font-bold text-foreground ml-1">{post.topComment.displayName || "익명"}</span>
                        <span className="text-[11px] text-primary font-bold ml-auto flex items-center gap-1 bg-background px-1.5 py-0.5 rounded-md"><ThumbsUp className="w-3 h-3" /> {post.topCommentLikes || 0}</span>
                      </div>
                      <p className="text-[13px] text-muted-foreground line-clamp-2 relative z-10 pl-1">{post.topComment.content}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 md:mt-3 pt-3 md:pt-4 border-t border-border/30">
                     <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
                        <AuthorDisplay displayName={post.displayName} authorType={post.authorType} isVerified={post.isVerified} />
                        <span>·</span>
                        <span>{formatRelativeTime(post.createdAt)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.viewCount ?? 0}</span>
                     </div>
                     <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLikedPosts(prev => {
                              const next = new Set(prev);
                              if (next.has(post.id)) next.delete(post.id); else next.add(post.id);
                              return next;
                            });
                            quickReactMutation.mutate({ postId: post.id, type: "like" });
                          }}
                          className={`flex items-center gap-1 text-[12px] font-bold transition-colors ${likedPosts.has(post.id) ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                        >
                          <ThumbsUp className={`w-4 h-4 transition-all ${likedPosts.has(post.id) ? "fill-primary text-primary scale-110" : ""}`} />
                          {(post.likes ?? 0) + (likedPosts.has(post.id) ? 1 : 0)}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenCommentPostId(prev => prev === post.id ? null : post.id);
                          }}
                          className={`flex items-center gap-1 text-[12px] font-bold transition-colors ${openCommentPostId === post.id ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                        >
                          <MessageCircle className={`w-4 h-4 ${openCommentPostId === post.id ? "fill-primary/20 text-primary" : ""}`} />
                          {post.commentCount ?? 0}
                        </button>
                     </div>
                  </div>

                  <AnimatePresence>
                    {openCommentPostId === post.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="pt-3 flex gap-2">
                          <input
                            className="flex-1 h-10 bg-muted rounded-[12px] px-3 text-[13px] font-medium border border-border/30 focus:border-primary/40 focus:outline-none placeholder:text-muted-foreground"
                            placeholder="댓글을 입력하세요..."
                            value={commentDrafts[post.id] || ""}
                            onChange={(e) => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                const text = (commentDrafts[post.id] || "").trim();
                                if (text) { e.preventDefault(); inlineCommentMutation.mutate({ postId: post.id, content: text }); }
                              }
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              const text = (commentDrafts[post.id] || "").trim();
                              if (text) inlineCommentMutation.mutate({ postId: post.id, content: text });
                            }}
                            disabled={!(commentDrafts[post.id] || "").trim() || inlineCommentMutation.isPending}
                            className="h-10 px-4 bg-primary text-primary-foreground rounded-[12px] text-[13px] font-bold disabled:opacity-40 transition-opacity shrink-0"
                          >
                            {inlineCommentMutation.isPending ? "..." : "등록"}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar: Trending & Popular Posts (Desktop only) */}
        <div className="col-span-1 md:col-span-4 space-y-6 hidden md:block">
          {/* Trending Searches Section */}
          <div className="bg-card p-6 rounded-[24px] border border-border/30 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-[16px] font-black text-foreground">실시간 인기 급상승 검색어</h4>
              <TrendingUp className="text-primary w-5 h-5" />
            </div>
            <ol className="space-y-4">
              {topTrending.map((item, idx) => (
                <li key={item.memberId} className="flex items-center gap-4 group cursor-pointer" onClick={() => { setSearchQuery(item.member.name); setDebouncedQuery(item.member.name); }}>
                  <span className="font-black text-primary text-lg w-4">{idx + 1}</span>
                  <span className="text-foreground font-bold group-hover:text-primary transition-colors">{item.member.name}</span>
                  <span className="ml-auto text-[11px] font-bold text-muted-foreground flex items-center gap-0.5"><ArrowUp className="w-3 h-3 text-red-400" />{item.count}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Suggested Topics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-500/10 p-4 rounded-[20px] border border-orange-500/20 text-center cursor-pointer hover:bg-orange-500/20 transition-colors group">
              <Flame className="text-orange-500 mx-auto mb-2 w-6 h-6 group-hover:scale-110 transition-transform" />
              <p className="text-[11px] font-bold text-orange-400/80 mb-1">인기 주제</p>
              <p className="font-black text-orange-600 text-[14px]">#경제활성화</p>
            </div>
            <div className="bg-primary/10 p-4 rounded-[20px] border border-primary/20 text-center cursor-pointer hover:bg-primary/20 transition-colors group">
              <Sparkles className="text-primary mx-auto mb-2 w-6 h-6 group-hover:scale-110 transition-transform" />
              <p className="text-[11px] font-bold text-primary/80 mb-1">최신 화제</p>
              <p className="font-black text-primary text-[14px]">#기후위기</p>
            </div>
          </div>
        </div>
      </div>

      <PostDetailDialog postId={selectedPostId} onOpenChange={(open) => { if (!open) setSelectedPostId(null); }} />
    </div>
  );
}
