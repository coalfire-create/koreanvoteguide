import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, PenSquare, X, Lock, ChevronRight, ArrowUp,
  MessageCircle, Eye, ThumbsUp, CheckCircle2, ChevronDown, ChevronUp,
  Users, FileText, Globe, Flame, ShieldCheck, Tag, User
} from "lucide-react";

import { useAssemblyMembers } from "@/lib/api-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { CommunityPost } from "@shared/schema";
import { BADGE_LABELS } from "@shared/schema";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
};

const CATEGORIES = ["전체", "자유", "토론", "정보공유", "질문"] as const;

const BOARDS = [
  { id: "free",        label: "자유게시판",     icon: Globe,    color: "text-orange-500",  bg: "bg-orange-500" },
  { id: "legislators", label: "국회의원 게시판", icon: Users, color: "text-indigo-600", bg: "bg-indigo-600" },
  { id: "bills",       label: "법안 게시판",    icon: FileText, color: "text-emerald-600", bg: "bg-emerald-600" },
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
        <span className="text-slate-700 font-semibold">{displayName}</span>
        <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">실명</span>
      </span>
    );
  }
  if (authorType === "nickname" && displayName) {
    return <span className="text-slate-700 font-semibold">{displayName}</span>;
  }
  return <span className="text-slate-400">익명</span>;
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
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [activeRecentTab, setActiveRecentTab] = useState<"recent" | "favorites">("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 실명인증 여부
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

  // 디바운스 검색
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 300);
  }

  // 실시간 검색 필터
  const filteredPosts = debouncedQuery
    ? (posts ?? []).filter(p =>
        p.title.includes(debouncedQuery) ||
        p.content.includes(debouncedQuery) ||
        (p.displayName || "").includes(debouncedQuery)
      )
    : (posts ?? []);

  // 로그인 시 글쓰기 방식 초기값 설정
  useEffect(() => {
    if (user) {
      if (isRealNameVerified) setWriteAuthorType("anonymous");
      else if (user.nickname) setWriteAuthorType("nickname");
      else setWriteAuthorType("anonymous");
    }
  }, [user?.id]);


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
        boardType: board,
        category: "자유",
        authorType: writeAuthorType,
        contentType: "rich",
        attachments: writeAttachments,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "오류");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      toast({ title: "게시글 작성 완료", description: "성공적으로 등록되었습니다." });
      setWriteTitle("");
      setWriteContent("");
      setWriteAttachments([]);
      setIsWriteOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "오류", description: err.message || "글 작성 중 오류가 발생했습니다.", variant: "destructive" });
    }
  });

  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [quickComment, setQuickComment] = useState("");

  const quickReactMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: string }) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/react`, { type });
      if (!res.ok) throw new Error("반응을 기록하지 못했습니다.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/community/posts`] });
    },
  });

  const quickCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/comments`, { content });
      if (!res.ok) throw new Error("댓글을 등록하지 못했습니다.");
      return res.json();
    },
    onSuccess: () => {
      setCommentingPostId(null);
      setQuickComment("");
      queryClient.invalidateQueries({ queryKey: [`/api/community/posts`] });
      toast({ title: "댓글 작성 완료", description: "성공적으로 등록되었습니다." });
    },
  });

  const handleMemberClick = (memberId: string, memberName: string) => {
    apiRequest("POST", `/api/members/${memberId}/click`, { name: memberName }).catch(() => {});
    navigate(`/members/${memberId}`);
  };

  function setParam(key: string, val: string) {
    const next = new URLSearchParams(search);
    if (!val || val === "전체" || val === "latest") next.delete(key);
    else next.set(key, val);
    navigate(`/community?${next.toString()}`);
  }

  function switchBoard(b: BoardId) {
    navigate(`/community?board=${b}`);
  }

  const currentBoard = BOARDS.find(b => b.id === board) ?? BOARDS[0];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">



      {/* 유저 상태바 */}
      {user && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#425091] bg-white px-1.5 py-0.5 rounded border border-[#425091]/20">Lv.3 유권자</span>
            <span className="text-[13px] font-bold text-slate-800">{user.name}</span>
          </div>
          <div className="text-[11px] font-bold text-slate-400">82 XP</div>
        </div>
      )}



      {/* 실시간 인기 */}
      {topTrending.length > 0 && (
        <div className="bg-white border-b border-slate-300">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-[13px] font-bold text-slate-800">실시간 인기 의원</span>
          </div>
          <div className="py-1">
            {topTrending.map((item, idx) => (
              <button
                key={item.memberId}
                onClick={() => handleMemberClick(item.memberId, item.name)}
                className="w-full flex items-center px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="w-6 font-bold text-red-600 text-[15px] text-left">{idx + 1}.</span>
                <span className="font-semibold text-slate-900 text-[15px]">{item.member.name}</span>
                <span className="text-slate-400 text-[13px] ml-1">의원</span>
                <span className="ml-auto text-slate-400 text-[13px] flex items-center gap-1 font-medium">
                  {item.count} <ArrowUp className="w-3.5 h-3.5 text-red-500 stroke-[3]" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="h-2 bg-slate-100 border-b border-slate-200" />

      {/* ===== 3개 게시판 탭 ===== */}
      <div className="bg-white w-full">
        <div className="flex w-full border-b border-slate-200">
          {BOARDS.map(b => {
            const Icon = b.icon;
            const active = board === b.id;
            return (
              <button
                key={b.id}
                onClick={() => switchBoard(b.id)}
                className={`flex-1 py-3 text-[12px] font-bold flex flex-col items-center gap-0.5 transition-colors border-b-[3px] ${
                  active
                    ? `${b.color} border-current`
                    : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? b.color : ""}`} />
                <span className="leading-tight text-center" style={{fontSize: "11px"}}>{b.label}</span>
              </button>
            );
          })}
        </div>

        {/* 오늘의 투표 */}
        <DailyPoll board={board} />


        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-4 py-2.5">
          <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
            <SelectTrigger className="h-8 w-[100px] border-slate-200 bg-white text-[12px] font-bold px-3 py-0 border-[0.5px] shadow-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest" className="text-[12px] font-medium">최신순</SelectItem>
              <SelectItem value="popular" className="text-[12px] font-medium text-red-600">인기순</SelectItem>
              <SelectItem value="views" className="text-[12px] font-medium">조회순</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => {
              if (board === "free") {
                setIsWriteOpen(!isWriteOpen);
              } else {
                navigate(`/community/write?board=${board}`);
              }
            }}
            className={`flex items-center gap-1.5 text-white px-3.5 py-1.5 text-[12px] font-bold rounded-lg transition-colors ${currentBoard.bg} hover:opacity-90 shadow-sm`}
          >
            <PenSquare className="w-3.5 h-3.5" /> 글쓰기
          </button>
        </div>

        {/* 검색바 - 글쓰기 바 바로 아래 */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="의원 및 통합검색"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full h-9 bg-white rounded-full pl-9 pr-4 text-[13px] font-medium outline-none placeholder:text-slate-400 border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all text-slate-800 shadow-sm"
            />
          </div>
          
          {/* 인기 검색어 */}
          {topTrending.length > 0 && (
            <div className="max-w-lg mx-auto mt-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">인기검색어</span>
              {topTrending.map((item, idx) => (
                <button 
                  key={item.memberId}
                  onClick={() => {
                    setSearchQuery(item.member.name);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    setDebouncedQuery(item.member.name);
                  }}
                  className="shrink-0 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 shadow-sm"
                >
                  <span className="text-indigo-600 font-bold">{idx + 1}</span>
                  {item.member.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 글쓰기 패널 */}
        <AnimatePresence>
          {isWriteOpen && board === "free" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white p-4 border-b border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[15px] font-extrabold">{currentBoard.label}에 글쓰기</h3>
                  <button onClick={() => setIsWriteOpen(false)}>
                    <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>

                {/* authorType 선택 */}
                <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                  {!user ? (
                    <p className="text-[12px] text-slate-500 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold">익</span>
                      비로그인 상태로 익명으로 작성됩니다.
                    </p>
                  ) : isRealNameVerified ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 mb-2">작성자 표시</p>
                      {(["anonymous", "nickname", "realname"] as const).map((type) => (
                        <label key={type} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="authorType"
                            value={type}
                            checked={writeAuthorType === type}
                            onChange={() => setWriteAuthorType(type)}
                            className="accent-primary"
                          />
                          <span className="text-[13px] font-medium text-slate-700">
                            {type === "anonymous" && "익명으로 올리기"}
                            {type === "nickname" && `닉네임으로 올리기 ${ user.nickname ? `(${user.nickname})` : "— 닉네임 미설정"}`}
                            {type === "realname" && (
                              <span className="flex items-center gap-1">
                                실명인증으로 올리기
                                <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold">실명</span>
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 mb-2">작성자 표시</p>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="radio" name="authorType" value="anonymous" checked={writeAuthorType === "anonymous"} onChange={() => setWriteAuthorType("anonymous")} className="accent-primary" />
                        <span className="text-[13px] font-medium text-slate-700">익명으로 올리기</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="authorType"
                          value="nickname"
                          checked={writeAuthorType === "nickname"}
                          onChange={() => setWriteAuthorType("nickname")}
                          className="accent-primary"
                          disabled={!user.nickname}
                        />
                        <span className={`text-[13px] font-medium ${!user.nickname ? "text-slate-300" : "text-slate-700"}`}>
                          닉네임으로 올리기 {user.nickname ? `(${user.nickname})` : "— 마이페이지에서 닉네임 설정"}
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <Input
                  placeholder="제목을 입력하세요"
                  maxLength={50}
                  value={writeTitle}
                  onChange={(e) => setWriteTitle(e.target.value)}
                  className="mb-3 h-12 text-[15px] font-bold border-slate-200 rounded-sm bg-white"
                />
                <div className="mb-4">
                  <PostEditor
                    content={writeContent}
                    onChange={setWriteContent}
                    attachments={writeAttachments}
                    onAttachmentsChange={setWriteAttachments}
                  />
                </div>
                <Button
                  onClick={() => createPostMutation.mutate()}
                  disabled={!writeTitle.trim() || !writeContent.trim() || createPostMutation.isPending}
                  className={`w-full h-12 rounded-sm font-bold text-[15px] ${currentBoard.bg} hover:opacity-90`}
                >
                  {createPostMutation.isPending ? "등록 중..." : "등록"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 게시글 리스트 */}
        <div className="bg-white border-b border-slate-300 divide-y divide-slate-100">
          {postsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="py-2.5 px-3 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-1.5" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            ))
          ) : filteredPosts.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-slate-500 text-[14px] font-medium mb-1">
                {debouncedQuery ? `"${debouncedQuery}" 검색 결과가 없습니다` : "아직 등록된 글이 없습니다"}
              </p>
              <p className="text-slate-400 text-[12px]">가장 먼저 글을 남겨보세요!</p>
            </div>
          ) : (
          {filteredPosts.map((post, idx) => {
              const isHot = sort === "popular" && idx < 3;
              const isCommenting = commentingPostId === post.id;
              return (
                <div
                  key={post.id}
                  className="w-full bg-white border-b border-slate-100 last:border-0"
                >
                  <div
                    onClick={() => setSelectedPostId(post.id)}
                    className="w-full text-left py-4 px-4 hover:bg-slate-50 transition-colors group flex gap-3 cursor-pointer"
                  >
                    {/* 썸네일 이미지 */}
                    {post.thumbnailUrl && (
                      <div className="shrink-0 w-[64px] h-[64px] rounded-lg overflow-hidden border border-slate-100 mt-0.5">
                        <img src={post.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      {/* 태그 배지 */}
                      {post.tagName && (
                        <span className="flex items-center gap-1 text-[10px] font-bold w-fit">
                          {post.tagType === "legislator" ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                              <User className="w-2.5 h-2.5" />{post.tagName}
                            </span>
                          ) : post.tagType === "bill" ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <FileText className="w-2.5 h-2.5" />{post.tagName}
                            </span>
                          ) : null}
                        </span>
                      )}

                      <div className="flex items-start gap-2 justify-between">
                        <h3 className={`text-[15px] line-clamp-2 leading-snug flex-1 ${isHot ? "text-red-600 font-bold" : "text-slate-900 font-bold"}`}>
                          {isHot && <span className="text-[10px] bg-red-600 text-white px-1 py-0.5 rounded-sm mr-1.5 shadow-sm align-text-bottom">BEST</span>}
                          {post.title}
                        </h3>
                      </div>
                      <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed">{post.content}</p>
                      
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mt-1">
                        <AuthorDisplay displayName={post.displayName} authorType={post.authorType} isVerified={post.isVerified} />
                        <span>·</span>
                        <span>{formatRelativeTime(post.createdAt)}</span>
                        <span className="ml-auto flex items-center gap-3">
                          <span className="flex items-center gap-0.5"><Eye className="w-3.5 h-3.5" />{post.viewCount ?? 0}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 빠른 반응 버튼바 */}
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        quickReactMutation.mutate({ postId: post.id, type: "like" });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-100"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${post.likes > 0 ? "fill-primary text-primary" : ""}`} />
                      <span className={`text-[12px] font-bold ${post.likes > 0 ? "text-primary" : ""}`}>{post.likes ?? 0}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCommenting) {
                          setCommentingPostId(null);
                        } else {
                          setCommentingPostId(post.id);
                          setQuickComment("");
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-100"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-bold">{post.commentCount ?? 0}</span>
                    </button>
                  </div>

                  {/* 빠른 댓글 입력창 */}
                  <AnimatePresence>
                    {isCommenting && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 pb-4 overflow-hidden"
                      >
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            placeholder="댓글을 입력하세요..."
                            value={quickComment}
                            onChange={(e) => setQuickComment(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && quickComment.trim()) {
                                quickCommentMutation.mutate({ postId: post.id, content: quickComment.trim() });
                              }
                            }}
                            className="h-9 text-[13px] rounded-full border-slate-200 bg-slate-50"
                          />
                          <Button
                            size="sm"
                            disabled={!quickComment.trim() || quickCommentMutation.isPending}
                            onClick={() => quickCommentMutation.mutate({ postId: post.id, content: quickComment.trim() })}
                            className="shrink-0 h-9 rounded-full px-4 font-bold bg-indigo-600 hover:bg-indigo-700"
                          >
                            등록
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          )}
        </div>
      </div>


      <PostDetailDialog postId={selectedPostId} onOpenChange={(open) => { if (!open) setSelectedPostId(null); }} />
    </div>
  );
}
