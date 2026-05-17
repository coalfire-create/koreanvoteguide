import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Bell, HelpCircle, Plus, ChevronLeft, TrendingUp, Sparkles, Users } from "lucide-react";
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
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="px-8 pt-8 pb-8">
        <div className="flex items-center justify-between mb-8">
          <div className="h-6 w-56 bg-gray-200 rounded" />
          <div className="h-6 w-28 bg-gray-100 rounded-full" />
        </div>

        {/* VS Matchup Skeleton */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12 py-4">
          {[0, 1].map((i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center w-full max-w-[280px]">
                <div className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-full bg-gray-200" />
                <div className="h-7 w-32 bg-gray-200 rounded mt-8" />
                <div className="h-4 w-24 bg-gray-100 rounded mt-3" />
              </div>
              {i === 0 && (
                <div className="flex flex-col items-center justify-center py-4 md:py-0">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Minor Candidates Skeleton */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="h-4 w-44 bg-gray-200 rounded mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-[2rem] p-5 border border-gray-100">
                <div className="flex flex-col items-center">
                  <div className="w-[90px] h-[90px] rounded-full bg-gray-200" />
                  <div className="h-4 w-20 bg-gray-200 rounded mt-5" />
                  <div className="h-3 w-16 bg-gray-100 rounded mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pledge Skeleton */}
      <div className="mx-8 border-t border-gray-100" />
      <div className="p-8">
        <div className="h-6 w-48 bg-gray-200 rounded mb-8" />
        <div className="flex flex-col gap-10">
          {Array.from({ length: 3 }).map((_, t) => (
            <div key={t} className="flex flex-col gap-4">
              <div className="h-7 w-40 bg-gray-200 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-32 bg-gray-100 rounded-[2rem]" />
                <div className="h-32 bg-gray-100 rounded-[2rem]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Instagram-style 통합 타임라인 — StoryFeed 바로 아래 위치.
// /api/feed/timeline 에서 팔로우 의원 활동 + 추천 활동을 시간순으로 받아 FeedCard로 렌더.
function TimelineFeed() {
  const { data, isLoading, isError } = useQuery<{ items: FeedItem[]; followCount: number; hasMore: boolean }>({
    queryKey: ["/api/feed/timeline"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/feed/timeline?limit=20", { signal, credentials: "include" });
      if (!res.ok) throw new Error("timeline fetch failed");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 bg-gray-100 rounded" />
                <div className="h-2 w-20 bg-gray-50 rounded" />
              </div>
            </div>
            <div className="h-4 w-3/4 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-full bg-gray-50 rounded mb-1.5" />
            <div className="h-3 w-5/6 bg-gray-50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data || data.items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6 mb-8" aria-label="최근 활동 피드">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[15px] font-black text-gray-800 tracking-tight">
          최근 활동
        </h2>
        <span className="text-[11px] font-medium text-gray-400">
          {data.followCount > 0 ? `${data.followCount}명 팔로우 + 추천` : "추천 피드"}
        </span>
      </div>
      {data.items.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}
    </section>
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
    <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-gray-900 text-[15px]">선거 주요 일정</h3>
        {headlineDday !== null && (
          <span className="text-[10px] font-bold text-[#6D28D9] bg-indigo-50 px-2 py-1 rounded-md">
            {formatDDayLabel(headlineDday)}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-3 h-3 mt-1 rounded-full bg-gray-200" />
              <div className="flex-1">
                <div className="h-3 w-12 bg-gray-200 rounded mb-1" />
                <div className="h-4 w-40 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-[12px] text-gray-400">일정을 불러오지 못했습니다.</p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <p className="text-[12px] text-gray-400">예정된 선거 일정이 없습니다.</p>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="relative pl-3 space-y-6">
          {/* Timeline line */}
          <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-gray-100 z-0" />

          {items.map((item, idx) => {
            const isNext = idx === 0; // 가장 가까운 일정만 강조
            const dotClass = isNext
              ? "bg-white border-[3px] border-[#6D28D9]"
              : "bg-white border-[3px] border-gray-200";
            const titleClass = isNext
              ? "text-[13px] font-bold text-gray-900"
              : "text-[13px] font-bold text-gray-900 opacity-60";

            return (
              <div key={item.id} className="relative z-10 flex gap-4">
                <div className={`w-3 h-3 mt-1 rounded-full flex-shrink-0 ${dotClass}`} />
                <div>
                  <div className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">
                    {formatMonthDay(item.eventDate)}
                    <span className="ml-2 text-[10px] text-[#6D28D9] font-bold">
                      {formatDDayLabel(calculateDDay(item.eventDate))}
                    </span>
                  </div>
                  <div className={titleClass}>{item.title}</div>
                  {item.description && (
                    <div className="text-[11px] text-gray-400 mt-1">{item.description}</div>
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
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 px-8 py-20 flex flex-col items-center justify-center gap-4">
      <p className="text-gray-500 font-medium">{regionName} 지역의 등록된 후보자가 아직 없습니다.</p>
      <Link href="/city-select">
        <Button variant="outline">지역 다시 선택하기</Button>
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

  return (
    <header className="w-full h-[72px] flex items-center justify-between px-8 bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        {/* Logo removed here as it is present in SideNav */}
        
        {/* Region Tabs in Header */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 max-w-[800px]">
          {allRegions.map((r, idx) => (
            <button
              key={r.code}
              onClick={() => onSelectRegion(idx)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                currentRegionCode === r.code 
                  ? "bg-[#6D28D9] text-white shadow-sm" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="text-gray-400 hover:text-indigo-600 transition-colors relative">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <button className="text-gray-400 hover:text-indigo-600 transition-colors hidden sm:block">
          <HelpCircle className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <Button 
            className="bg-white text-[#6D28D9] hover:bg-gray-50 border border-gray-200 rounded-full px-6 h-10 font-bold shadow-sm text-xs"
            onClick={() => setLocation("/login")}
          >
            로그인
          </Button>
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


  // keepPreviousData 제거 — 클릭 즉시 새 데이터로 전환, 로딩 중에는 Skeleton.
  // staleTime은 짧게 두어 같은 지역 재방문 시 캐시 즉시 사용.
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

  const { data: candidatePhotos = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["/api/politician-photos/batch", "candidates", allCandidateNames],
    queryFn: ({ signal }) =>
      fetch(`/api/politician-photos/batch?names=${encodeURIComponent(allCandidateNames)}`, { signal }).then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
    enabled: !!allCandidateNames,
  });

  // 로딩 판정 — region.code가 바뀌면 isLoading=true로 즉시 진입(keepPreviousData 없으니).
  // isFetching은 백그라운드 refetch 포함.
  const showSkeleton = isLoading || isFetching || !isSuccess;
  const showEmpty = isSuccess && !isFetching && vsCandidates.length === 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] w-full pb-20">
      <TopHeader 
        allRegions={allRegions} 
        currentRegionCode={region.code} 
        onSelectRegion={onSelectRegion} 
      />
      
      <div className="px-8 pt-6 w-full max-w-[1400px] mx-auto">

        {/* Story-style 관심 의원 피드 — 페이지 최상단 (election-home.tsx:13 import 후 실제 렌더링) */}

        {/* Instagram-style 통합 활동 피드 — StoryFeed 바로 아래 (팔로우 + 추천 머지) */}
        <div className="max-w-[640px] mx-auto">
          <TimelineFeed />
        </div>

        {/* Region Selector removed from here and moved to TopHeader */}
        <div className="flex items-center justify-end mb-6 pb-2">
          <div className="flex items-center pl-4">
            <Link href="/city-select">
              <button className="flex items-center gap-1 text-gray-500 hover:text-[#6D28D9] text-[13px] font-bold px-4 py-2 rounded-full transition-all hover:bg-indigo-50/50 whitespace-nowrap group">
                관심 지역 설정
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-gray-400 group-hover:text-[#6D28D9]" />
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
                <h1 className="text-4xl font-black text-gray-900 tracking-tight text-center">
                  {`${MAYOR_RACES.find(r => r.regionCode === region.code)?.positionLabel || `${region.name}시장`} 선거`}
                </h1>
                <p className="text-gray-500 text-sm font-medium mt-2 text-center">제9회 전국동시지방선거 · 2026년 6월 3일</p>
                
                {/* Next Region Button */}
                {allRegions.length > 1 && onNextRegion && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <button 
                      onClick={onNextRegion}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-bold text-gray-600 hover:text-[#6D28D9] hover:border-indigo-200 hover:bg-indigo-50 shadow-sm transition-all"
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
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-8 pb-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    주요 정당 핵심 정책 대결
                  </h3>
                  <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                    <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] font-black text-red-600">격전지 분석 중</span>
                  </div>
                </div>

                {/* VS Matchup Section */}
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12 py-4">
                  {vsCandidates.map((candidate, idx) => {
                    const color = getPartyColor(candidate.party);
                    return (
                      <React.Fragment key={candidate.id || idx}>
                        <motion.div
                          whileHover={{ y: -8, scale: 1.02 }}
                          className="flex flex-col items-center group cursor-pointer w-full max-w-[280px]"
                          onClick={() => {
                            saveCandidateToSession(String(candidate.id ?? encodeURIComponent(candidate.name)), candidate);
                            setLocation(`/candidates/${candidate.id ?? encodeURIComponent(candidate.name)}`);
                          }}
                        >
                          <div className="relative">
                            <div className={`w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-full overflow-hidden border-[8px] ${color.replace('bg-', 'border-')} shadow-xl group-hover:shadow-2xl transition-all duration-300 relative z-10 bg-white`}>
                              <PoliticianPhoto
                                name={candidate.name}
                                photo={candidate.photo}
                                resolvedUrl={candidatePhotos[candidate.name]}
                                avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-4xl font-black`}
                              />
                            </div>
                            <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 ${color} text-white px-6 py-1.5 rounded-full text-[12px] font-black shadow-lg whitespace-nowrap z-20`}>
                              기호 {getPartyRank(candidate.party)} · {candidate.party}
                            </div>
                            {/* Accent Ring */}
                            <div className={`absolute inset-0 rounded-full border-2 ${color.replace('bg-', 'border-')} opacity-20 scale-110 group-hover:scale-125 transition-transform duration-500`}></div>
                          </div>
                          <div className="text-center mt-8">
                            <h4 className="text-2xl font-black text-gray-900 mb-2">{candidate.name}</h4>
                            {(candidate.job || candidate.career1) && (
                              <p className={`text-[13px] font-bold ${color.replace('bg-', 'text-')} bg-gray-50 px-4 py-1 rounded-lg line-clamp-1`}>
                                {candidate.job || candidate.career1}
                              </p>
                            )}
                            {candidate.candidateStatus && (
                              <div className="mt-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${candidate.candidateStatus === '예비후보' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                                  {candidate.candidateStatus}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                        
                        {idx === 0 && vsCandidates.length > 1 && (
                          <div className="flex flex-col items-center justify-center py-4 md:py-0">
                            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center text-xl font-black italic shadow-lg z-10">VS</div>
                            <div className="h-12 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent hidden md:block mt-4"></div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Minor Candidates Section */}
                {minorCandidates.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-gray-100">
                    <h4 className="text-sm font-black text-gray-400 mb-6 uppercase tracking-wider flex items-center gap-2">
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
                            className="bg-white rounded-[2rem] p-5 border border-gray-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer group relative overflow-hidden"
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
                                    avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-xl font-black`}
                                  />
                                </div>
                                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${color} text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg border-2 border-white whitespace-nowrap`}>
                                  기호 {symbol}
                                </div>
                              </div>
                              <h5 className="text-[16px] font-black text-gray-900 mb-1 group-hover:text-[#6D28D9] transition-colors">{candidate.name}</h5>
                              <p className="text-[11px] text-gray-400 font-bold tracking-tight mb-1">{candidate.party}</p>
                              {candidate.candidateStatus && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${candidate.candidateStatus === '예비후보' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
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
              <div className="mx-8 border-t border-gray-100" />

              {/* Pledge Comparison Grid — 실 공약 데이터 기반 렌더링 */}
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                      핵심 공약 비교 분석
                    </h3>
                    <p className="text-xs text-gray-500 font-medium ml-7">후보자별 공약을 비교하고 AI 분석을 확인하세요</p>
                  </div>
                  <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-[11px] font-black text-indigo-700">AI 심층 비교 가능</span>
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
                        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                          <Sparkles className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-[15px] font-bold text-gray-600">아직 선관위에 공식 공약이 등록되지 않았습니다</p>
                        <p className="text-[12px] text-gray-400 max-w-sm text-center">예비후보 단계에서는 공약이 공개되지 않을 수 있습니다. 후보자 등록 후 공약이 업데이트됩니다.</p>
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
                              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <div className={`w-2 h-2 rounded-full ${color}`} />
                                <span className={`text-[12px] font-black ${color.replace('bg-', 'text-')}`}>기호 {getPartyRank(candidate.party)}</span>
                                <span className="text-[12px] font-black text-gray-400">·</span>
                                <span className="text-[14px] font-black text-gray-900">{candidate.name}</span>
                                <span className="text-[11px] text-gray-400 ml-auto">{pledges.length}개 공약</span>
                              </div>

                              {pledges.length === 0 ? (
                                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                                  <p className="text-[13px] text-gray-400 font-medium">아직 선관위에 공식 공약이 등록되지 않았습니다.</p>
                                </div>
                              ) : (
                                pledges.map((p, pIdx) => (
                                  <motion.div
                                    key={`${candidate.id}-${p.id}`}
                                    whileHover={{ y: -3 }}
                                    className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-100 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
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
                                      <span className="text-[11px] font-bold text-gray-400 mt-0.5 shrink-0">{pIdx + 1}</span>
                                      <div className="flex-1 min-w-0">
                                        <h5 className="text-[14px] font-bold text-gray-900 mb-1.5 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
                                          {p.title}
                                        </h5>
                                        {p.description && (
                                          <p className="text-[12px] text-gray-500 line-clamp-2 leading-relaxed">{p.description}</p>
                                        )}
                                      </div>
                                      <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors shrink-0 mt-0.5">
                                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500" />
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
                        <div className="pt-6 border-t border-gray-100">
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Plus className="w-3 h-3" /> 기타 정당 후보 공약
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {minorCandidates.map((candidate) => {
                              const pledges = normalizePledges(candidate.pledges ?? candidate.promises ?? []);
                              const color = getPartyColor(candidate.party);

                              return (
                                <div key={candidate.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                                    <span className={`text-[10px] font-black ${color.replace('bg-', 'text-')}`}>{candidate.name} (기호 {getPartyRank(candidate.party)})</span>
                                  </div>
                                  {pledges.length === 0 ? (
                                    <p className="text-[11px] text-gray-400">공약 미등록</p>
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
                                          <h5 className="text-[12px] font-bold text-gray-700 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                            {pIdx + 1}. {p.title}
                                          </h5>
                                        </motion.div>
                                      ))}
                                      {pledges.length > 3 && (
                                        <span className="text-[10px] text-gray-400">+{pledges.length - 3}개 더보기</span>
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
            )}

          </div>

          {/* RIGHT: Widget Section */}
          <div className="flex flex-col gap-6">
            

            {/* Widget 1: 선거 주요 일정 (DB 연동) */}
            <ScheduleWidget regionName={region.name} />

            {/* Widget 2: 가장 인기있는 토론 참여 */}
            <div className="bg-[#6D28D9] rounded-[1.5rem] p-6 shadow-md text-white relative overflow-hidden">
              {/* Background abstract element */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              

              <h3 className="font-bold text-[15px] mb-3">가장 인기있는 토론 참여</h3>
              <p className="text-xs text-indigo-100 leading-relaxed mb-6 opacity-90">
                현재 수많은 유권자가 이번 선거 쟁점에 대해 열띤 토론 중입니다. 지금 참여하여 의견을 나누세요.
              </p>
              
              <div className="flex items-center gap-2 mb-6">
                <div className="flex -space-x-2">
                  <img src="https://i.pravatar.cc/100?img=11" className="w-7 h-7 rounded-full border-2 border-[#6D28D9]" alt="User"/>
                  <img src="https://i.pravatar.cc/100?img=12" className="w-7 h-7 rounded-full border-2 border-[#6D28D9]" alt="User"/>
                  <img src="https://i.pravatar.cc/100?img=13" className="w-7 h-7 rounded-full border-2 border-[#6D28D9]" alt="User"/>
                </div>
                <span className="text-[10px] text-indigo-200">실시간 토론 진행 중</span>
              </div>

              <Button
                className="w-full bg-white text-[#6D28D9] hover:bg-gray-50 h-12 rounded-xl font-bold shadow-lg"
                onClick={() => setLocation("/community?board=candidate")}
              >
                토론방 입장하기 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
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
