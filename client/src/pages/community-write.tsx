import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Globe, Lock, PenSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CommunityWrite() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const boardFromQuery = new URLSearchParams(search).get("board") || "open";

  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [boardType, setBoardType] = useState<"open" | "members">(boardFromQuery as "open" | "members");
  const [category, setCategory] = useState("자유");

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2">로그인이 필요합니다</h2>
        <p className="text-sm text-muted-foreground mb-6">글을 작성하려면 로그인해 주세요.</p>
        <Button onClick={() => navigate("/login")}>로그인 / 회원가입</Button>
      </div>
    );
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/community/posts", { title, content, boardType, category });
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 min-h-screen bg-slate-50/50">
      <div className="flex items-center gap-3 mb-8">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full hover:bg-white hover:shadow-sm" 
          onClick={() => navigate(`/community?board=${boardType}`)}
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">글쓰기</h1>
          <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-0.5 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"></span>
            anonymous voter mode
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-2xl shadow-slate-200/60 overflow-hidden rounded-[2rem]">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Share your opinion</p>
            <PenSquare className="w-5 h-5 text-slate-500" />
          </div>
          <h2 className="text-2xl font-bold">당권자와 유권자가 듣고 있습니다</h2>
          <p className="text-sm text-slate-400 mt-2 font-medium leading-relaxed">
            건전한 정치 토론 문화가 더 나은 내일을 만듭니다. 작성자는 '익명의 유권자'로 안전하게 보호됩니다.
          </p>
        </div>

        <CardContent className="p-8 space-y-8 bg-white">
          {/* 게시판 선택 탭 */}
          <div className="space-y-3">
            <Label className="text-sm font-black text-slate-700 ml-1">게시판 선택</Label>
            <Tabs value={boardType} onValueChange={(v) => setBoardType(v as "open" | "members")} className="w-full">
              <TabsList className="w-full h-12 p-1 bg-slate-100 rounded-xl">
                <TabsTrigger value="open" className="flex-1 h-full rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all gap-2">
                  <Globe className="w-4 h-4" />
                  자유 게시판
                </TabsTrigger>
                <TabsTrigger value="members" className="flex-1 h-full rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all gap-2">
                  <Lock className="w-4 h-4" />
                  회원 게시판
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 카테고리 셀렉트 */}
            <div className="space-y-3">
              <Label className="text-sm font-black text-slate-700 ml-1">카테고리</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  <SelectItem value="자유" className="rounded-lg font-medium cursor-pointer">💬 자유로운 소통</SelectItem>
                  <SelectItem value="토론" className="rounded-lg font-medium cursor-pointer">⚔️ 진지한 토론</SelectItem>
                  <SelectItem value="정보공유" className="rounded-lg font-medium cursor-pointer">📢 유익한 정보</SelectItem>
                  <SelectItem value="질문" className="rounded-lg font-medium cursor-pointer">❓ 궁금한 점</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="hidden md:block">
              <div className="h-full bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4 flex flex-col justify-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Tip</p>
                <p className="text-xs text-slate-500 leading-tight">적절한 카테고리를 설정하면 더 많은 유권자들이 당신의 의견을 찾기 쉬워집니다.</p>
              </div>
            </div>
          </div>

          {/* 제목 입력 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <Label htmlFor="post-title" className="text-sm font-black text-slate-700">제목</Label>
              <span className={`text-[10px] font-bold ${title.length >= 90 ? 'text-red-500' : 'text-slate-400'}`}>
                {title.length}/100
              </span>
            </div>
            <Input
              id="post-title"
              placeholder="무엇을 이야기하고 싶으신가요?"
              className="h-14 rounded-xl border-slate-200 text-lg font-bold placeholder:text-slate-300 focus:ring-primary/20 transition-all"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* 내용 입력 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <Label htmlFor="post-content" className="text-sm font-black text-slate-700">내용</Label>
              <span className="text-[10px] font-bold text-slate-400">{content.length.toLocaleString()}자 작성됨</span>
            </div>
            <Textarea
              id="post-content"
              placeholder="정책이나 국회의원 행보에 대한 당신의 날카로운 분석이나 소신 있는 의견을 자유롭게 작성하세요."
              className="min-h-[250px] rounded-xl border-slate-200 text-md leading-relaxed placeholder:text-slate-300 focus:ring-primary/20 resize-none p-5 transition-all shadow-inner bg-slate-50/30"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              variant="outline" 
              className="h-14 rounded-2xl border-slate-200 font-bold flex-1 text-slate-600 hover:bg-slate-50"
              onClick={() => navigate(`/community?board=${boardType}`)}
            >
              다음에 쓸게요
            </Button>
            <Button
              size="lg"
              className="h-14 rounded-2xl font-black flex-[2] bg-slate-900 shadow-xl shadow-slate-900/10 hover:shadow-primary/40 text-md transition-all duration-300"
              disabled={!title.trim() || !content.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  게시 중...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  작성 완료하기
                </div>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 px-4 text-center">
        <p className="text-xs text-slate-400 font-medium leading-relaxed">
          커뮤니티 가이드라인을 준수해 주세요. 타인에 대한 비방, 허위 사실 유포 등 부적절한 게시글은 관리자에 의해 제재될 수 있습니다.
        </p>
      </div>
    </div>
  );
}
