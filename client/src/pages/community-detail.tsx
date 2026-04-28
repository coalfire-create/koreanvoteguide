import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ThumbsUp, ThumbsDown, MessageCircle, ArrowLeft, Flag,
  MoreVertical, CheckCircle, XCircle, Bookmark, BookmarkCheck, Eye,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BADGE_LABELS } from "@shared/schema";

interface SanitizedPost {
  id: string;
  title: string;
  content: string;
  anonNickname: string;
  displayName: string;
  nickname: string;
  boardType: string;
  category: string;
  viewCount: number;
  likes: number;
  dislikes: number;
  agreeCount: number;
  disagreeCount: number;
  authorBadges: string[];
  createdAt: string;
}

interface SanitizedComment {
  id: string;
  postId: string;
  content: string;
  anonNickname: string;
  displayName: string;
  isAuthor: boolean;
  authorBadges: string[];
  createdAt: string;
}

interface PostDetailData {
  post: SanitizedPost;
  comments: SanitizedComment[];
  userReactions: { sentiment: string | null; stance: string | null };
  isBookmarked: boolean;
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
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${info.color}`}
          >
            {info.emoji} {info.label}
          </span>
        );
      })}
    </span>
  );
}

export default function CommunityDetail() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");

  const { data, isLoading } = useQuery<PostDetailData>({
    queryKey: ["/api/community/posts", params.id],
    queryFn: () => apiRequest("GET", `/api/community/posts/${params.id}`).then((r) => r.json()),
  });

  function requireLoginToast() {
    toast({ title: "로그인 필요", description: "이 기능은 로그인 후 이용할 수 있습니다." });
    navigate("/login");
  }

  const reactMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiRequest("POST", `/api/community/posts/${params.id}/react`, { type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/community/posts/${params.id}/bookmark`, {});
      return res.json();
    },
    onSuccess: (result: { bookmarked: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", params.id] });
      toast({
        title: result.bookmarked ? "북마크 추가" : "북마크 해제",
        description: result.bookmarked ? "북마크에 저장되었습니다." : "북마크가 해제되었습니다.",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/community/posts/${params.id}/comments`, { content });
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", params.id] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ reason, postId, commentId }: { reason: string; postId?: string; commentId?: string }) => {
      const res = await apiRequest("POST", "/api/community/report", { reason, postId, commentId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "신고 접수", description: "신고가 접수되었습니다. 검토 후 조치하겠습니다." });
    },
  });

  function handleReact(type: string) {
    if (!user) { requireLoginToast(); return; }
    reactMutation.mutate(type);
  }

  function handleBookmark() {
    if (!user) { requireLoginToast(); return; }
    bookmarkMutation.mutate();
  }

  function handleComment() {
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-center text-muted-foreground">게시글을 찾을 수 없습니다</p>
      </div>
    );
  }

  const { post, comments, userReactions, isBookmarked } = data;
  const totalVotes = post.agreeCount + post.disagreeCount;
  const agreePercent = totalVotes > 0 ? Math.round((post.agreeCount / totalVotes) * 100) : 50;
  const reportReasons = ["허위 정보", "욕설/비방", "스팸/광고", "혐오 표현", "기타"];
  const boardFrom = post.boardType === "members" ? "members" : "open";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate(`/community?board=${boardFrom}`)}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로
      </Button>

      <Card className="mb-4">
        <CardContent className="p-5">
          {/* 제목 + 메뉴 */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {post.category && post.category !== "자유" && (
                  <Badge variant="secondary" className="text-[10px]">{post.category}</Badge>
                )}
                <h1 className="text-lg font-bold">{post.title}</h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>익명의 유권자</span>
                <AuthorBadges badges={post.authorBadges} />
                <span>·</span>
                <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
                <span className="flex items-center gap-0.5">
                  <Eye className="w-3 h-3" /> {post.viewCount}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleBookmark}
                disabled={bookmarkMutation.isPending}
                title={isBookmarked ? "북마크 해제" : "북마크"}
              >
                {isBookmarked
                  ? <BookmarkCheck className="w-4 h-4 text-primary" />
                  : <Bookmark className="w-4 h-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {reportReasons.map((reason) => (
                    <DropdownMenuItem
                      key={reason}
                      onClick={() => user && reportMutation.mutate({ reason, postId: post.id })}
                      className="text-destructive"
                    >
                      <Flag className="w-3.5 h-3.5 mr-2" />
                      신고: {reason}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 본문 */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap mb-5">{post.content}</p>

          {/* 찬반 */}
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="flex items-center gap-1 text-blue-600">
                <CheckCircle className="w-3.5 h-3.5" />
                찬성 {agreePercent}%
              </span>
              <span className="flex items-center gap-1 text-red-500">
                반대 {100 - agreePercent}%
                <XCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <Progress value={agreePercent} className="h-2.5" />
            <p className="text-[11px] text-muted-foreground text-center mt-1.5">총 {totalVotes}명 참여</p>
            <div className="flex gap-2 mt-3">
              <Button
                variant={userReactions.stance === "agree" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleReact("agree")}
                disabled={reactMutation.isPending}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                찬성
              </Button>
              <Button
                variant={userReactions.stance === "disagree" ? "destructive" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleReact("disagree")}
                disabled={reactMutation.isPending}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                반대
              </Button>
            </div>
          </div>

          {/* 좋아요/싫어요 */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className={userReactions.sentiment === "like" ? "text-primary" : ""}
              onClick={() => handleReact("like")}
              disabled={reactMutation.isPending}
            >
              <ThumbsUp className="w-4 h-4 mr-1" />
              {post.likes}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={userReactions.sentiment === "dislike" ? "text-destructive" : ""}
              onClick={() => handleReact("dislike")}
              disabled={reactMutation.isPending}
            >
              <ThumbsDown className="w-4 h-4 mr-1" />
              {post.dislikes}
            </Button>
            <span className="flex items-center gap-1 text-sm text-muted-foreground ml-auto">
              <MessageCircle className="w-4 h-4" />
              {comments.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 댓글 */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold mb-3">댓글 {comments.length}개</h2>
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">아직 댓글이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium">익명의 유권자</span>
                      {c.isAuthor && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">글쓴이</Badge>
                      )}
                      <AuthorBadges badges={c.authorBadges} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {reportReasons.map((reason) => (
                            <DropdownMenuItem
                              key={reason}
                              onClick={() => user && reportMutation.mutate({ reason, commentId: c.id })}
                              className="text-destructive text-xs"
                            >
                              <Flag className="w-3 h-3 mr-1.5" />
                              신고: {reason}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed">{c.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 댓글 입력 */}
      <Card className="mb-20">
        <CardContent className="p-3">
          <>
            <Textarea
              placeholder={user ? "댓글을 작성하세요..." : "비회원으로 댓글을 작성합니다..."}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="mb-2 min-h-[60px] text-sm resize-none"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{commentText.length}/500</span>
              <Button
                size="sm"
                disabled={!commentText.trim() || commentMutation.isPending}
                onClick={handleComment}
              >
                {commentMutation.isPending ? "작성 중..." : "댓글 작성"}
              </Button>
            </div>
          </>
        </CardContent>
      </Card>
    </div>
  );
}
