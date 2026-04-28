import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Globe, Lock, PenSquare, Image as ImageIcon, X, Search, User, FileText, Tag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PostEditor } from "@/components/PostEditor";

// Board configs
const BOARD_CONFIGS = {
  free: { label: "자유게시판", icon: Globe, showTag: false },
  legislators: { label: "국회의원 게시판", icon: User, showTag: true, tagType: "legislator" as const },
  bills: { label: "법안 게시판", icon: FileText, showTag: true, tagType: "bill" as const },
  candidate: { label: "후보자 게시판", icon: PenSquare, showTag: true, tagType: "candidate" as const },
} as const;

type BoardType = keyof typeof BOARD_CONFIGS;

// Tag search component
function TagSearch({ tagType, selectedTag, onSelect }: {
  tagType: "legislator" | "bill" | "candidate";
  selectedTag: { id: string; name: string } | null;
  onSelect: (tag: { id: string; name: string } | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch legislators or bills
  const { data: legislators } = useQuery<any[]>({
    queryKey: ["/api/db/legislators"],
    queryFn: () => fetch("/api/db/legislators").then(r => r.json()),
    enabled: tagType === "legislator",
    staleTime: 30 * 60 * 1000,
  });

  const { data: bills } = useQuery<any[]>({
    queryKey: ["/api/db/bills"],
    queryFn: () => fetch("/api/db/bills").then(r => r.json()),
    enabled: tagType === "bill",
    staleTime: 30 * 60 * 1000,
  });

  const items = tagType === "legislator"
    ? (legislators || []).map(l => ({ id: l.monaCd, name: `${l.name} (${l.party})`, rawName: l.name }))
    : tagType === "bill"
    ? (bills || []).map(b => ({ id: b.billId, name: b.billName, rawName: b.billName }))
    : []; // candidate tags are usually pre-filled from detail pages

  const filtered = query.trim()
    ? items.filter(item => item.name.includes(query) || item.rawName.includes(query)).slice(0, 8)
    : items.slice(0, 5);

  if (selectedTag) {
    return (
      <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
        <Tag className="w-4 h-4 text-primary shrink-0" />
        <span className="text-[13px] font-bold text-primary flex-1">{selectedTag.name}</span>
        <button onClick={() => onSelect(null)} className="p-0.5 hover:bg-primary/10 rounded-full transition-colors">
          <X className="w-4 h-4 text-primary/60" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder={tagType === "legislator" ? "국회의원 이름을 검색하세요..." : "법안 이름을 검색하세요..."}
          className="w-full h-11 pl-10 pr-4 text-[14px] rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
        />
      </div>
      {showResults && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[220px] overflow-y-auto">
          {filtered.length > 0 ? filtered.map((item) => (
            <button
              key={item.id}
              className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
              onClick={() => { onSelect({ id: item.id, name: item.rawName }); setQuery(""); setShowResults(false); }}
            >
              {tagType === "legislator" ? <User className="w-3.5 h-3.5 inline mr-2 text-indigo-500" /> : <FileText className="w-3.5 h-3.5 inline mr-2 text-emerald-500" />}
              {item.name}
            </button>
          )) : (
            <div className="px-4 py-6 text-center text-[13px] text-slate-400">
              {query ? "검색 결과가 없습니다" : tagType === "legislator" ? "국회의원 데이터를 불러오는 중..." : "법안 데이터를 불러오는 중..."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommunityWrite() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const boardFromQuery = searchParams.get("board") || "free";
  const tagTypeFromQuery = searchParams.get("tagType");
  const tagIdFromQuery = searchParams.get("tagId");
  const tagNameFromQuery = searchParams.get("tagName");

  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [boardType, setBoardType] = useState<BoardType>(boardFromQuery as BoardType);
  const [category, setCategory] = useState("자유");
  const [authorType, setAuthorType] = useState<"anonymous" | "nickname" | "realname">(
    (user as any)?.realNameVerified ? "anonymous" : (user as any)?.nickname ? "nickname" : "anonymous"
  );
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<{ id: string; name: string } | null>(
    tagIdFromQuery && tagNameFromQuery ? { id: tagIdFromQuery, name: tagNameFromQuery } : null
  );

  useEffect(() => {
    if (tagTypeFromQuery === "candidate") {
      setBoardType("candidate" as BoardType);
    } else if (tagTypeFromQuery === "legislator") {
      setBoardType("legislators");
    } else if (tagTypeFromQuery === "bill") {
      setBoardType("bills");
    }
  }, [tagTypeFromQuery]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRealNameVerified = (user as any)?.realNameVerified === true;
  const boardConfig = BOARD_CONFIGS[boardType];

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "오류", description: "이미지는 5MB 이하만 가능합니다.", variant: "destructive" });
      return;
    }
    setThumbnailUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("업로드 실패");
      const data = await res.json();
      setThumbnailUrl(data.url);
    } catch {
      toast({ title: "오류", description: "이미지 업로드에 실패했습니다.", variant: "destructive" });
    }
    setThumbnailUploading(false);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title,
        content,
        boardType: boardType === "free" ? "open" : boardType === "legislators" ? "open" : "open",
        category,
        authorType,
        contentType: "rich",
        attachments,
        thumbnailUrl,
        tagType: boardConfig.showTag ? (BOARD_CONFIGS[boardType] as any).tagType : null,
        tagId: selectedTag?.id || null,
        tagName: selectedTag?.name || null,
      };
      if (boardType === "legislators" && selectedTag) {
        payload.legislatorId = selectedTag.id;
      }
      const res = await apiRequest("POST", "/api/community/posts", payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "오류");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      toast({ title: "게시글 작성 완료", description: "글이 등록되었습니다." });
      navigate(`/community/${data.id}`);
    },
    onError: (err: any) => {
      toast({ title: "오류", description: err.message || "글 작성 중 오류가 발생했습니다.", variant: "destructive" });
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
            <Tabs value={boardType} onValueChange={(v) => { setBoardType(v as BoardType); setSelectedTag(null); }} className="w-full">
              <TabsList className="w-full h-12 p-1 bg-slate-100 rounded-xl">
                <TabsTrigger value="free" className="flex-1 h-full rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm transition-all gap-1.5 text-[12px]">
                  <Globe className="w-4 h-4" /> 자유
                </TabsTrigger>
                <TabsTrigger value="legislators" className="flex-1 h-full rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all gap-1.5 text-[12px]">
                  <User className="w-4 h-4" /> 국회의원
                </TabsTrigger>
                <TabsTrigger value="bills" className="flex-1 h-full rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all gap-1.5 text-[12px]">
                  <FileText className="w-4 h-4" /> 법안
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 태그 선택 (국회의원/법안 게시판일 때만) */}
          {boardConfig.showTag && (
            <div className="space-y-3">
              <Label className="text-sm font-black text-slate-700 ml-1 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-primary" />
                {boardType === "legislators" ? "국회의원 태그" : "법안 태그"}
                <span className="text-[10px] font-medium text-red-500 ml-1">필수</span>
              </Label>
              <p className="text-[11px] text-slate-400 ml-1 -mt-1">
                {boardType === "legislators" ? "이 글이 어떤 국회의원에 대한 글인지 태그해주세요." : "이 글이 어떤 법안에 대한 글인지 태그해주세요."}
              </p>
              <TagSearch
                tagType={(BOARD_CONFIGS[boardType] as any).tagType}
                selectedTag={selectedTag}
                onSelect={setSelectedTag}
              />
            </div>
          )}

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

          {/* 작성자 표시 선택 */}
          <div className="space-y-3">
            <Label className="text-sm font-black text-slate-700 ml-1">작성자 표시</Label>
            <div className="p-4 bg-slate-50 rounded-xl space-y-2.5">
              {!user ? (
                <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl font-medium flex items-center justify-between border border-slate-100">
                  <span>익명으로 올리기</span>
                  <Link href="/login">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold rounded-lg border-slate-200">로그인하기</Button>
                  </Link>
                </div>
              ) : (
                isRealNameVerified ? (
                  ["anonymous", "nickname", "realname"].map((type) => (
                    <label key={type} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="write-authorType" value={type} checked={authorType === type} onChange={() => setAuthorType(type as any)} className="accent-primary" />
                      <span className="text-sm font-medium text-slate-700">
                        {type === "anonymous" && "익명으로 올리기"}
                        {type === "nickname" && `닉네임으로 올리기 ${ (user as any).nickname ? `(${(user as any).nickname})` : "— 닉네임 미설정"}`}
                        {type === "realname" && (
                          <span className="flex items-center gap-1">실명인증으로 올리기<span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">실명</span></span>
                        )}
                      </span>
                    </label>
                  ))
                ) : (
                  <>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="write-authorType" value="anonymous" checked={authorType === "anonymous"} onChange={() => setAuthorType("anonymous")} className="accent-primary" />
                      <span className="text-sm font-medium text-slate-700">익명으로 올리기</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="write-authorType" value="nickname" checked={authorType === "nickname"} onChange={() => setAuthorType("nickname")} className="accent-primary" disabled={!(user as any).nickname} />
                      <span className={`text-sm font-medium ${ !(user as any).nickname ? "text-slate-300" : "text-slate-700" }`}>닉네임으로 올리기 {(user as any).nickname ? `(${(user as any).nickname})` : "— 마이페이지에서 닉네임 설정"}</span>
                    </label>
                  </>
                )
              )}
            </div>
          </div>

          {/* 제목 + 썸네일 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <Label htmlFor="post-title" className="text-sm font-black text-slate-700">제목</Label>
              <span className={`text-[10px] font-bold ${title.length >= 90 ? 'text-red-500' : 'text-slate-400'}`}>
                {title.length}/100
              </span>
            </div>
            <div className="flex gap-3">
              {/* Thumbnail upload */}
              <div className="shrink-0">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                {thumbnailUrl ? (
                  <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={thumbnailUrl} alt="썸네일" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setThumbnailUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={thumbnailUploading}
                    className="w-[72px] h-[72px] rounded-xl border-2 border-dashed border-slate-200 hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    {thumbnailUploading ? (
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                        <span className="text-[9px] text-slate-400 font-bold">대표사진</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <Input
                id="post-title"
                placeholder="무엇을 이야기하고 싶으신가요?"
                className="h-[72px] rounded-xl border-slate-200 text-lg font-bold placeholder:text-slate-300 focus:ring-primary/20 transition-all flex-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          {/* 내용 입력 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <Label htmlFor="post-content" className="text-sm font-black text-slate-700">내용</Label>
            </div>
            <PostEditor
              content={content}
              onChange={setContent}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
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
              disabled={!title.trim() || !content.trim() || createMutation.isPending || (boardConfig.showTag && !selectedTag)}
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
