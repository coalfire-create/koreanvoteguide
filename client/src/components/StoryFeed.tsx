import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ExternalLink, Newspaper, X, ChevronLeft, ChevronRight, BrainCircuit, Lightbulb, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { apiRequest } from "@/lib/queryClient";

interface StoryNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  summary?: string;
}

interface Story {
  id: string;
  name: string;
  party: string;
  photo: string | null;
  hasNews: boolean;
  newsItems: StoryNewsItem[];
}

interface StoriesResponse {
  stories: Story[];
  followedCount: number;
  isRecommended?: boolean;
}

interface AnalysisData {
  summary: string;
  background: string;
  relatedTopics: string[];
  otherPerspectives: string;
}


function formatRelativeTime(pubDate: string): string {
  const diff = Date.now() - new Date(pubDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// ===== 인스타 스토리형 전체화면 뷰어 =====
function StoryViewer({
  stories,
  startIndex,
  onClose,
  onViewStory,
}: {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  onViewStory?: (politicianId: string, newsLink: string) => void;
}) {
  const [personIdx, setPersonIdx] = useState(startIndex);
  const [itemIdx, setItemIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef<number>(Date.now());
  const [progress, setProgress] = useState(0);

  const person = stories[personIdx];
  // 뉴스가 없으면 1장짜리 "뉴스 없음" 슬라이드로 처리
  const slides = person.newsItems.length > 0 ? person.newsItems : [null];
  const current = slides[itemIdx] ?? null;

  // AI 뉴스 분석 쿼리 호출 (동적 라이브 요약)
  const { data: analysisRes, isLoading: isAnalyzing, error: analysisError } = useQuery<{ success: boolean; data: AnalysisData }>({
    queryKey: ["/api/news/analyze", current?.link],
    queryFn: async () => {
      if (!current?.link) throw new Error("No URL provided");
      const res = await apiRequest("POST", "/api/news/analyze", {
        url: current.link,
        title: current.title,
        source: current.source,
      });
      return res.json();
    },
    enabled: !!current?.link,
    staleTime: Infinity,
  });

  const analysis = analysisRes?.data;

  // 자동 넘김 시간을 본문 길이(읽는 시간)에 비례시켜, 긴 요약이 다 읽히기 전에 넘어가지 않게 한다.
  const slideMs = (() => {
    const text = analysis
      ? [analysis.summary, analysis.background, analysis.otherPerspectives].filter(Boolean).join(" ")
      : (current?.summary || current?.title || "");
    // 기본 5초 + 글자당 약 45ms (한국어 읽기 속도), 6~30초로 클램프
    return Math.min(30000, Math.max(6000, 5000 + text.length * 45));
  })();

  const goNext = useCallback(() => {
    if (itemIdx + 1 < slides.length) {
      setItemIdx(itemIdx + 1);
    } else if (personIdx + 1 < stories.length) {
      setPersonIdx(personIdx + 1);
      setItemIdx(0);
    } else {
      onClose();
    }
  }, [itemIdx, personIdx, slides.length, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (itemIdx > 0) {
      setItemIdx(itemIdx - 1);
    } else if (personIdx > 0) {
      const prev = stories[personIdx - 1];
      const prevLen = prev.newsItems.length > 0 ? prev.newsItems.length : 1;
      setPersonIdx(personIdx - 1);
      setItemIdx(prevLen - 1);
    }
    // 첫 슬라이드면 무시
  }, [itemIdx, personIdx, stories]);

  // 자동 재생 + 진행바
  useEffect(() => {
    startRef.current = Date.now();
    setProgress(0);
    if (paused || isAnalyzing) return;
    const tick = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(1, elapsed / slideMs);
      setProgress(pct);
      if (pct >= 1) goNext();
    }, 50);
    return () => clearInterval(tick);
  }, [personIdx, itemIdx, paused, isAnalyzing, goNext, slideMs]);

  // 스토리 시청 완료 처리
  useEffect(() => {
    const person = stories[personIdx];
    const latestNews = person.newsItems[0];
    if (latestNews && onViewStory) {
      onViewStory(person.id, latestNews.link);
    }
  }, [personIdx, stories, onViewStory]);

  // 키보드 (데스크탑) + 스크롤 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goNext, goPrev]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
    >
      {/* 배경: 인물 사진 블러 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 scale-125 blur-2xl opacity-30">
          <PoliticianPhoto
            name={person.name}
            monaCd={person.id}
            photo={person.photo}
            context={person.party || undefined}
            lazy={false}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />
      </div>

      {/* 스토리 카드 (모바일 9:16, 데스크탑 중앙 고정폭) */}
      <div className="relative w-full h-full max-w-[460px] sm:h-[92vh] sm:rounded-2xl overflow-hidden flex flex-col bg-zinc-950">
        {/* 진행바 */}
        <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3">
          {slides.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < itemIdx ? "100%" : i === itemIdx ? `${progress * 100}%` : "0%",
                  transition: i === itemIdx ? "width 50ms linear" : "none",
                }}
              />
            </div>
          ))}
        </div>

        {/* 헤더 */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 pt-7 pb-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 shrink-0 ring-1 ring-white/30">
            <PoliticianPhoto
              name={person.name}
              monaCd={person.id}
              photo={person.photo}
              context={person.party || undefined}
              avatarClassName="w-full h-full flex items-center justify-center bg-white/15 text-white text-sm font-bold"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-white leading-tight truncate">{person.name}</p>
            <p className="text-[11px] text-white/70 leading-tight">
              {person.party}
              {current ? ` · ${formatRelativeTime(current.pubDate)}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 -mr-1 flex items-center justify-center text-white/90 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 좌/우 탭 영역 (z-10) */}
        <button
          aria-label="이전"
          onClick={goPrev}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          className="absolute left-0 top-20 bottom-0 w-[32%] z-10"
        />
        <button
          aria-label="다음"
          onClick={goNext}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          className="absolute right-0 top-20 bottom-0 w-[68%] z-10"
        />

        {/* 본문 (z-20) */}
        <div className="relative z-20 flex-1 flex flex-col justify-between pt-20 px-6 pb-8 h-full">
          {/* 중간 영역: scrollable AI 뉴스 요약 (z-20) — 가용 높이를 꽉 채우고 길면 스크롤 */}
          <div className="flex-1 min-h-0 flex flex-col my-4 overflow-y-auto no-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${personIdx}-${itemIdx}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="w-full flex flex-col gap-3"
              >
                {current ? (
                  isAnalyzing ? (
                    // AI 분석 중 스켈레톤 로더
                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4 animate-pulse">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-blue-400 animate-pulse" />
                        <span className="text-xs font-bold text-white/80">AI가 뉴스를 요약하는 중...</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3.5 bg-white/10 rounded w-full" />
                        <div className="h-3.5 bg-white/10 rounded w-[92%]" />
                        <div className="h-3.5 bg-white/10 rounded w-[85%]" />
                      </div>
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="h-3 bg-white/5 rounded w-16" />
                        <div className="h-3 bg-white/5 rounded w-[70%]" />
                      </div>
                    </div>
                  ) : analysisError || !analysis ? (
                    // 에러 발생 혹은 요약 없음 폴백
                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                      <div className="flex items-center gap-2 mb-3">
                        <Newspaper className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-bold text-white/80">뉴스 요약</span>
                      </div>
                      <p className="text-[14px] text-zinc-300 leading-relaxed">
                        {current.summary || "뉴스 본문 및 요약을 불러오지 못했습니다. 아래 기사 전체 보기 버튼을 눌러 원본 기사를 확인해주세요."}
                      </p>
                    </div>
                  ) : (
                    // AI 뉴스 분석 결과 렌더링
                    <div
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4"
                      onMouseEnter={() => setPaused(true)}
                      onMouseLeave={() => setPaused(false)}
                      onTouchStart={() => setPaused(true)}
                      onTouchEnd={() => setPaused(false)}
                    >
                      {/* 핵심 요약 */}
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-blue-400">
                          <BrainCircuit className="w-4 h-4" />
                          <span className="text-xs font-bold tracking-tight">AI 핵심 요약</span>
                        </div>
                        <p className="text-[14px] text-white/90 font-medium leading-relaxed">
                          {analysis.summary}
                        </p>
                      </div>

                      {/* 배경 지식 */}
                      {analysis.background && (
                        <div className="pt-3 border-t border-white/5">
                          <div className="flex items-center gap-2 mb-1.5 text-amber-400">
                            <Lightbulb className="w-4 h-4" />
                            <span className="text-xs font-bold tracking-tight">배경 및 맥락</span>
                          </div>
                          <p className="text-[12.5px] text-zinc-300 leading-relaxed">
                            {analysis.background}
                          </p>
                        </div>
                      )}

                      {/* 다양한 관점 */}
                      {analysis.otherPerspectives && (
                        <div className="pt-3 border-t border-white/5">
                          <div className="flex items-center gap-2 mb-1.5 text-purple-400">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-bold tracking-tight">다양한 관점</span>
                          </div>
                          <p className="text-[12.5px] text-zinc-400 leading-relaxed">
                            {analysis.otherPerspectives}
                          </p>
                        </div>
                      )}

                      {/* 연관 키워드 */}
                      {analysis.relatedTopics && analysis.relatedTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {analysis.relatedTopics.map((topic, idx) => (
                            <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/5">
                              #{topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="text-center pb-8">
                    <Newspaper className="w-12 h-12 text-white/40 mx-auto mb-4" />
                    <p className="text-[15px] text-white/80 mb-5">
                      최근 48시간 내 관련 뉴스가 없습니다.
                    </p>
                    <Link href={`/members/${person.id}`}>
                      <span
                        onClick={onClose}
                        className="inline-block text-[13px] font-bold text-black bg-white px-4 py-2.5 rounded-full cursor-pointer"
                      >
                        의원 상세 보기
                      </span>
                    </Link>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 하단 영역: 기사 제목 및 원본 링크 (z-20) */}
          {current && (
            <div className="w-full space-y-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/90 bg-white/15 backdrop-blur px-2.5 py-1 rounded-full mb-2">
                  <Newspaper className="w-3 h-3" />
                  {current.source}
                </span>
                <h2 className="text-[17px] sm:text-[19px] font-extrabold text-white leading-snug [text-shadow:0_2px_8px_rgba(0,0,0,0.5)]">
                  {current.title}
                </h2>
              </div>
              <a
                href={current.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 text-[13px] font-bold text-black bg-white hover:bg-zinc-100 px-4 py-2.5 rounded-full active:scale-95 transition-all w-full sm:w-fit"
              >
                기사 전체 보기
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* 데스크탑 좌우 화살표 */}
        <button
          onClick={goPrev}
          aria-label="이전 스토리"
          className="hidden sm:flex absolute -left-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={goNext}
          aria-label="다음 스토리"
          className="hidden sm:flex absolute -right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </motion.div>
  );
}

function StoryAvatar({
  story,
  isViewed,
  onTap,
}: {
  story: Story;
  isViewed: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
    >
      <div className="relative">
        <div className={`p-[2.5px] rounded-full ${isViewed ? "bg-zinc-200 dark:bg-zinc-800" : "bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400 shadow-[0_4px_20px_-4px_rgba(244,63,94,0.45)]"}`}>
          <div className="p-[2px] rounded-full bg-card">
            <div className="w-[68px] h-[68px] rounded-full overflow-hidden bg-muted transition-transform group-hover:scale-[1.04]">
              <PoliticianPhoto
                name={story.name}
                monaCd={story.id}
                photo={story.photo}
                context={story.party || undefined}
                avatarClassName="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-lg font-bold"
              />
            </div>
          </div>
        </div>
        {!isViewed && <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 ring-[3px] ring-background" />}
      </div>
      <span className="text-[11px] font-semibold text-foreground tracking-tight max-w-[72px] truncate">
        {story.name}
      </span>
    </button>
  );
}

function AddTile() {
  return (
    <Link href="/members">
      <div className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group">
        <div className="p-[2.5px] rounded-full bg-muted">
          <div className="p-[2px] rounded-full bg-card">
            <div className="w-[68px] h-[68px] rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors">
              <Plus className="w-7 h-7 stroke-[1.5]" />
            </div>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">추가</span>
      </div>
    </Link>
  );
}

function SkeletonTile() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="w-[78px] h-[78px] rounded-full bg-muted animate-pulse" />
      <div className="w-10 h-2.5 rounded bg-muted animate-pulse" />
    </div>
  );
}

export function StoryFeed({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewedStories, setViewedStories] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("viewed_stories");
      if (saved) {
        setViewedStories(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const markStoryAsViewed = useCallback((politicianId: string, newsLink: string) => {
    setViewedStories((prev) => {
      if (prev[politicianId] === newsLink) return prev;
      const updated = { ...prev, [politicianId]: newsLink };
      try {
        localStorage.setItem("viewed_stories", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const { data, isLoading } = useQuery<StoriesResponse>({
    queryKey: ["/api/feed/stories"],
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  if (!user) return null;

  const stories = data?.stories ?? [];
  const followedCount = data?.followedCount ?? 0;
  const hasNews = stories.length > 0;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`px-5 pt-3 ${className}`}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[13px] font-bold text-foreground tracking-tight flex items-center gap-1.5">
            {data?.isRecommended ? "추천 활동 의원" : "관심 의원"}
            {hasNews && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                {data?.isRecommended ? "추천" : "NEW"}
              </span>
            )}
          </h3>
          {stories.length > 0 && (
            <Link href="/members?tab=discover">
              <span className="text-[11px] font-semibold text-muted-foreground hover:text-primary cursor-pointer">
                전체보기
              </span>
            </Link>
          )}
        </div>

        <div className="flex items-start gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
          {isLoading ? (
            <>
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
            </>
          ) : stories.length === 0 ? (
            <>
              <AddTile />
              <div className="flex-1 min-w-0 self-center">
                {followedCount > 0 ? (
                  <p className="text-[12px] text-muted-foreground leading-snug">
                    최근 48시간 내 관심 의원의<br />공개 활동이 없어요.
                  </p>
                ) : (
                  <p className="text-[12px] text-muted-foreground leading-snug">
                    관심 의원을 팔로우하면<br />여기에서 활동을 바로 확인할 수 있어요.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {stories.map((s, i) => {
                const latestNews = s.newsItems[0];
                const isViewed = latestNews ? viewedStories[s.id] === latestNews.link : false;
                return (
                  <StoryAvatar
                    key={s.id}
                    story={s}
                    isViewed={isViewed}
                    onTap={() => setViewerIndex(i)}
                  />
                );
              })}
              <AddTile />
            </>
          )}
        </div>
      </motion.section>

      <AnimatePresence>
        {viewerIndex !== null && stories[viewerIndex] && (
          <StoryViewer
            stories={stories}
            startIndex={viewerIndex}
            onClose={() => setViewerIndex(null)}
            onViewStory={markStoryAsViewed}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default StoryFeed;
