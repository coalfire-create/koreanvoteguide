import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Bookmark, ThumbsUp, MessageCircle, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { BADGE_LABELS } from "@shared/schema";
import type { CommunityPost } from "@shared/schema";

type PostWithCount = CommunityPost & { commentCount: number; authorBadges: string[] };

function AuthorBadges({ badges }: { badges: string[] }) {
  if (!badges?.length) return null;
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {badges.map((b) => {
        const info = BADGE_LABELS[b];
        if (!info) return null;
        return (
          <span key={b} className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${info.color}`}>
            {info.emoji} {info.label}
          </span>
        );
      })}
    </span>
  );
}

export default function CommunityBookmarks() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: posts, isLoading } = useQuery<PostWithCount[]>({
    queryKey: ["/api/community/bookmarks"],
    queryFn: () => apiRequest("GET", "/api/community/bookmarks").then((r) => r.json()),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <Bookmark className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="font-bold mb-2">로그인이 필요합니다</h2>
        <Button onClick={() => navigate("/login")}>로그인</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/more")}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        마이페이지
      </Button>

      <div className="flex items-center gap-2 mb-5">
        <Bookmark className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">북마크한 게시글</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-4 w-1/3" /></CardContent></Card>
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bookmark className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">북마크한 게시글이 없습니다.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/community")}>
              커뮤니티 보러 가기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/community/${post.id}`}>
              <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-1 line-clamp-1">{post.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{post.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">익명의 유권자</span>
                      <AuthorBadges badges={post.authorBadges} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.viewCount}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{post.likes}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{post.commentCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
