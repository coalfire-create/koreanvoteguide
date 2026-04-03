import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, BrainCircuit, Lightbulb, BookOpen, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface NewsAnalysisDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  news: {
    title: string;
    url: string;
    source: string;
  } | null;
}

interface AnalysisData {
  summary: string;
  background: string;
  relatedTopics: string[];
  otherPerspectives: string;
}

function formatText(text: string | undefined) {
  if (!text) return null;
  return text.split('\n').map((line, i) => (
    <span key={i}>
      {line}
      <br />
    </span>
  ));
}

export function NewsAnalysisDialog({ isOpen, onOpenChange, news }: NewsAnalysisDialogProps) {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: AnalysisData }>({
    queryKey: ["/api/news/analyze", news?.url],
    queryFn: async () => {
      if (!news?.url) throw new Error("No URL provided");
      const res = await apiRequest("POST", "/api/news/analyze", {
        url: news.url,
        title: news.title,
        source: news.source,
      });
      return res.json();
    },
    enabled: !!news?.url && isOpen,
    staleTime: Infinity,
  });

  const analysis = data?.data;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto sm:rounded-2xl border-border/50 shadow-2xl p-0 gap-0">
        <div className="p-6 pb-2">
          <DialogHeader className="mb-2 text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  {news?.source || "뉴스"}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 bg-accent/50 px-2 py-1 rounded-full">
                  <BrainCircuit className="w-3 h-3 text-primary/70" /> AI 분석 리포트
                </span>
              </div>
            </div>
            <DialogTitle className="text-lg font-bold leading-snug">{news?.title}</DialogTitle>
            <DialogDescription className="sr-only">기사 다각도 분석 결과</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 pt-2">
          {isLoading ? (
            <div className="space-y-6 pt-4 animate-in fade-in duration-500">
              <div className="space-y-3">
                <Skeleton className="h-5 w-32 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[95%]" />
                  <Skeleton className="h-4 w-[80%]" />
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-40 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[85%]" />
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-24 rounded-md" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-16 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-7 w-14 rounded-full" />
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="py-12 text-center flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
              <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">본문 인식을 지원하지 않는 기사입니다</p>
              <p className="text-xs text-muted-foreground mb-5 px-6 leading-relaxed">
                언론사 정책(접근 차단) 등으로 인해 본문을 가져올 수 없습니다. 원본 페이지에서 확인해주세요.
              </p>
              <Button variant="default" className="shadow-sm gap-2" asChild>
                <a href={news?.url} target="_blank" rel="noopener noreferrer">
                  전문 보기 <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            </div>
          ) : analysis ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <section className="relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-full" />
                <div className="pl-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-2.5 text-foreground">
                    <BookOpen className="w-4 h-4 text-blue-500" /> 핵심 요약
                  </h3>
                  <div className="text-sm leading-relaxed text-foreground/90 font-medium">
                    {formatText(analysis.summary)}
                  </div>
                </div>
              </section>

              <section className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-2.5 text-amber-700 dark:text-amber-500">
                  <Lightbulb className="w-4 h-4" /> 배경 지식
                </h3>
                <div className="text-[13px] leading-relaxed text-amber-900/80 dark:text-amber-200/70">
                  {formatText(analysis.background)}
                </div>
              </section>

              <section className="relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 rounded-full" />
                <div className="pl-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-2.5 text-foreground">
                    <Users className="w-4 h-4 text-purple-500" /> 다양한 관점
                  </h3>
                  <div className="text-[13px] leading-relaxed text-muted-foreground">
                    {formatText(analysis.otherPerspectives)}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-3">연관 키워드</h3>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.relatedTopics.map((topic, i) => (
                    <span key={i} className="px-3 py-1 bg-accent/60 hover:bg-accent/80 transition-colors text-accent-foreground rounded-full text-[11px] font-medium border border-border/50">
                      #{topic}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {!error && (
            <div className="mt-8 pt-5 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-[10px] text-muted-foreground/50 max-w-[200px] text-center sm:text-left leading-tight">
                AI 분석 결과는 사실 여부를 보증하지 않으며 부정확할 수 있습니다.
              </p>
              <Button asChild variant="default" className="w-full sm:w-auto shadow-sm gap-2">
                <a href={news?.url} target="_blank" rel="noopener noreferrer">
                  전문 보기 <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
