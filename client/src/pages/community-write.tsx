import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CommunityWrite() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/community/posts", { title, content });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      toast({ title: "게시글 작성 완료", description: "글이 등록되었습니다." });
      navigate(`/community/${data.id}`);
    },
    onError: () => {
      toast({ title: "오류", description: "글 작성 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-bold mb-2" data-testid="text-auth-required-write">안전한 커뮤니티 조성을 위해 본인인증이 필요합니다</h2>
        <p className="text-sm text-muted-foreground mb-6">
          글을 작성하려면 로그인 후 본인인증을 완료해 주세요.
        </p>
        <Button onClick={() => navigate("/login")} data-testid="button-go-login-write">
          로그인 / 회원가입
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/community")} data-testid="button-back-from-write">
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로
      </Button>

      <h1 className="text-xl font-bold mb-1" data-testid="text-write-title">글쓰기</h1>
      <p className="text-xs text-muted-foreground mb-5">작성자는 '익명의 유권자'로 표시됩니다</p>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">제목</Label>
            <Input
              id="post-title"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              data-testid="input-post-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-content">내용</Label>
            <Textarea
              id="post-content"
              placeholder="정책이나 국회의원 행보에 대한 의견을 자유롭게 작성하세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] resize-none"
              data-testid="input-post-content"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate("/community")} data-testid="button-cancel-write">
              취소
            </Button>
            <Button
              disabled={!title.trim() || !content.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-submit-post"
            >
              {createMutation.isPending ? "작성 중..." : "등록하기"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
