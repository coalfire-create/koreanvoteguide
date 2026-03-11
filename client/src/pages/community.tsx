import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp, ThumbsDown, MessageCircle, PenSquare, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { CommunityPost } from "@shared/schema";

type PostWithCount = CommunityPost & { commentCount: number };

export default function Community() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: posts, isLoading } = useQuery<PostWithCount[]>({
    queryKey: ["/api/community/posts"],
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-bold mb-2" data-testid="text-auth-required">안전한 커뮤니티 조성을 위해 본인인증이 필요합니다</h2>
        <p className="text-sm text-muted-foreground mb-6">
          커뮤니티에 참여하려면 로그인 후 본인인증을 완료해 주세요.
        </p>
        <Button onClick={() => navigate("/login")} data-testid="button-go-login">
          로그인 / 회원가입
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title-community">커뮤니티</h1>
          <p className="text-sm text-muted-foreground">유권자들의 자유로운 의견 공간</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3 mb-3" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground" data-testid="text-no-posts">아직 게시글이 없습니다. 첫 번째 글을 작성해 보세요!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/community/${post.id}`}>
              <Card className="cursor-pointer hover:bg-accent/50 transition-colors" data-testid={`card-post-${post.id}`}>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-1 line-clamp-1" data-testid={`text-post-title-${post.id}`}>{post.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{post.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">익명의 유권자</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsDown className="w-3.5 h-3.5" />
                        {post.dislikes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {post.commentCount}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Button
        size="lg"
        className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg z-40"
        onClick={() => navigate("/community/write")}
        data-testid="button-write-post"
      >
        <PenSquare className="w-5 h-5" />
      </Button>
    </div>
  );
}
