import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Newspaper, Layers, AlignJustify, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { NewsAnalysisDialog } from "@/components/news-analysis-dialog";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceCode: string;
  thumbnail?: string;
}

interface NewsGroup {
  headline: string;
  articles: NewsItem[];
}

interface NewsResponse {
  items: NewsItem[];
  sources: string[];
  grouped?: NewsGroup[];
}

const SOURCE_COLORS: Record<string, string> = {
  yna:      "bg-red-100 text-red-700 border-red-200",
  kbs:      "bg-blue-100 text-blue-700 border-blue-200",
  mbc:      "bg-purple-100 text-purple-700 border-purple-200",
  sbs:      "bg-pink-100 text-pink-700 border-pink-200",
  jtbc:     "bg-orange-100 text-orange-700 border-orange-200",
  ytn:      "bg-sky-100 text-sky-700 border-sky-200",
  hani:     "bg-green-100 text-green-700 border-green-200",
  khan:     "bg-teal-100 text-teal-700 border-teal-200",
  chosun:   "bg-slate-100 text-slate-700 border-slate-200",
  joongang: "bg-amber-100 text-amber-700 border-amber-200",
  donga:    "bg-indigo-100 text-indigo-700 border-indigo-200",
  news1:    "bg-rose-100 text-rose-700 border-rose-200",
};

