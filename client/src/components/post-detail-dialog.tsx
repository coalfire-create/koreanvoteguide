import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, ThumbsUp, MessageCircle, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BADGE_LABELS } from "@shared/schema";
import DOMPurify from "dompurify";
import { DailyPoll } from "@/components/DailyPoll";

interface PostDetailDialogProps {
  postId: string | null;
  onOpenChange: (open: boolean) => void;
}

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
            className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${info.color}`}
          >
            {info.emoji} {info.label}
          </span>
        );
      })}
    </span>
  );
}

function AuthorDisplay({ displayName, authorType }: { displayName?: string; authorType?: string }) {
  if (authorType === "realname" && displayName) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-[12px] font-bold text-slate-700">{displayName}</span>
        <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">실명</span>
      </span>
    );
  }
  if (authorType === "nickname" && displayName) {
    return <span className="text-[12px] font-bold text-slate-700">{displayName}</span>;
  }
  return <span className="text-[12px] font-bold text-slate-400">익명</span>;
}

export function PostDetailDialog({ postId, onOpenChange }: PostDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/community/posts", postId],
    queryFn: () => apiRequest("GET", `/api/community/posts/${postId}`).then((r) => r.json()),
    enabled: !!postId,
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/comments`, { content });
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", postId] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      toast({ title: "댓글 작성 완료", description: "성공적으로 등록되었습니다." });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiRequest("POST", `/api/community/posts/${postId}/react`, { type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", postId] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });

  function handleComment() {
    commentMutation.mutate(commentText.trim());
  }

  function handleLike() {
    reactMutation.mutate("like");
  }

  // postId props 변경시 모달 열릴때 커멘트 텍스트 초기화
  useEffect(() => {
    if (postId) setCommentText("");
  }, [postId]);

  return (
    <Dialog open={!!postId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-slate-50 border-0 shadow-2xl rounded-t-3xl rounded-b-none mt-auto mb-0 mx-0 sm:rounded-2xl sm:m-auto max-h-[90vh] flex flex-col gap-0 duration-300 transform-gpu slide-in-from-bottom data-[state=closed]:slide-out-to-bottom">
        
        {/* 헤더 바 */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100 z-10 shrink-0">
          <div className="flex flex-col">
            <DialogTitle className="text-sm font-bold text-slate-800">
              {data?.post?.title || "게시물 상세보기"}
            </DialogTitle>
            <Badge variant="secondary" className="w-fit mt-1 bg-slate-100 text-slate-500 hover:bg-slate-200">
              {data?.post?.category || "게시물"}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 text-slate-500" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 bg-white custom-scrollbar pb-6 relative z-0">
          {isLoading ? (
            <div className="space-y-4 pt-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-32 w-full mt-4" />
            </div>
          ) : !data ? (
            <div className="py-10 text-center text-slate-400 font-medium">게시글을 불러올 수 없습니다.</div>
          ) : (
            <>
              {/* 본문 영역 */}
              <div className="pb-6 border-b border-slate-100">
                <h1 className="text-xl font-extrabold text-slate-900 leading-snug tracking-tight mb-3">
                  {data.post.title}
                </h1>
                
                <div className="flex items-center justify-between mt-2 mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-indigo-100 flex items-center justify-center text-[10px] font-bold text-primary">
                      {(data.post.displayName || "익").charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 line-clamp-1">
                        <AuthorDisplay displayName={data.post.displayName} authorType={(data.post as any).authorType} />
                        <AuthorBadges badges={data.post.authorBadges} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">{new Date(data.post.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {data.post.viewCount}</span>
                    <button onClick={handleLike} className={`flex items-center gap-1 transition-colors ${data.userReactions?.sentiment === 'like' ? 'text-primary' : 'hover:text-primary'}`}>
                      <ThumbsUp className={`w-3.5 h-3.5 ${data.userReactions?.sentiment === 'like' ? 'fill-primary text-primary' : ''}`} /> {data.post.likes}
                    </button>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {data.comments?.length || 0}</span>
                  </div>
                </div>

                {data.post.contentType === "rich" ? (
                  <div
                    className="prose prose-sm max-w-none text-[15px] leading-relaxed text-slate-800 font-medium pb-4"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.post.content) }}
                  />
                ) : (
                  <div className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap font-medium pb-4">
                    {data.post.content}
                  </div>
                )}
                
                {/* 첨부파일 영역 */}
                {Array.isArray(data.post.attachments) && data.post.attachments.map((att: any, idx: number) => {
                  if (att.type === 'poll') {
                    const board = att.pollId?.split(':')[0] || "free";
                    return (
                      <div key={idx} className="mt-4 pt-4 border-t border-slate-100/60">
                        <DailyPoll board={board} />
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {/* 댓글 리스트 */}
              <div className="pt-5 bg-slate-50/50 -mx-4 px-4 pb-4">
                <h3 className="text-[13px] font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                  댓글 <span className="text-primary">{data.comments?.length || 0}</span>
                </h3>
                
                {data.comments?.length === 0 ? (
                  <p className="text-xs text-center text-slate-400 py-6">첫 번째 댓글을 남겨보세요.</p>
                ) : (
                  <div className="space-y-4">
                    {data.comments?.map((c: any) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-200/50 flex flex-col items-center justify-center shrink-0 border border-slate-200 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-500">
                            {c.authorType === "realname" ? "실" : c.authorType === "nickname" ? (c.displayName?.charAt(0) || "닉") : "익"}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <AuthorDisplay displayName={c.displayName} authorType={c.authorType} />
                              {c.isAuthor && <Badge variant="destructive" className="text-[9px] h-3.5 px-1 bg-red-50 text-red-600 hover:bg-red-100 border-none">글쓴이</Badge>}
                              <AuthorBadges badges={c.authorBadges} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(c.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[13px] text-slate-800 leading-snug">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 하단 고정 댓글 입력창 */}
        {!isLoading && data && (
          <div className="bg-white border-t border-slate-200 p-3 flex gap-2 shrink-0 z-10 sticky bottom-0">
            <>
              <Textarea
                placeholder={user ? "댓글 남기기..." : "비로그인 상태에서는 익명으로 작성됩니다."}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[44px] max-h-[120px] rounded-2xl border-slate-200 text-sm resize-none bg-slate-50 focus-visible:ring-primary/20 py-3"
                rows={1}
                disabled={commentMutation.isPending}
              />
              <Button 
                onClick={handleComment} 
                disabled={!commentText.trim() || commentMutation.isPending}
                className="rounded-xl h-[44px] px-4 font-bold shrink-0 self-end shadow-sm"
              >
                등록
              </Button>
            </>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
