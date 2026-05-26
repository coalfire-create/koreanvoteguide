import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronRight, Bell, HelpCircle, Plus, ChevronLeft, TrendingUp, Sparkles, Users, MessageSquare, Flame, Landmark } from "lucide-react";
import { NotificationPanel, useHasUnread } from "@/components/NotificationPanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { saveCandidateToSession } from "@/pages/candidate-detail";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import { getPartyRank } from "@/lib/mock-data";
import PledgeDetailView, { type CompareWith } from "@/components/PledgeDetailView";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import TopicAnalysisView from "@/components/TopicAnalysisView";
import { FeedCard, type FeedItem } from "@/components/FeedCard";
import { DailyPollWidget } from "@/components/DailyPollWidget";

// 후보 영역 로딩용 Skeleton — 실제 카드와 같은 골격을 회색 펄스로 그린다.
// 헤더/사이드 위젯은 그대로 두고 이 부분만 데이터 도착 시 교체된다.
function CandidatesSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden animate-pulse shadow-sm">
      <div className="px-8 pt-8 pb-8">
        <div className="h-6 w-48 bg-muted rounded mb-8" />
        {/* VS Matchup Skeleton */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12 py-4">
          <div className="flex flex-col items-center">
            <div className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-full bg-muted mb-6" />
            <div className="w-24 h-6 bg-muted rounded mb-2" />
            <div className="w-16 h-4 bg-muted/60 rounded" />
          </div>
          <div className="hidden md:flex flex-col items-center justify-center py-4">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="h-12 w-px bg-muted mt-4" />
          </div>
          <div className="flex flex-col items-center">
            <div className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-full bg-muted mb-6" />
            <div className="w-24 h-6 bg-muted rounded mb-2" />
            <div className="w-16 h-4 bg-muted/60 rounded" />
          </div>
        </div>
        {/* Minor Candidates Skeleton */}
        <div className="mt-12 pt-8 border-t border-border/30">
          <div className="h-4 w-40 bg-muted rounded mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-[2rem] p-5 border border-border/30">
                <div className="flex flex-col items-center">
                  <div className="w-[90px] h-[90px] rounded-full bg-muted mb-4" />
                  <div className="w-16 h-4 bg-muted rounded mb-2" />
                  <div className="w-12 h-3 bg-muted/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Divider */}
      <div className="mx-8 border-t border-border/30" />
      {/* Pledge Skeleton */}
      <div className="p-8">
        <div className="h-6 w-40 bg-muted rounded mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-4">
              <div className="h-4 w-32 bg-muted rounded mb-2" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="bg-card p-5 rounded-2xl border border-border/30">
                  <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                  <div className="h-3 w-1/2 bg-muted/60 rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// 선거 주요 일정 위젯 (DB 연동)
// ─────────────────────────────────────────────
interface ScheduleItem {
  id: number;
  title: string;
  eventDate: string;       // ISO 문자열 (서버에서 timestamp → JSON 직렬화)
  description: string | null;
  region: string;
}

const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_ABBR[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

/** 오늘 자정 기준 D-Day 계산. 음수면 지난 일정. 0이면 D-DAY. */
function calculateDDay(iso: string): number {
  const target = new Date(iso);
  const today = new Date();
  // 자정 기준으로 정규화 — 시·분 차이로 D-Day 가 ±1 흔들리는 것 방지
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
}

function formatDDayLabel(days: number): string {
  if (days === 0) return "D-DAY";
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

function ScheduleWidget({ regionName }: { regionName?: string }) {
  // region 미지정 시 전국 일정만 표시되도록 query param 생략
  const queryKey = regionName
    ? ["/api/schedules", regionName]
    : ["/api/schedules"];

  const { data, isLoading, isError } = useQuery<ScheduleItem[]>({
    queryKey,
    queryFn: async ({ signal }) => {
      const url = regionName
        ? `/api/schedules?region=${encodeURIComponent(regionName)}`
        : "/api/schedules";
      const res = await fetch(url, { signal, credentials: "include" });
      if (!res.ok) throw new Error("일정 조회 실패");
      return (await res.json()) as ScheduleItem[];
    },
    staleTime: 10 * 60 * 1000, // 10분
  });

  const items = (data ?? []).slice(0, 5); // UI 부담 방지 — 가까운 5건만
  const headlineDday = items.length > 0 ? calculateDDay(items[0].eventDate) : null;

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-foreground text-[15px]">선거 주요 일정</h3>
        {headlineDday !== null && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
            {formatDDayLabel(headlineDday)}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-3 h-3 mt-1 rounded-full bg-muted" />
              <div className="flex-1">
                <div className="h-3 w-12 bg-muted rounded mb-1" />
                <div className="h-4 w-40 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-[12px] text-muted-foreground">일정을 불러오지 못했습니다.</p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <p className="text-[12px] text-muted-foreground">예정된 선거 일정이 없습니다.</p>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="relative pl-3 space-y-6">
          {/* Timeline line */}
          <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-border/30 z-0" />

          {items.map((item, idx) => {
            const isNext = idx === 0; // 가장 가까운 일정만 강조
            const dotClass = isNext
              ? "bg-background border-[3px] border-primary"
              : "bg-background border-[3px] border-border/30";
            const titleClass = isNext
              ? "text-[13px] font-bold text-foreground"
              : "text-[13px] font-bold text-foreground opacity-60";

            return (
              <div key={item.id} className="relative z-10 flex gap-4">
                <div className={`w-3 h-3 mt-1 rounded-full flex-shrink-0 ${dotClass}`} />
                <div>
                  <div className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">
                    {formatMonthDay(item.eventDate)}
                    <span className="ml-2 text-[10px] text-primary font-bold">
                      {formatDDayLabel(calculateDDay(item.eventDate))}
                    </span>
                  </div>
                  <div className={titleClass}>{item.title}</div>
                  {item.description && (
                    <div className="text-[11px] text-muted-foreground mt-1">{item.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ regionName }: { regionName: string }) {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm px-6 py-16 flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground font-medium">{regionName} 지역의 등록된 후보자가 아직 없습니다.</p>
      <Link href="/city-select">
        <Button variant="outline" className="border-border/30 text-foreground hover:bg-muted">지역 다시 선택하기</Button>
      </Link>
    </div>
  );
}

// DB에서 오는 pledges 필드는 ["1. 제목", "2. 제목", ...] 형태의 문자열 배열
// 또는 NEC API 구조화 객체 {order, realmName, title, goalCont, methCont, distCont, deptCont}
// 또는 간단한 {id, title, description} 객체 배열일 수도 있음 — 양쪽 모두 처리
function normalizePledges(raw: any[]): { id: string; title: string; description: string; realmName?: string; content?: string; method?: string; funding?: string; duration?: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, i) => {
    if (typeof item === "string") {
      // "1. 제목" → "제목"
      const title = item.replace(/^\d+\.\s*/, "").trim();
      return { id: `p${i}`, title, description: "" };
    }
    // NEC API 구조화 데이터 보존
    return {
      id: item.id ?? `p${i}`,
      title: item.title ?? String(item),
      description: item.description ?? item.goalCont ?? "",
      realmName: item.realmName ?? undefined,
      content: item.content ?? item.goalCont ?? undefined,
      method: item.method ?? item.methCont ?? undefined,
      funding: item.funding ?? item.deptCont ?? undefined,
      duration: item.duration ?? item.distCont ?? undefined,
    };
  });
}

// 공약 인덱스별 중앙 배지 라벨
// PLEDGE_TOPIC_LABELS 제거됨 — 실 공약 데이터 기반 렌더링으로 전환

const getPartyColor = (party: string) => {
  if (party?.includes("민주당")) return "bg-[#3A6BFF]";
  if (party?.includes("국민의힘")) return "bg-[#FF3B3B]";
  if (party?.includes("조국혁신당")) return "bg-blue-800";
  if (party?.includes("개혁신당")) return "bg-[#FF8C00]";
  if (party?.includes("진보당")) return "bg-[#D60024]";
  if (party?.includes("국가혁명당")) return "bg-[#E61E2B]";
  if (party?.includes("무소속")) return "bg-gray-400";
  return "bg-gray-500";
};

// Layout Header (Top Nav) included in the page for simplicity, 
// though ideally it should be in App.tsx. Since the design requires it to be above the content,
// we will add it at the top of RegionView.
function TopHeader({
  allRegions,
  currentRegionCode,
  onSelectRegion
}: {
  allRegions: { code: string; name: string }[];
  currentRegionCode: string;
  onSelectRegion: (idx: number) => void;
}) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const hasUnread = useHasUnread();

  return (
    <div>
      <header className="w-full bg-gradient-to-r from-indigo-600 via-primary to-purple-600 sticky top-0 z-50 pt-[env(safe-area-inset-top)] shadow-sm">
        {/* 상단 로고/유저 영역 */}
        <div className="h-[56px] flex items-center justify-between px-5 relative overflow-hidden">
          {/* 장식용 글로우 */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute top-0 -left-10 w-24 h-24 bg-white/5 rounded-full blur-xl" />
          
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
              <span className="text-white font-black text-sm tracking-tighter">이유</span>
            </div>
            <h1 className="text-white font-bold text-[18px] tracking-tight">지방선거 가이드</h1>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 relative z-10">
            <button
              onClick={() => setNotifOpen(true)}
              className="text-white/90 relative active:opacity-70 p-1.5 bg-white/10 rounded-full backdrop-blur-md border border-white/10"
            >
              <Bell className="w-4 h-4" />
              {hasUnread && (
                <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-400 rounded-full border border-primary" />
              )}
            </button>
            <div className="flex items-center gap-2">
              {user ? (
                <Link href="/more">
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-black text-sm active:opacity-70">
                    {user.name.charAt(0)}
                  </div>
                </Link>
              ) : (
                <button
                  className="text-white text-[13px] font-bold bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/20 active:bg-white/30 transition-colors"
                  onClick={() => setLocation("/login")}
                >
                  로그인
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* 지역 탭 영역 */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl shadow-[0_-4px_10px_rgba(0,0,0,0.02)] border-b border-border/50">
          <div className="flex md:hidden items-center overflow-x-auto scrollbar-hide px-4 py-2 gap-1">
            {allRegions.map((r, idx) => {
            const isActive = currentRegionCode === r.code;
            return (
              <button
                key={r.code}
                onClick={() => onSelectRegion(idx)}
                className={`relative px-2.5 py-1.5 shrink-0 active:opacity-60 transition-all whitespace-nowrap ${
                  isActive
                    ? "text-foreground font-extrabold text-[14px]"
                    : "text-muted-foreground/50 font-semibold text-[13px]"
                }`}
              >
                {r.name}
                {isActive && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
            <Link href="/city-select">
              <button className="ml-2 shrink-0 active:opacity-60 text-[12px] font-semibold text-muted-foreground/40 whitespace-nowrap bg-muted/50 px-2.5 py-1 rounded-full">
                + 지역
              </button>
            </Link>
          </div>
        </div>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

function RegionView({
  region, 
  allRegions, 
  onSelectRegion,
  onNextRegion
}: { 
  region: { code: string; name: string };
  allRegions: { code: string; name: string }[];
  onSelectRegion: (idx: number) => void;
  onNextRegion?: () => void;
}) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [selectedPledge, setSelectedPledge] = useState<{ id: string; title: string; description: string } | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidateName, setSelectedCandidateName] = useState<string>("");
  const [selectedCandidateParty, setSelectedCandidateParty] = useState<string>("");
  const [selectedCandidateJob, setSelectedCandidateJob] = useState<string>("");
  const [selectedCandidateCareer1, setSelectedCandidateCareer1] = useState<string>("");
  const [selectedCompareWith, setSelectedCompareWith] = useState<CompareWith | null>(null);
  
  // 분야별 통합 분석 상태
  const [topicAnalysisOpen, setTopicAnalysisOpen] = useState(false);
  const [selectedTopicForAnalysis, setSelectedTopicForAnalysis] = useState<string>("");
  const [candidatesForAnalysis, setCandidatesForAnalysis] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem("currentRegionCode", region.code);
    window.dispatchEvent(new Event("regionchange"));
  }, [region.code]);


  // keepPreviousData 복구 — 부드러운 화면 전환을 위해 활성화
  const { data: candidates, isLoading, isFetching, isSuccess } = useQuery<any[]>({
    queryKey: ["/api/election/candidates", region.code],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/election/candidates?regionCode=${region.code}&electionType=mayor`, { signal });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // 정렬/필터 — 데이터가 있을 때만 계산. region.code 바뀌면 빈 배열로 즉시 리셋되어 옛 데이터가 안 보임.
  const displayCandidates = useMemo(() => {
    if (!candidates) return [] as any[];
    return [...candidates]
      .filter((c) => !["등록무효", "사퇴", "사망", "등록거부"].includes(c.candidateStatus || ""))
      .sort((a, b) => {
        const aReg = a.candidateStatus === "등록" ? 0 : 1;
        const bReg = b.candidateStatus === "등록" ? 0 : 1;
        if (aReg !== bReg) return aReg - bReg;
        return getPartyRank(a.party) - getPartyRank(b.party);
      });
  }, [candidates]);

  // VS / minor 분할 — useMemo로 묶어 region 변경 시 즉시 빈 배열 리턴, 렌더 블로킹 없음.
  const { vsCandidates, minorCandidates } = useMemo(() => {
    const pickByParty = (party: string) => displayCandidates.find((c) => c.party?.includes(party));
    const dem = pickByParty("민주당");
    const ppp = pickByParty("국민의힘");
    const used = new Set<string>();
    const vs: any[] = [];
    if (dem) { vs.push(dem); used.add(String(dem.id)); }
    if (ppp) { vs.push(ppp); used.add(String(ppp.id)); }
    for (const c of displayCandidates) {
      if (vs.length >= 2) break;
      if (!used.has(String(c.id))) { vs.push(c); used.add(String(c.id)); }
    }
    const minor = displayCandidates.filter((c) => !used.has(String(c.id)));
    return { vsCandidates: vs, minorCandidates: minor };
  }, [displayCandidates]);

  // 후보자 사진은 엑셀에서 추출해 /uploads/candidate-photos/에 저장, DB photo 필드로 직접 서빙.
  // 별도 batch API 호출 불필요 — PoliticianPhoto 컴포넌트가 photo prop(/uploads/...)을 최우선 사용.


  // 홈 "가장 인기있는 토론" 위젯 — 오늘 가장 좋아요가 많은 게시물 최대 5건
  const { data: topLikedPosts } = useQuery<{ id: string; title: string; likes: number }[]>({
    queryKey: ["/api/community/top-liked"],
    queryFn: () => apiRequest("GET", "/api/community/top-liked").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const [currentPostIndex, setCurrentPostIndex] = useState(0);

  useEffect(() => {
    if (!topLikedPosts || topLikedPosts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentPostIndex((prev) => (prev + 1) % topLikedPosts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [topLikedPosts]);

  interface TrendingMember {
    id: string;
    name: string;
    party: string;
    district: string;
    photo: string;
    primaryKeyword: string;
    recentNewsCount: number;
    profileViewCount: number;
    followerCount: number;
    score: number;
  }
  const { data: trendingRaw } = useQuery<{ success: boolean; data: TrendingMember[] }>({
    queryKey: ["/api/trending-members"],
    queryFn: () => apiRequest("GET", "/api/trending-members").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
  });
  const trendingMembers = trendingRaw?.data ?? [];

  // 로딩 판정 — keepPreviousData가 있으므로 탭 전환 시 isLoading은 false임.
  // 첫 로딩시에만 skeleton 표시.
  const showSkeleton = isLoading;
  const showEmpty = isSuccess && !isLoading && vsCandidates.length === 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F2F7] dark:bg-[#000000] w-full pb-20 text-foreground">
      <TopHeader
        allRegions={allRegions}
        currentRegionCode={region.code}
        onSelectRegion={onSelectRegion}
      />

      <div className="px-3 pt-3 w-full max-w-[1400px] mx-auto">

        {/* 선거 종류 탭 */}
        <div className="flex items-center gap-4 mb-4 px-1">
          <span className="text-[14px] font-bold text-foreground border-b-2 border-foreground pb-1">지방선거</span>
          <Link href="/assembly-election">
            <button className="text-[14px] font-medium text-muted-foreground/60 pb-1 active:opacity-70">재보궐</button>
          </Link>
        </div>

        {/* Main Grid: Left (Main Content) + Right (Widgets) */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">

          {/* LEFT: Main Content */}
          <div className="flex flex-col gap-6">

            {/* Candidate Showcase — integrated election header */}
            {showSkeleton ? (
              <CandidatesSkeleton />
            ) : showEmpty ? (
              <EmptyState regionName={region.name} />
            ) : (
            <div className={`transition-opacity duration-300 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm">
                {/* Election info header */}
                {(() => {
                  const dDays = calculateDDay("2026-06-03T00:00:00");
                  const posLabel = MAYOR_RACES.find(r => r.regionCode === region.code)?.positionLabel || `${region.name}시장`;
                  return (
                    <div className="pt-5 pb-4 border-b border-black/[0.04] dark:border-white/[0.06]">
                      <div className="flex items-center justify-between px-5 mb-3">
                        <span className={`text-[12px] font-black px-2.5 py-1 rounded-lg ${dDays <= 7 ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>
                          {formatDDayLabel(dDays)}
                        </span>
                        <Link href="/city-select">
                          <button className="text-[12px] text-muted-foreground/40 active:opacity-60">지역 변경</button>
                        </Link>
                      </div>
                      <div className="text-center px-5">
                        <h2 className="text-[20px] font-extrabold text-foreground tracking-tight">{posLabel} 선거</h2>
                        <p className="text-[12px] text-muted-foreground mt-1">2026. 6. 3 · 제9회 지방선거 · {displayCandidates.length}명 출마</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="px-4 pt-5 pb-5">
                {/* VS Matchup Section */}
                <div className="flex flex-row items-center justify-center gap-2 sm:gap-6 md:gap-12 py-4">
                  {vsCandidates.map((candidate, idx) => {
                    const color = getPartyColor(candidate.party);
                    return (
                      <React.Fragment key={candidate.id || idx}>
                        <div
                          className="flex flex-col items-center cursor-pointer flex-1 max-w-[280px] active:opacity-70 transition-opacity"
                          onClick={() => {
                            saveCandidateToSession(String(candidate.id ?? encodeURIComponent(candidate.name)), candidate);
                            setLocation(`/candidates/${candidate.id ?? encodeURIComponent(candidate.name)}`);
                          }}
                        >
                          <div className="relative">
                            <div className="w-[112px] h-[112px] sm:w-[148px] sm:h-[148px] rounded-full overflow-hidden border-[3px] border-white shadow-lg relative z-10 bg-card">
                              <PoliticianPhoto
                                name={candidate.name}
                                photo={candidate.photo}
                                context={candidate.party}
                                avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-2xl sm:text-3xl font-black`}
                              />
                            </div>
                          </div>
                          <div className="text-center mt-4">
                            <p className="text-[11px] text-muted-foreground mb-1">{candidate.party.replace('더불어', '').replace('당', '')}</p>
                            <h4 className="text-[18px] sm:text-[20px] font-black text-foreground break-keep">{candidate.name}</h4>
                            {(candidate.job || candidate.career1) && (
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                                {candidate.job || candidate.career1}
                              </p>
                            )}
                          </div>
                        </div>

                        {idx === 0 && vsCandidates.length > 1 && (
                          <div className="flex flex-col items-center justify-center shrink-0">
                            <span className="text-[11px] font-black text-muted-foreground/40 tracking-widest">VS</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Minor Candidates Section */}
                {minorCandidates.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-black/5 dark:border-white/10">
                    <h4 className="text-[11px] text-muted-foreground mb-3">그 외 후보</h4>
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                      {minorCandidates.map((candidate, idx) => {
                        const color = getPartyColor(candidate.party);
                        const symbol = getPartyRank(candidate.party);
                        return (
                          <motion.div
                            key={candidate.id || idx}
                            className="w-[110px] flex-shrink-0 bg-white dark:bg-[#2C2C2E] rounded-2xl p-3 cursor-pointer active:opacity-70 transition-opacity overflow-hidden"
                            onClick={() => {
                              saveCandidateToSession(String(candidate.id ?? encodeURIComponent(candidate.name)), candidate);
                              setLocation(`/candidates/${candidate.id ?? encodeURIComponent(candidate.name)}`);
                            }}
                          >
                            <div className="flex flex-col items-center">
                              <div className="mb-3">
                                <div className="w-[64px] h-[64px] rounded-full overflow-hidden border-2 border-white shadow-md">
                                  <PoliticianPhoto
                                    name={candidate.name}
                                    photo={candidate.photo}
                                    context={candidate.party}
                                    avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-lg font-black`}
                                  />
                                </div>
                              </div>
                              <h5 className="text-[13px] font-bold text-foreground mb-0.5 break-keep text-center">{candidate.name}</h5>
                              <p className="text-[10px] text-muted-foreground text-center leading-tight">{candidate.party.replace('더불어', '').replace('당', '')}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="mx-4 border-t border-black/5 dark:border-white/10" />

              {/* Pledge Comparison Grid */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-[15px] font-bold text-foreground">핵심 공약 비교</h3>
                </div>

                {(() => {
                  // 모든 메인 후보자의 공약 수집
                  const allMainPledges = vsCandidates.map(c => normalizePledges(c.pledges ?? c.promises ?? []));
                  const maxPledgeCount = Math.max(...allMainPledges.map(p => p.length), 0);
                  const hasAnyPledges = maxPledgeCount > 0 || minorCandidates.some(c => normalizePledges(c.pledges ?? c.promises ?? []).length > 0);

                  if (!hasAnyPledges) {
                    // Empty State — 공약 데이터가 없을 때
                    return (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                          <Sparkles className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <p className="text-[15px] font-bold text-foreground">5월 21일부터 공약 정보가 공개됩니다</p>
                        <p className="text-[12px] text-muted-foreground max-w-sm text-center">후보자 등록 기간이 끝나는 5월 21일 이후 선관위 공식 공약이 이곳에 자동으로 업데이트됩니다.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-8 sm:gap-12">
                      {/* 주요 후보 공약 비교 — 공약 번호별 스택 레이아웃 */}
                      <div className="flex flex-col gap-6">
                        {Array.from({ length: maxPledgeCount }).map((_, pIdx) => (
                          <div key={pIdx} className="flex flex-col gap-2">
                            {/* 공약 번호 레이블 */}
                            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest px-1">공약 {pIdx + 1}</p>

                            {vsCandidates.map((candidate) => {
                              const pledges = normalizePledges(candidate.pledges ?? candidate.promises ?? []);
                              const p = pledges[pIdx];
                              const color = getPartyColor(candidate.party);
                              if (!p) return null;
                              return (
                                <div
                                  key={`${candidate.id}-${pIdx}`}
                                  className="bg-white dark:bg-[#2C2C2E] rounded-2xl shadow-sm overflow-hidden cursor-pointer active:opacity-70 transition-opacity"
                                  onClick={() => {
                                    setSelectedCandidateId(String(candidate.id));
                                    setSelectedCandidateName(candidate.name);
                                    setSelectedCandidateParty(candidate.party);
                                    setSelectedCandidateJob(candidate.job ?? "");
                                    setSelectedCandidateCareer1(candidate.career1 ?? candidate.career ?? "");
                                    setSelectedPledge(p);
                                    const firstOther = vsCandidates.find(c => c.id !== candidate.id);
                                    if (firstOther) {
                                      const otherPledges = normalizePledges(firstOther.pledges ?? firstOther.promises ?? []);
                                      const otherP = otherPledges[pIdx];
                                      if (otherP) {
                                        setSelectedCompareWith({
                                          candidateId: String(firstOther.id),
                                          name: firstOther.name,
                                          party: firstOther.party,
                                          job: firstOther.job ?? "",
                                          career1: firstOther.career1 ?? firstOther.career ?? "",
                                          pledge: otherP
                                        });
                                      }
                                    }
                                  }}
                                >
                                  {/* 후보자 헤더 바 */}
                                  <div className={`h-1 w-full ${color}`} />
                                  <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
                                    <span className="text-[12px] font-black text-foreground">{candidate.name}</span>
                                    <span className="text-[10px] text-muted-foreground ml-1">기호 {getPartyRank(candidate.party)}</span>
                                  </div>
                                  <div className="px-4 pb-4">
                                    {p.realmName && (
                                      <span className="inline-block text-[10px] font-bold text-primary/70 mb-1">{p.realmName}</span>
                                    )}
                                    <h5 className="text-[15px] font-bold text-foreground leading-snug mb-1.5">
                                      {p.title}
                                    </h5>
                                    {p.description && (
                                      <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">{p.description}</p>
                                    )}
                                    {(p.method || p.funding || p.duration) && (
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {p.method && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">이행방법 ✓</span>}
                                        {p.funding && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">재원조달 ✓</span>}
                                        {p.duration && <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">이행기간 ✓</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      {/* 기타 후보 공약 */}
                      {minorCandidates.length > 0 && (
                        <div className="pt-5 border-t border-black/5 dark:border-white/10">
                          <div className="text-[11px] font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                            <Plus className="w-3 h-3" /> 기타 정당 후보 공약
                          </div>
                          <div className="flex flex-col gap-2">
                            {minorCandidates.map((candidate) => {
                              const pledges = normalizePledges(candidate.pledges ?? candidate.promises ?? []);
                              const color = getPartyColor(candidate.party);

                              return (
                                <div key={candidate.id} className="bg-white dark:bg-[#2C2C2E] p-3 rounded-xl shadow-sm">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                                    <span className={`text-[11px] font-bold ${color.replace('bg-', 'text-')}`}>{candidate.name} (기호 {getPartyRank(candidate.party)})</span>
                                  </div>
                                  {pledges.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground">5월 21일 이후 공개 예정</p>
                                  ) : (
                                    <div className="flex flex-col gap-1.5">
                                      {pledges.slice(0, 3).map((p, pIdx) => (
                                        <div
                                          key={`${candidate.id}-${p.id}`}
                                          className="cursor-pointer active:opacity-70"
                                          onClick={() => {
                                            setSelectedCandidateId(String(candidate.id));
                                            setSelectedCandidateName(candidate.name);
                                            setSelectedCandidateParty(candidate.party);
                                            setSelectedCandidateJob(candidate.job ?? "");
                                            setSelectedCandidateCareer1(candidate.career1 ?? candidate.career ?? "");
                                            setSelectedPledge(p);
                                          }}
                                        >
                                          <h5 className="text-[12px] font-medium text-foreground line-clamp-1">
                                            {pIdx + 1}. {p.title}
                                          </h5>
                                        </div>
                                      ))}
                                      {pledges.length > 3 && (
                                        <span className="text-[10px] text-muted-foreground">+{pledges.length - 3}개 더보기</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            </div>
            )}

          </div>

          {/* RIGHT: Widget Section */}
          <div className="flex flex-col gap-6">
            
            {/* Widget: 데일리 폴 (오늘의 핫이슈 1분 투표) */}
            <DailyPollWidget />

            {/* Widget 1: 선거 주요 일정 (DB 연동) */}
            <ScheduleWidget regionName={region.name} />

            {/* Widget 2: 가장 인기있는 토론 참여 */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-5 shadow-lg text-white relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-pink-500/20 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-500/25 rounded-full blur-2xl pointer-events-none"></div>
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-black text-[15px] tracking-tight">가장 인기있는 토론</h3>
                </div>
                
                {/* Live pulsing dot */}
                <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">LIVE</span>
                </div>
              </div>

              {/* Debate Card Slider */}
              <div className="h-[120px] relative z-10 mb-5 overflow-hidden">
                <AnimatePresence mode="wait">
                  {topLikedPosts && topLikedPosts.length > 0 ? (
                    (() => {
                      const post = topLikedPosts[currentPostIndex % topLikedPosts.length];
                      if (!post) return null;
                      return (
                        <motion.div
                          key={post.id}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -30 }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                          className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-inner cursor-pointer flex flex-col justify-between active:opacity-70"
                          onClick={() => setLocation(`/community/${post.id}`)}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400/20 animate-bounce" />
                              <span className="text-[10px] font-black text-orange-300 tracking-wider">오늘의 핫 토론</span>
                            </div>
                            <p className="text-[13px] font-bold leading-relaxed text-white line-clamp-2">
                              “{post.title}”
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-white/70 font-semibold mt-1">
                            <div className="flex items-center gap-1">
                              <span>공감 {post.likes}개</span>
                              <span>•</span>
                              <span>실시간 참여 중</span>
                            </div>
                            {topLikedPosts.length > 1 && (
                              <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/60">
                                {currentPostIndex + 1}/{topLikedPosts.length}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })()
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-inner flex items-center justify-center"
                    >
                      <p className="text-[12px] text-white/90 leading-relaxed font-medium text-center">
                        현재 수많은 유권자가 이번 선거 쟁점에 대해 열띤 토론 중입니다. 지금 참여하여 의견을 나누세요.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Action Button */}
              <Button
                className="w-full bg-white hover:bg-white/95 text-indigo-700 hover:text-indigo-800 active:scale-[0.98] transition-all h-12 rounded-xl font-extrabold shadow-lg border-none flex items-center justify-center gap-1.5 group/btn cursor-pointer relative z-10"
                onClick={() => {
                  const currentPost = topLikedPosts?.[currentPostIndex % topLikedPosts.length];
                  setLocation(currentPost?.id ? `/community/${currentPost.id}` : "/community?board=candidate");
                }}
              >
                {topLikedPosts && topLikedPosts.length > 0 ? "인기 토론 참여하기" : "토론방 입장하기"} 
                <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </div>

            {/* Widget 3: 요즘 핫한 의원 */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-[10px] bg-orange-50 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="text-[15px] font-black text-foreground">요즘 핫한 의원</span>
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2 }}
                      className="text-base leading-none"
                    >
                      🔥
                    </motion.span>
                  </div>
                  <Link href="/members">
                    <span className="text-[11px] font-bold text-primary">전체보기</span>
                  </Link>
                </div>
                <p className="text-[11px] text-muted-foreground pl-10">이번 주 뉴스·조회수 기준 급상승</p>
              </div>

              {/* Member list */}
              <div className="px-3 pb-4">
                {trendingMembers.length === 0 ? (
                  /* Skeleton */
                  <div className="space-y-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-2 py-2.5 animate-pulse">
                        <div className="w-5 h-5 rounded bg-muted shrink-0" />
                        <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 w-20 bg-muted rounded" />
                          <div className="h-2.5 w-14 bg-muted/70 rounded" />
                        </div>
                        <div className="h-3 w-12 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {trendingMembers.map((m, i) => {
                      const rankColors = ["#f59e0b", "#94a3b8", "#cd7c43"];
                      const rankColor = rankColors[i] ?? "#cbd5e1";
                      const isTop3 = i < 3;
                      const trendLabel =
                        m.recentNewsCount > 0
                          ? `뉴스 ${m.recentNewsCount}건`
                          : m.profileViewCount > 0
                          ? `조회 ${m.profileViewCount.toLocaleString()}`
                          : m.followerCount > 0
                          ? `팔로워 ${m.followerCount}명`
                          : "주목 의원";
                      const partyColor =
                        m.party === "민주당" ? "#3A6BFF"
                        : m.party === "국민의힘" ? "#FF3B3B"
                        : m.party === "조국혁신당" ? "#1e3a8a"
                        : m.party === "개혁신당" ? "#f97316"
                        : "#6b7280";
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                        >
                          <Link href={`/members/${m.id}`}>
                            <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl active:bg-black/5 dark:active:bg-white/5 transition-colors">
                              {/* Rank */}
                              <div
                                className="w-5 text-center text-[12px] font-black shrink-0"
                                style={{ color: isTop3 ? rankColor : "#cbd5e1" }}
                              >
                                {i + 1}
                              </div>

                              {/* Photo */}
                              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-white shadow-sm">
                                <PoliticianPhoto
                                  name={m.name}
                                  photo={m.photo}
                                  monaCd={m.id}
                                  context={m.party}
                                  size={36}
                                  className="w-full h-full object-cover"
                                  avatarClassName="w-full h-full flex items-center justify-center text-white text-[12px] font-black"
                                />
                              </div>

                              {/* Name + party */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] font-black text-foreground truncate">
                                    {m.name}
                                  </span>
                                  {i === 0 && (
                                    <motion.span
                                      animate={{ scale: [1, 1.15, 1] }}
                                      transition={{ duration: 1.2, repeat: Infinity }}
                                      className="text-[11px] leading-none"
                                    >
                                      🔥
                                    </motion.span>
                                  )}
                                </div>
                                <div
                                  className="text-[10px] font-bold truncate mt-0.5"
                                  style={{ color: partyColor }}
                                >
                                  {m.party}
                                </div>
                              </div>

                              {/* Trend label */}
                              <div className="text-right shrink-0">
                                <div className="flex items-center gap-1 justify-end">
                                  <TrendingUp className="w-2.5 h-2.5 text-orange-400" />
                                  <span className="text-[10px] font-bold text-orange-500">{trendLabel}</span>
                                </div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">{m.district || m.primaryKeyword}</div>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer CTA */}
              <div className="border-t border-border/30 px-5 py-3">
                <Link href="/members">
                  <button className="w-full text-[12px] font-bold text-muted-foreground active:opacity-70 flex items-center justify-center gap-1">
                    국회의원 전체 보기 <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </div>
            </div>

          </div>

        </div>
      </div>
      
      <PledgeDetailView
        candidateId={selectedCandidateId || ""}
        candidateName={selectedCandidateName}
        candidateParty={selectedCandidateParty}
        candidateJob={selectedCandidateJob}
        candidateCareer1={selectedCandidateCareer1}
        promise={selectedPledge}
        open={!!selectedPledge}
        onClose={() => { setSelectedPledge(null); setSelectedCompareWith(null); }}
        compareWith={selectedCompareWith}
      />

      <TopicAnalysisView
        topic={selectedTopicForAnalysis}
        candidates={candidatesForAnalysis}
        open={topicAnalysisOpen}
        onClose={() => setTopicAnalysisOpen(false)}
      />
    </div>
  );
}

export default function ElectionHome() {
  const [, setLocation] = useLocation();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [temporaryRegions, setTemporaryRegions] = useState<{ code: string; name: string }[]>([]);

  // 유저 관심 지역 (localStorage, 동기 읽기로 깜박임 방지)
  const [userRegions, setUserRegions] = useState<{ code: string; name: string }[]>(() => {
    const storedMulti = localStorage.getItem("userRegions");
    let regions: { code: string; name: string }[] = [];
    if (storedMulti) {
      try {
        const parsed = JSON.parse(storedMulti);
        if (Array.isArray(parsed)) regions = parsed;
      } catch (e) {}
    } else {
      const storedSingle = localStorage.getItem("userRegion");
      if (storedSingle) {
        try {
          const parsed = JSON.parse(storedSingle);
          if (parsed?.code) regions = [parsed];
        } catch (e) {}
      }
    }

    // "영천", "중", "함양" 지역 삭제 요청 반영 및 3개로 제한
    const filtered = regions.filter(r => 
      !["영천", "중", "함양"].includes(r.name)
    ).slice(0, 3);
    
    // 변경된 경우 localStorage 업데이트
    if (filtered.length !== regions.length) {
      localStorage.setItem("userRegions", JSON.stringify(filtered));
    }
    
    return filtered;
  });

  // 17개 시·도 전체 선거 목록 — 광역단체장만(기초 제외), 유저 관심 지역을 앞에 배치
  // 유저 관심 지역을 포함한 상단 탭 목록 구성
  const allRegions = useMemo(() => {
    const all = MAYOR_RACES
      .map((r) => ({ code: r.regionCode, name: r.regionShort }));
    
    // 유저가 선택한 관심 지역을 우선 순위로 (최대 6개)
    const userFirst = userRegions
      .map((u) => all.find((a) => a.code === u.code))
      .filter((x): x is { code: string; name: string } => !!x);
      
    // 검색 등으로 추가된 임시 지역들 포함
    const combined = [...userFirst];
    temporaryRegions.forEach(tr => {
      if (!combined.find(c => c.code === tr.code)) {
        combined.push(tr);
      }
    });

    // 아무것도 선택되지 않았다면 광역 단체장 기본 리스트 표시
    if (combined.length === 0) {
      return MAYOR_RACES
        .filter(r => r.level === "metropolitan")
        .map((r) => ({ code: r.regionCode, name: r.regionShort }));
    }

    return combined;
  }, [userRegions, temporaryRegions]);

  // 첫 방문자 → 온보딩
  useEffect(() => {
    if (userRegions.length === 0) {
      setLocation("/city-select");
    }
  }, [userRegions.length, setLocation]);

  useEffect(() => {
    (window as any).switchRegion = (region: { code: string; name: string }) => {
      const existingIdx = allRegions.findIndex((r) => r.code === region.code);
      if (existingIdx !== -1) {
        setSelectedIdx(existingIdx);
      } else {
        setTemporaryRegions(prev => [...prev, region]);
        setSelectedIdx(allRegions.length); // Next index will be the new one
      }
    };

    // Consume lastSelectedRegionCode from other pages redirect
    const lastCode = localStorage.getItem("lastSelectedRegionCode");
    if (lastCode) {
      const idx = allRegions.findIndex((r) => r.code === lastCode);
      if (idx !== -1) {
        setSelectedIdx(idx);
        localStorage.removeItem("lastSelectedRegionCode");
      }
    }
  }, [allRegions]);


  if (userRegions.length === 0) return null;

  const handleNextRegion = () => {
    setSelectedIdx((prev) => (prev + 1) % allRegions.length);
  };

  return (
    <RegionView
      region={allRegions[selectedIdx] || allRegions[0]}
      allRegions={allRegions}
      onSelectRegion={(idx) => setSelectedIdx(idx)}
      onNextRegion={allRegions.length > 1 ? handleNextRegion : undefined}
    />
  );
}
