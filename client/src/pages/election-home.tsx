import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronRight, Bell, HelpCircle, Plus, ChevronLeft, TrendingUp, Sparkles, Users, MessageSquare, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { saveCandidateToSession } from "@/pages/candidate-detail";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import { getPartyRank } from "@/lib/mock-data";
import PledgeDetailView, { type CompareWith } from "@/components/PledgeDetailView";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import TopicAnalysisView from "@/components/TopicAnalysisView";
import { FeedCard, type FeedItem } from "@/components/FeedCard";

// 후보 영역 로딩용 Skeleton — 실제 카드와 같은 골격을 회색 펄스로 그린다.
// 헤더/사이드 위젯은 그대로 두고 이 부분만 데이터 도착 시 교체된다.
function CandidatesSkeleton() {
  return (
    <div className="bg-card rounded-[2.5rem] shadow-sm border border-border/30 overflow-hidden animate-pulse">
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
    <div className="bg-card rounded-[1.5rem] p-6 shadow-sm border border-border/30">
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
    <div className="bg-card rounded-[2.5rem] shadow-sm border border-border/30 px-8 py-20 flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground font-medium">{regionName} 지역의 등록된 후보자가 아직 없습니다.</p>
      <Link href="/city-select">
        <Button variant="outline" className="border-border/30 text-foreground hover:bg-muted">지역 다시 선택하기</Button>
      </Link>
    </div>
  );
}

// DB에서 오는 pledges 필드는 ["1. 제목", "2. 제목", ...] 형태의 문자열 배열
// 또는 {id, title, description} 객체 배열일 수도 있음 — 양쪽 모두 처리
function normalizePledges(raw: any[]): { id: string; title: string; description: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, i) => {
    if (typeof item === "string") {
      // "1. 제목" → "제목"
      const title = item.replace(/^\d+\.\s*/, "").trim();
      return { id: `p${i}`, title, description: "" };
    }
    return {
      id: item.id ?? `p${i}`,
      title: item.title ?? String(item),
      description: item.description ?? "",
    };
  });
}

// 공약 인덱스별 중앙 배지 라벨
// PLEDGE_TOPIC_LABELS 제거됨 — 실 공약 데이터 기반 렌더링으로 전환