function SourceBadge({ source, sourceCode, size = "sm" }: { source: string; sourceCode: string; size?: "sm" | "xs" }) {
  const color = SOURCE_COLORS[sourceCode] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center font-semibold border rounded-full ${
      size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
    } ${color}`}>
      {source}
    </span>
  );
}

function formatTime(pubDate: string): string {
  if (!pubDate) return "";
  try {
    const date = new Date(pubDate);
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "방금";
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch {
    return "";
  }
}

function GroupedCard({ group, onNewsClick }: { group: NewsGroup; onNewsClick: (news: { title: string; url: string; source: string }) => void }) {
  const [expanded, setExpanded] = useState(false);
  const extraCount = group.articles.length - 1;
  const uniqueSources = Array.from(new Set(group.articles.map((a) => a.source)));

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* 헤드라인 기사 */}
        <button
          onClick={() => onNewsClick({ title: group.articles[0].title, url: group.articles[0].link, source: group.articles[0].source })}
          className="w-full text-left flex items-start gap-3 p-4 hover:bg-accent/40 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-2">
              {group.headline}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {uniqueSources.slice(0, 6).map((src) => {
                const art = group.articles.find((a) => a.source === src)!;
                return <SourceBadge key={src} source={src} sourceCode={art.sourceCode} size="xs" />;
              })}
              {uniqueSources.length > 6 && (
                <span className="text-[10px] text-muted-foreground">+{uniqueSources.length - 6}개</span>
              )}
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
        </button>

        {/* 다른 언론사 보도 */}
        {extraCount > 0 && (
          <div className="border-t border-border/50">
            <button
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-accent/30 transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              <span className="font-medium">{extraCount}개 언론사 추가 보도</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expanded && (
              <div className="divide-y divide-border/30">
                {group.articles.slice(1).map((art, i) => (
                  <button
                    key={i}
                    onClick={() => onNewsClick({ title: art.title, url: art.link, source: art.source })}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group"
                  >
                    <SourceBadge source={art.source} sourceCode={art.sourceCode} size="xs" />
                    <p className="flex-1 text-xs text-muted-foreground leading-snug line-clamp-2 group-hover:text-foreground transition-colors">
                      {art.title}
                    </p>
                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ALL_SOURCES = [
  { code: "all",      label: "전체" },
  { code: "yna",      label: "연합뉴스" },
  { code: "kbs",      label: "KBS" },
  { code: "mbc",      label: "MBC" },
  { code: "sbs",      label: "SBS" },
  { code: "jtbc",     label: "JTBC" },
  { code: "ytn",      label: "YTN" },
  { code: "hani",     label: "한겨레" },
  { code: "khan",     label: "경향신문" },
  { code: "chosun",   label: "조선일보" },
  { code: "joongang", label: "중앙일보" },
  { code: "donga",    label: "동아일보" },
  { code: "news1",    label: "뉴스1" },
];

export default function NewsPage() {
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedNews, setSelectedNews] = useState<{ title: string; url: string; source: string } | null>(null);

  const { data: listData, isLoading: listLoading } = useQuery<NewsResponse>({
    queryKey: ["/api/news", selectedSource],
    queryFn: () => {
      const p = new URLSearchParams();
      if (selectedSource !== "all") p.set("source", selectedSource);
      return apiRequest("GET", `/api/news?${p}`).then((r) => r.json());
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    enabled: viewMode === "list",
  });

  const { data: groupedData, isLoading: groupLoading } = useQuery<NewsResponse>({
    queryKey: ["/api/news", "grouped"],
    queryFn: () => apiRequest("GET", "/api/news?view=grouped").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    enabled: viewMode === "grouped",
  });

  const items = listData?.items ?? [];
  const grouped = groupedData?.grouped ?? [];

  // 방송사별 기사 수
  const sourceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (listData?.items ?? []).forEach((item) => {
      map[item.sourceCode] = (map[item.sourceCode] ?? 0) + 1;
    });
    return map;
  }, [listData]);

  const isLoading = viewMode === "list" ? listLoading : groupLoading;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-5">
        <Newspaper className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">정치 뉴스</h1>
          <p className="text-xs text-muted-foreground">주요 언론사 정치 뉴스 모아보기</p>
        </div>
      </div>

      {/* 보기 모드 탭 */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "grouped")} className="mb-4">
        <TabsList className="w-full">
          <TabsTrigger value="list" className="flex-1 gap-1.5">
            <AlignJustify className="w-3.5 h-3.5" />
            언론사별
          </TabsTrigger>
          <TabsTrigger value="grouped" className="flex-1 gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            주제별 (다언론 비교)
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 언론사 필터 (목록 보기에서만) */}
      {viewMode === "list" && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {ALL_SOURCES.map(({ code, label }) => {
            const isActive = selectedSource === code;
            const count = code === "all"
              ? (listData?.items.length ?? 0)
              : sourceCounts[code] ?? 0;
            const colorClass = SOURCE_COLORS[code] ?? "";
            return (
              <button
                key={code}
                onClick={() => setSelectedSource(code)}
                className={`shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  isActive
                    ? code === "all"
                      ? "bg-primary text-white border-primary"
                      : colorClass + " border-current"
                    : "bg-background border-border text-muted-foreground hover:border-primary"
                }`}
              >
                <span>{label}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold ${isActive ? "opacity-80" : "opacity-60"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 콘텐츠 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-3" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === "grouped" ? (
        // 주제별 그룹
        <div className="space-y-3">
          {grouped.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
              뉴스를 불러오는 중입니다...
            </CardContent></Card>
          ) : (
            grouped.map((group, i) => (
              <GroupedCard key={i} group={group} onNewsClick={setSelectedNews} />
            ))
          )}
        </div>
      ) : (
        // 언론사별 목록
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {selectedSource === "all" ? "뉴스를 불러오는 중입니다..." : "해당 언론사의 뉴스가 없습니다."}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedNews({ title: item.title, url: item.link, source: item.source })}
                  className="w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-accent/40 transition-colors group"
                >
                  <span className="text-xs font-bold text-primary/40 w-5 shrink-0 mt-0.5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <SourceBadge source={item.source} sourceCode={item.sourceCode} size="xs" />
                      {item.pubDate && (
                        <span className="text-[11px] text-muted-foreground">{formatTime(item.pubDate)}</span>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 갱신 안내 */}
      <p className="text-center text-xs text-muted-foreground mt-6">15분마다 자동 갱신 · 각 언론사 RSS 기반</p>

      <NewsAnalysisDialog
        isOpen={!!selectedNews}
        onOpenChange={(open) => !open && setSelectedNews(null)}
        news={selectedNews}
      />
    </div>
  );
}
