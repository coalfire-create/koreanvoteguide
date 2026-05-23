import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { BADGE_LABELS } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

interface InlineCommentsProps {
  postId: string;
  maxVisible?: number;
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
  if (authorType === "nickname" && displayName) {
    return <span className="text-[12px] font-bold text-slate-700">{displayName}</span>;
  }
  return <span className="text-[12px] font-bold text-slate-400">익명</span>;
}

export function InlineComments({ postId, maxVisible = 3 }: InlineCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/community/posts", postId],
    queryFn: () => apiRequest("GET", `/api/community/posts/${postId}`).then((r) => r.json()),
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

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest("DELETE", `/api/community/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", postId] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      toast({ title: "삭제 완료", description: "댓글이 삭제되었습니다." });
    },
    onError: (err: any) => {
      toast({ title: "오류", description: err.message || "댓글 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/community/comments/${commentId}`, { content });
      return res.json();
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", postId] });
    },
    onError: (err: any) => {
      toast({ title: "오류", description: err.message || "댓글 수정 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  function handleComment() {
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  }

  function handleDeleteComment(commentId: string) {
    if (window.confirm("이 댓글을 삭제하시겠습니까?")) {
      deleteCommentMutation.mutate(commentId);
    }
  }

  const allComments: any[] = data?.comments ?? [];
  const visibleComments = expanded ? allComments : allComments.slice(0, maxVisible);
  const hiddenCount = allComments.length - maxVisible;

  return (
    <div className="mt-3 pt-3 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
      {isLoading ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-8 w-full rounded-xl" />
          <Skeleton className="h-8 w-3/4 rounded-xl" />
        </div>
      ) : allComments.length === 0 ? (
        <p className="text-[11px] text-center text-muted-foreground py-3 bg-muted/30 rounded-xl mb-2">첫 번째 댓글을 남겨보세요.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {visibleComments.map((c: any) => (
            <div key={c.id} className="flex gap-2 p-2 rounded-xl hover:bg-muted/40 transition-colors">
              <div className="w-5 h-5 rounded-full bg-slate-200/70 flex items-center justify-center shrink-0 border border-slate-300/40 mt-0.5">
                <span className="text-[8px] font-bold text-slate-500">
                  {c.authorType === "nickname" ? (c.displayName?.charAt(0) || "닉") : "익"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                    <AuthorDisplay displayName={c.displayName} authorType={c.authorType} />
                    {c.isAuthor && (
                      <Badge variant="destructive" className="text-[8px] h-3.5 px-1 bg-red-50 text-red-600 hover:bg-red-100 border-none">
                        글쓴이
                      </Badge>
                    )}
                    <AuthorBadges badges={c.authorBadges} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {c.isMine && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-muted">
                            <MoreVertical className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content); }}>
                            <Pencil className="w-3 h-3 mr-1.5" /> 수정
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive text-xs cursor-pointer" onClick={() => handleDeleteComment(c.id)}>
                            <Trash2 className="w-3 h-3 mr-1.5" /> 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                {editingCommentId === c.id ? (
                  <div className="space-y-1.5 mt-1">
                    <Textarea
                      value={editCommentText}
                      onChange={(e) => setEditCommentText(e.target.value)}
                      className="min-h-[44px] text-xs resize-none bg-background focus-visible:ring-primary/20"
                      maxLength={500}
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setEditingCommentId(null); setEditCommentText(""); }}>
                        취소
                      </Button>
                      <Button size="sm" className="h-6 text-[10px] px-2 bg-primary text-primary-foreground font-bold" disabled={!editCommentText.trim() || updateCommentMutation.isPending} onClick={() => updateCommentMutation.mutate({ commentId: c.id, content: editCommentText.trim() })}>
                        {updateCommentMutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-700 leading-snug break-all">{c.content}</p>
                )}
              </div>
            </div>
          ))}

          {!expanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-[11px] font-bold text-primary/70 hover:text-primary py-1.5 text-center hover:bg-primary/5 rounded-lg transition-colors"
            >
              댓글 {hiddenCount}개 더보기
            </button>
          )}
          {expanded && allComments.length > maxVisible && (
            <button
              onClick={() => setExpanded(false)}
              className="w-full text-[11px] font-bold text-muted-foreground hover:text-foreground py-1.5 text-center hover:bg-muted/50 rounded-lg transition-colors"
            >
              접기
            </button>
          )}
        </div>
      )}

      {/* 댓글 작성 영역 */}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          placeholder={user ? "댓글 남기기..." : "익명으로 댓글을 작성합니다."}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="min-h-[36px] max-h-[80px] rounded-xl border-slate-200 text-xs resize-none bg-muted/40 focus-visible:ring-primary/20 py-2 px-3 flex-1"
          rows={1}
          disabled={commentMutation.isPending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleComment();
            }
          }}
        />
        <Button
          onClick={handleComment}
          disabled={!commentText.trim() || commentMutation.isPending}
          className="rounded-xl h-[36px] px-3 font-bold text-xs shrink-0 self-end bg-primary text-primary-foreground hover:bg-primary/95"
        >
          {commentMutation.isPending ? "..." : "등록"}
        </Button>
      </div>
    </div>
  );
}