const getPartyColor = (party: string) => {
  if (party?.includes("더불어민주당")) return "bg-[#3A6BFF]";
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

  return (
    <header className="w-full h-[72px] flex items-center justify-between px-8 bg-background border-b border-border/40 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        {/* Logo removed here as it is present in SideNav */}
        
        {/* Region Tabs in Header — mobile only, desktop has it in SideNav */}
        <div className="flex md:hidden items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 max-w-[800px]">
          {allRegions.map((r, idx) => (
            <button
              key={r.code}
              onClick={() => onSelectRegion(idx)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                currentRegionCode === r.code 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="text-muted-foreground hover:text-primary transition-colors relative">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-background"></span>
        </button>
        <button className="text-muted-foreground hover:text-primary transition-colors hidden sm:block">
          <HelpCircle className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-border/30">
          {user ? (
            <Link href="/more">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-sm cursor-pointer shadow-sm ring-2 ring-transparent hover:ring-primary/20 transition-all">
                {user.name.charAt(0)}
              </div>
            </Link>
          ) : (
            <Button 
              className="bg-card text-primary hover:bg-muted border border-border/30 rounded-full px-6 h-10 font-bold shadow-sm text-xs"
              onClick={() => setLocation("/login")}
            >
              로그인
            </Button>
          )}
        </div>
      </div>
    </header>
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
    const dem = pickByParty("더불어민주당");
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

  const allCandidateNames = useMemo(
    () => displayCandidates.map((c: any) => c.name).filter(Boolean).join(","),
    [displayCandidates],
  );

  // 동명이인 disambiguation: 후보 이름→정당 컨텍스트 맵 (서버가 "김종훈 국민의힘" 식으로 검색)
  const candidateContexts = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of displayCandidates) {
      if (c.name && c.party) map[c.name] = c.party;
    }
    return map;
  }, [displayCandidates]);

  const { data: candidatePhotos = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["/api/politician-photos/batch", "candidates", allCandidateNames],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ names: allCandidateNames });
      const ctxStr = JSON.stringify(candidateContexts);
      if (ctxStr !== "{}") params.set("contexts", ctxStr);
      return fetch(`/api/politician-photos/batch?${params}`, { signal }).then((r) => r.json());
    },
    staleTime: 60 * 60 * 1000,
    enabled: !!allCandidateNames,
  });

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
    <div className="flex flex-col min-h-screen bg-background w-full pb-20 text-foreground">
      <TopHeader 
        allRegions={allRegions} 
        currentRegionCode={region.code} 
        onSelectRegion={onSelectRegion} 
      />
      
      <div className="px-8 pt-6 w-full max-w-[1400px] mx-auto">


        {/* Region Selector removed from here and moved to TopHeader */}
        <div className="flex items-center justify-end mb-6 pb-2">
          <div className="flex items-center pl-4">
            <Link href="/city-select">
              <button className="flex items-center gap-1 text-muted-foreground hover:text-primary text-[13px] font-bold px-4 py-2 rounded-full transition-all hover:bg-primary/10 whitespace-nowrap group">
                관심 지역 설정
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-muted-foreground group-hover:text-primary" />
              </button>
            </Link>
          </div>
        </div>

        {/* Main Grid: Left (Main Content) + Right (Widgets) */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">
          
          {/* LEFT: Main Content */}
          <div className="flex flex-col gap-6">
            
            {/* Election Header & Poll Support Rating Summary */}
            <div className="flex flex-col gap-4">
              <div className="relative flex flex-col items-center justify-center py-4">
                <h1 className="text-4xl font-black text-foreground tracking-tight text-center">
                  {`${MAYOR_RACES.find(r => r.regionCode === region.code)?.positionLabel || `${region.name}시장`} 선거`}
                </h1>
                <p className="text-muted-foreground text-sm font-medium mt-2 text-center">제9회 전국동시지방선거 · 2026년 6월 3일</p>
                
                {/* Next Region Button */}
                {allRegions.length > 1 && onNextRegion && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <button 
                      onClick={onNextRegion}
                      className="flex items-center gap-2 px-4 py-2 bg-card border border-border/30 rounded-full text-sm font-bold text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/10 shadow-sm transition-all"
                    >
                      다른 지역 보기 <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Candidate Showcase (Multi-VS) — 로딩 중에는 Skeleton, 데이터 없으면 EmptyState */}
            {showSkeleton ? (
              <CandidatesSkeleton />
            ) : showEmpty ? (
              <EmptyState regionName={region.name} />
            ) : (
            <div className={`transition-opacity duration-300 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
              <div className="bg-card rounded-[2.5rem] shadow-sm border border-border/30 overflow-hidden">
                <div className="px-8 pt-8 pb-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                    주요 정당 핵심 정책 대결
                  </h3>
                  <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                    <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] font-black text-red-600">격전지 분석 중</span>
                  </div>
                </div>

                {/* VS Matchup Section */}
                <div className="flex flex-row items-center justify-center gap-2 sm:gap-6 md:gap-12 py-4">
                  {vsCandidates.map((candidate, idx) => {
                    const color = getPartyColor(candidate.party);
                    return (
                      <React.Fragment key={candidate.id || idx}>
                        <motion.div
                          whileHover={{ y: -8, scale: 1.02 }}
                          className="flex flex-col items-center group cursor-pointer flex-1 max-w-[280px]"
                          onClick={() => {
                            saveCandidateToSession(String(candidate.id ?? encodeURIComponent(candidate.name)), candidate);
                            setLocation(`/candidates/${candidate.id ?? encodeURIComponent(candidate.name)}`);
                          }}
                        >
                          <div className="relative">
                            <div className={`w-[120px] h-[120px] sm:w-[160px] sm:h-[160px] md:w-[220px] md:h-[220px] rounded-full overflow-hidden border-[6px] md:border-[8px] ${color.replace('bg-', 'border-')} shadow-xl group-hover:shadow-2xl transition-all duration-300 relative z-10 bg-card`}>
                              <PoliticianPhoto
                                name={candidate.name}
                                photo={candidate.photo}
                                resolvedUrl={candidatePhotos[candidate.name]}
                                context={candidate.party}
                                avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-black`}
                              />
                            </div>
                            <div className={`absolute -bottom-2 md:-bottom-3 left-1/2 -translate-x-1/2 ${color} text-white px-3 sm:px-6 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] md:text-[12px] font-black shadow-lg whitespace-nowrap z-20`}>
                              기호 {getPartyRank(candidate.party)} · {candidate.party.replace('더불어', '')}
                            </div>
                            {/* Accent Ring */}
                            <div className={`absolute inset-0 rounded-full border-2 ${color.replace('bg-', 'border-')} opacity-20 scale-110 group-hover:scale-125 transition-transform duration-500`}></div>
                          </div>
                          <div className="text-center mt-6 md:mt-8">
                            <h4 className="text-[17px] sm:text-[20px] md:text-2xl font-black text-foreground mb-1 md:mb-2">{candidate.name}</h4>
                            {(candidate.job || candidate.career1) && (
                              <p className={`text-[10px] sm:text-[11px] md:text-[13px] font-bold ${color.replace('bg-', 'text-')} bg-muted px-2 sm:px-4 py-1 rounded-lg line-clamp-1`}>
                                {candidate.job || candidate.career1}
                              </p>
                            )}
                            {candidate.candidateStatus && (
                              <div className="mt-1 md:mt-2">
                                <span className={`inline-flex items-center px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold ${candidate.candidateStatus === '예비후보' ? 'bg-orange-500/15 text-orange-500' : 'bg-muted text-muted-foreground'}`}>
                                  {candidate.candidateStatus}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                        
                        {idx === 0 && vsCandidates.length > 1 && (
                          <div className="flex flex-col items-center justify-center shrink-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-foreground text-background flex items-center justify-center text-xs sm:text-sm md:text-xl font-black italic shadow-lg z-10">VS</div>
                            <div className="h-8 md:h-12 w-px bg-gradient-to-b from-transparent via-border to-transparent hidden md:block mt-2 md:mt-4"></div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Minor Candidates Section */}
                {minorCandidates.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-border/30">
                    <h4 className="text-sm font-black text-muted-foreground mb-6 uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4" /> 다른 후보자들 (기호 3번~)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {minorCandidates.map((candidate, idx) => {
                        const color = getPartyColor(candidate.party);
                        const symbol = getPartyRank(candidate.party);
                        return (
                          <motion.div
                            key={candidate.id || idx}
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="bg-card rounded-[2rem] p-5 border border-border/30 hover:border-primary/20 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer group relative overflow-hidden"
                            onClick={() => {
                              saveCandidateToSession(String(candidate.id ?? encodeURIComponent(candidate.name)), candidate);
                              setLocation(`/candidates/${candidate.id ?? encodeURIComponent(candidate.name)}`);
                            }}
                          >
                            {/* Decorative Background Accent */}
                            <div className={`absolute -top-10 -right-10 w-24 h-24 ${color} opacity-[0.03] rounded-full blur-2xl group-hover:opacity-[0.08] transition-opacity`} />
                            
                            <div className="flex flex-col items-center relative z-10">
                              <div className="relative mb-5">
                                <div className={`w-[90px] h-[90px] rounded-full overflow-hidden border-[6px] ${color.replace('bg-', 'border-').replace('[#', '[#').replace(']', '/10]')} shadow-sm group-hover:shadow-md transition-all`}>
                                  <PoliticianPhoto
                                    name={candidate.name}
                                    photo={candidate.photo}
                                    resolvedUrl={candidatePhotos[candidate.name]}
                                    context={candidate.party}
                                    avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-xl font-black`}
                                  />
                                </div>
                                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${color} text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg border-2 border-card whitespace-nowrap`}>
                                  기호 {symbol}
                                </div>
                              </div>
                              <h5 className="text-[16px] font-black text-foreground mb-1 group-hover:text-primary transition-colors">{candidate.name}</h5>
                              <p className="text-[11px] text-muted-foreground font-bold tracking-tight mb-1">{candidate.party}</p>
                              {candidate.candidateStatus && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${candidate.candidateStatus === '예비후보' ? 'bg-orange-500/15 text-orange-500' : 'bg-muted text-muted-foreground'}`}>
                                  {candidate.candidateStatus}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="mx-8 border-t border-border/30" />

              {/* Pledge Comparison Grid — 실 공약 데이터 기반 렌더링 */}
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                      핵심 공약 비교 분석
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium ml-7">후보자별 공약을 비교하고 AI 분석을 확인하세요</p>
                  </div>
                  <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-black text-primary">AI 심층 비교 가능</span>
                  </div>
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
                    <div className="flex flex-col gap-12">
                      {/* 주요 후보 (VS) 공약 비교 — 인덱스 기반이 아닌 실 데이터 기반 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {vsCandidates.map((candidate) => {
                          const pledges = normalizePledges(candidate.pledges ?? candidate.promises ?? []);
                          const color = getPartyColor(candidate.party);
                          
                          return (
                            <div key={candidate.id} className="flex flex-col gap-4">
                              {/* 후보자 헤더 */}
                              <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                                <div className={`w-2 h-2 rounded-full ${color}`} />
                                <span className={`text-[12px] font-black ${color.replace('bg-', 'text-')}`}>기호 {getPartyRank(candidate.party)}</span>
                                <span className="text-[12px] font-black text-muted-foreground">·</span>
                                <span className="text-[14px] font-black text-foreground">{candidate.name}</span>
                                <span className="text-[11px] text-muted-foreground ml-auto">{pledges.length}개 공약</span>
                              </div>

                              {pledges.length === 0 ? (
                                <div className="bg-muted rounded-2xl p-6 text-center">
                                  <p className="text-[13px] font-bold text-foreground mb-1">5월 21일부터 공약 정보가 공개됩니다</p>
                                  <p className="text-[11px] text-muted-foreground">후보자 등록 기간 종료 후 자동으로 업데이트됩니다.</p>
                                </div>
                              ) : (
                                pledges.map((p, pIdx) => (
                                  <motion.div
                                    key={`${candidate.id}-${p.id}`}
                                    whileHover={{ y: -3 }}
                                    className="bg-card p-5 rounded-2xl shadow-sm border border-border/30 hover:border-primary/20 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
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
                                    <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
                                    <div className="flex items-start gap-3 pl-3">
                                      <span className="text-[11px] font-bold text-muted-foreground mt-0.5 shrink-0">{pIdx + 1}</span>
                                      <div className="flex-1 min-w-0">
                                        <h5 className="text-[14px] font-bold text-foreground mb-1.5 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                                          {p.title}
                                        </h5>
                                        {p.description && (
                                          <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">{p.description}</p>
                                        )}
                                      </div>
                                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0 mt-0.5">
                                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary" />
                                      </div>
                                    </div>
                                  </motion.div>
                                ))
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 기타 후보 공약 */}
                      {minorCandidates.length > 0 && (
                        <div className="pt-6 border-t border-border/30">
                          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Plus className="w-3 h-3" /> 기타 정당 후보 공약
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {minorCandidates.map((candidate) => {
                              const pledges = normalizePledges(candidate.pledges ?? candidate.promises ?? []);
                              const color = getPartyColor(candidate.party);

                              return (
                                <div key={candidate.id} className="bg-muted p-5 rounded-2xl border border-border/30">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                                    <span className={`text-[10px] font-black ${color.replace('bg-', 'text-')}`}>{candidate.name} (기호 {getPartyRank(candidate.party)})</span>
                                  </div>
                                  {pledges.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground">5월 21일 이후 공개 예정</p>
                                  ) : (
                                    <div className="flex flex-col gap-2">
                                      {pledges.slice(0, 3).map((p, pIdx) => (
                                        <motion.div
                                          key={`${candidate.id}-${p.id}`}
                                          whileHover={{ scale: 1.01 }}
                                          className="cursor-pointer group"
                                          onClick={() => {
                                            setSelectedCandidateId(String(candidate.id));
                                            setSelectedCandidateName(candidate.name);
                                            setSelectedCandidateParty(candidate.party);
                                            setSelectedCandidateJob(candidate.job ?? "");
                                            setSelectedCandidateCareer1(candidate.career1 ?? candidate.career ?? "");
                                            setSelectedPledge(p);
                                          }}
                                        >
                                          <h5 className="text-[12px] font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                            {pIdx + 1}. {p.title}
                                          </h5>
                                        </motion.div>
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
            

            {/* Widget 1: 선거 주요 일정 (DB 연동) */}
            <ScheduleWidget regionName={region.name} />

            {/* Widget 2: 가장 인기있는 토론 참여 */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-[2rem] p-6 shadow-xl text-white relative overflow-hidden border border-white/10 group">
              {/* Background abstract glowing circles */}
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-pink-500/20 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/35 transition-all duration-700"></div>
              <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-500/25 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/40 transition-all duration-700"></div>
              
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
                          className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-inner hover:bg-white/15 transition-colors duration-300 cursor-pointer flex flex-col justify-between"
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
              
              {/* User Avatars & Info */}
              <div className="flex items-center justify-between mb-5 relative z-10 px-0.5">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-[9px] font-black border-2 border-indigo-600 text-white shadow-md">김</div>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-[9px] font-black border-2 border-indigo-600 text-white shadow-md">이</div>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-[9px] font-black border-2 border-indigo-600 text-white shadow-md">박</div>
                  <div className="w-7 h-7 rounded-full bg-slate-700/80 flex items-center justify-center text-[8px] font-bold border-2 border-indigo-600 text-white shadow-md">+99</div>
                </div>
                <span className="text-[10px] text-white/70 font-bold">지금 328명이 토론방에 있음</span>
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
            <div className="bg-card rounded-[1.5rem] shadow-sm border border-border/30 overflow-hidden">
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
                    <span className="text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      전체보기
                    </span>
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
                        m.party === "더불어민주당" ? "#3A6BFF"
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
                            <div className="flex items-center gap-3 px-2 py-2.5 rounded-[14px] hover:bg-muted/50 cursor-pointer transition-colors group">
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
                  <button className="w-full text-[12px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1">
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
