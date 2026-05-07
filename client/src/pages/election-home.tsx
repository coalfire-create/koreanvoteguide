import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, Bell, HelpCircle, Plus, ChevronLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveCandidateToSession } from "@/pages/candidate-detail";
import { buildRegionalFallback, getMayorRaceByName, MAYOR_RACES } from "@/lib/mayor-candidates";
import { getPartyRank } from "@/lib/mock-data";
import PledgeDetailView, { type CompareWith } from "@/components/PledgeDetailView";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";

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
const PLEDGE_TOPIC_LABELS = ["경제", "복지", "도시", "환경", "교육"];

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
function TopHeader({ onSearchSelect }: { onSearchSelect: (region: { code: string; name: string }) => void }) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const filteredRaces = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return MAYOR_RACES.filter(race => 
      race.region.includes(searchQuery) || race.regionShort.includes(searchQuery)
    ).slice(0, 5);
  }, [searchQuery]);

  return (
    <header className="w-full h-[72px] flex items-center justify-between px-8 bg-[#F8F9FA] sticky top-0 z-50">
      <div className="flex-1 max-w-[600px] relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-indigo-300" />
        </div>
        <input 
          type="text" 
          placeholder="지역명으로 검색 (예: 강남구, 부산)" 
          className="w-full h-12 pl-12 pr-4 bg-[#6320EE] text-white placeholder:text-indigo-300 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
        <AnimatePresence>
          {showResults && filteredRaces.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-14 left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[60]"
            >
              {filteredRaces.map((race) => (
                <button
                  key={race.regionCode}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  onClick={() => {
                    onSearchSelect({ code: race.regionCode, name: race.regionShort });
                    setSearchQuery("");
                    setShowResults(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Search className="w-4 h-4 text-[#6320EE]" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-gray-900">{race.region}</div>
                      <div className="text-[11px] text-gray-400 font-medium">{race.positionLabel}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-6">
        <button className="text-gray-400 hover:text-indigo-600 transition-colors relative">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#F8F9FA]"></span>
        </button>
        <button className="text-gray-400 hover:text-indigo-600 transition-colors">
          <HelpCircle className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <Button 
            className="bg-white text-[#6320EE] hover:bg-gray-50 border border-gray-200 rounded-full px-6 h-10 font-bold shadow-sm"
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
  onNextRegion,
  onSearchSelect
}: { 
  region: { code: string; name: string };
  allRegions: { code: string; name: string }[];
  onSelectRegion: (idx: number) => void;
  onNextRegion?: () => void;
  onSearchSelect: (region: { code: string; name: string }) => void;
}) {
  const [, setLocation] = useLocation();
  const [selectedPledge, setSelectedPledge] = useState<{ id: string; title: string; description: string } | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidateName, setSelectedCandidateName] = useState<string>("");
  const [selectedCandidateParty, setSelectedCandidateParty] = useState<string>("");
  const [selectedCompareWith, setSelectedCompareWith] = useState<CompareWith | null>(null);


  const { data: candidates } = useQuery<any[]>({
    queryKey: ["/api/election/candidates", region.code],
    queryFn: async () => {
      const res = await fetch(`/api/election/candidates?regionCode=${region.code}&electionType=mayor`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // mayor-candidates.ts에서 데이터 가져오기
  const REGIONAL_FALLBACK = buildRegionalFallback();
  const mayorRace = getMayorRaceByName(region.name);

  const regionKey = Object.keys(REGIONAL_FALLBACK).find(key => region.name.includes(key)) ?? "";
  const fallbackCandidates = REGIONAL_FALLBACK[regionKey] ?? [
    { id: "fallback-1", name: "더불어민주당 후보", party: "더불어민주당", slogan: "함께하는 내일", photo: null },
    { id: "fallback-2", name: "국민의힘 후보", party: "국민의힘", slogan: "변화와 혁신", photo: null },
  ];
  const displayCandidates = [...((candidates && candidates.length >= 2) ? candidates : fallbackCandidates)].sort((a, b) => {
    return getPartyRank(a.party) - getPartyRank(b.party);
  });

  const candidateA = displayCandidates[0];
  const candidateB = displayCandidates[1];

  if (!candidateA) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500 font-medium">해당 지역의 후보자 정보를 불러올 수 없습니다.</p>
        <Link href="/city-select">
          <Button variant="outline">지역 다시 선택하기</Button>
        </Link>
      </div>
    );
  }

  const candidateNames = displayCandidates.slice(0, 2).map((c: any) => c.name).filter(Boolean).join(",");
  const { data: candidatePhotos = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["/api/politician-photos/batch", "candidates", candidateNames],
    queryFn: () =>
      fetch(`/api/politician-photos/batch?names=${encodeURIComponent(candidateNames)}`).then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
    enabled: !!candidateNames,
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] w-full pb-20">
      <TopHeader onSearchSelect={onSearchSelect} />
      
      <div className="px-8 pt-6 w-full max-w-[1400px] mx-auto">
        
        {/* Region Selector */}
        <div className="flex items-center justify-between mb-6 pb-2">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 items-center">
              {allRegions.map((r, idx) => (
                <button
                  key={r.code}
                  onClick={() => onSelectRegion(idx)}
                  className={`px-6 py-2.5 rounded-full text-sm font-black transition-all whitespace-nowrap shadow-sm border ${
                    region.code === r.code 
                      ? "bg-[#6320EE] text-white border-[#6320EE] shadow-[#6320EE]/20" 
                      : "bg-white text-gray-500 border-gray-100 hover:border-indigo-200"
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center pl-4">
            <Link href="/city-select">
              <button className="flex items-center gap-1 text-gray-500 hover:text-[#6320EE] text-[13px] font-bold px-4 py-2 rounded-full transition-all hover:bg-indigo-50/50 whitespace-nowrap group">
                관심 지역 설정
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-gray-400 group-hover:text-[#6320EE]" />
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
                  {mayorRace?.positionLabel || `${region.name}시장 선거`}
                </h1>
                <p className="text-gray-500 text-sm font-medium mt-2 text-center">제9회 전국동시지방선거 · 2026년 6월 3일</p>
                
                {/* Next Region Button */}
                {allRegions.length > 1 && onNextRegion && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <button 
                      onClick={onNextRegion}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-bold text-gray-600 hover:text-[#6320EE] hover:border-indigo-200 hover:bg-indigo-50 shadow-sm transition-all"
                    >
                      다른 지역 보기 <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* VS + Pledges Unified Card */}
            <div className="bg-gradient-to-b from-[#F0F4FF] to-white rounded-[2rem] shadow-sm border border-white relative overflow-hidden">

              {/* VS Section */}
              <div className="px-10 pt-10 pb-6">
                <div className="flex justify-center items-end relative z-10">
                  {/* Candidate A */}
                  <div
                    className="flex flex-col items-center flex-1 cursor-pointer"
                    onClick={() => {
                      saveCandidateToSession(String(candidateA.id ?? encodeURIComponent(candidateA.name)), candidateA);
                      setLocation(`/candidates/${candidateA.id ?? encodeURIComponent(candidateA.name)}`);
                    }}
                  >
                    <div className="relative group cursor-pointer">
                      <div className="w-[200px] h-[200px] rounded-full overflow-hidden border-[6px] border-[#3A6BFF] shadow-lg bg-indigo-50">
                        <PoliticianPhoto
                          name={candidateA.name}
                          photo={candidateA.photo}
                          resolvedUrl={candidatePhotos[candidateA.name]}
                          avatarClassName="w-full h-full bg-[#3A6BFF] text-white flex items-center justify-center text-4xl font-black"
                        />
                      </div>
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#3A6BFF] text-white px-5 py-1.5 rounded-full text-sm font-bold shadow-md whitespace-nowrap">
                        {candidateA.party}
                      </div>
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mt-8 mb-2">{candidateA.name}</h2>
                    <p className="text-[#3A6BFF] font-bold text-sm tracking-tight">{candidateA.slogan || "미래를 향한 발걸음"}</p>
                  </div>

                  {/* VS Badge */}
                  <div className="absolute left-1/2 top-[100px] -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center pointer-events-none">
                    <div className="bg-white rounded-full p-2 shadow-xl border border-gray-50">
                      <div className="bg-gradient-to-br from-indigo-100 to-indigo-50 w-16 h-16 rounded-full flex items-center justify-center shadow-inner">
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#3A6BFF] to-[#FF3B3B] italic">VS</span>
                      </div>
                    </div>
                  </div>

                  {/* Candidate B */}
                  {candidateB ? (
                    <div
                      className="flex flex-col items-center flex-1 cursor-pointer"
                      onClick={() => {
                        saveCandidateToSession(String(candidateB.id ?? encodeURIComponent(candidateB.name)), candidateB);
                        setLocation(`/candidates/${candidateB.id ?? encodeURIComponent(candidateB.name)}`);
                      }}
                    >
                      <div className="relative group cursor-pointer">
                        <div className="w-[200px] h-[200px] rounded-full overflow-hidden border-[6px] border-[#FF3B3B] shadow-lg bg-orange-50">
                          <PoliticianPhoto
                            name={candidateB.name}
                            photo={candidateB.photo}
                            resolvedUrl={candidatePhotos[candidateB.name]}
                            avatarClassName="w-full h-full bg-[#FF3B3B] text-white flex items-center justify-center text-4xl font-black"
                          />
                        </div>
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#FF3B3B] text-white px-5 py-1.5 rounded-full text-sm font-bold shadow-md whitespace-nowrap">
                          {candidateB.party}
                        </div>
                      </div>
                      <h2 className="text-3xl font-black text-gray-900 mt-8 mb-2">{candidateB.name}</h2>
                      <p className="text-[#FF3B3B] font-bold text-sm tracking-tight">{candidateB.slogan || "국민을 위한 새로운 변화"}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-[200px] h-[200px] rounded-full overflow-hidden border-[6px] border-gray-200 shadow-lg bg-gray-50 flex items-center justify-center">
                        <User className="w-20 h-20 text-gray-200" />
                      </div>
                      <h2 className="text-3xl font-black text-gray-300 mt-8 mb-2">후보 없음</h2>
                      <p className="text-gray-400 font-bold text-sm tracking-tight">추가 후보를 기다리고 있습니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider with Pledges Title */}
              <div className="mx-6 border-t border-gray-200/70" />

              {/* Pledges Section (핵심 공약 비교) */}
              {(() => {
                const pledgesA = normalizePledges(candidateA.pledges ?? candidateA.promises ?? []);
                const pledgesB = candidateB ? normalizePledges(candidateB.pledges ?? candidateB.promises ?? []) : [];
                const pairCount = Math.max(Math.min(pledgesA.length, 2), Math.min(pledgesB.length, 2), 1);

                return (
                  <div className="px-6 py-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-[#6320EE]">📋</span> 핵심 공약 비교
                      </h3>
                      <span className="text-[11px] font-bold text-[#6320EE] bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                        AI 분석 가능
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#3A6BFF]" />
                        <span className="text-xs font-black text-[#3A6BFF]">{candidateA.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-xs font-black text-[#FF3B3B]">{candidateB?.name || "후보자"}</span>
                        <div className={`w-2.5 h-2.5 rounded-full ${candidateB ? "bg-[#FF3B3B]" : "bg-gray-200"}`} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 relative">
                      {Array.from({ length: pairCount }).map((_, pIdx) => {
                        const topicLabel = PLEDGE_TOPIC_LABELS[pIdx] ?? `공약 ${pIdx + 1}`;
                        const pA = pledgesA[pIdx];
                        const pB = pledgesB[pIdx];

                        return (
                          <React.Fragment key={pIdx}>
                            {/* 중앙 배지 */}
                            <div
                              className="absolute z-10 pointer-events-none"
                              style={{
                                left: "50%",
                                top: pairCount === 1 ? "50%" : `${(pIdx / (pairCount - 1)) * 80 + 10}%`,
                                transform: "translate(-50%, -50%)",
                              }}
                            >
                              <div className="bg-white text-gray-500 text-xs font-bold px-3 py-1 rounded-full border border-gray-100 shadow-sm">
                                {topicLabel}
                              </div>
                            </div>

                            {/* Left: candidateA */}
                            {pA ? (
                              <div
                                className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer min-h-[140px] flex flex-col justify-between group"
                                onClick={() => {
                                  setSelectedCandidateId(String(candidateA.id));
                                  setSelectedCandidateName(candidateA.name);
                                  setSelectedCandidateParty(candidateA.party);
                                  setSelectedPledge(pA);
                                  setSelectedCompareWith(
                                    pB && candidateB
                                      ? { candidateId: String(candidateB.id), name: candidateB.name, party: candidateB.party, pledge: pB }
                                      : null
                                  );
                                }}
                              >
                                <div>
                                  <h4 className="text-[#3A6BFF] font-bold text-sm mb-2 flex items-center gap-1">
                                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                                    <span className="line-clamp-2">{pA.title}</span>
                                  </h4>
                                  {pA.description && (
                                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{pA.description}</p>
                                  )}
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-gray-400 font-medium mt-3">
                                  <span>핵심 공약 {pIdx + 1}</span>
                                  <span className="text-[10px] text-[#6320EE] font-bold opacity-0 group-hover:opacity-100 transition-opacity">AI 비교 보기 →</span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white/50 p-5 rounded-2xl border border-dashed border-blue-100 min-h-[140px] flex items-center justify-center">
                                <p className="text-xs text-slate-400">공약 준비 중</p>
                              </div>
                            )}

                            {/* Right: candidateB */}
                            {pB && candidateB ? (
                              <div
                                className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 hover:shadow-md hover:border-red-200 transition-all cursor-pointer min-h-[140px] flex flex-col justify-between group"
                                onClick={() => {
                                  setSelectedCandidateId(String(candidateB.id));
                                  setSelectedCandidateName(candidateB.name);
                                  setSelectedCandidateParty(candidateB.party);
                                  setSelectedPledge(pB);
                                  setSelectedCompareWith(
                                    pA
                                      ? { candidateId: String(candidateA.id), name: candidateA.name, party: candidateA.party, pledge: pA }
                                      : null
                                  );
                                }}
                              >
                                <div>
                                  <h4 className="text-[#FF3B3B] font-bold text-sm mb-2 flex items-center gap-1 justify-end">
                                    <span className="line-clamp-2 text-right">{pB.title}</span>
                                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                                  </h4>
                                  {pB.description && (
                                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 text-right">{pB.description}</p>
                                  )}
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-gray-400 font-medium mt-3 flex-row-reverse">
                                  <span>핵심 공약 {pIdx + 1}</span>
                                  <span className="text-[10px] text-[#6320EE] font-bold opacity-0 group-hover:opacity-100 transition-opacity">← AI 비교 보기</span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white/50 p-5 rounded-2xl border border-dashed border-red-100 min-h-[140px] flex items-center justify-center">
                                <p className="text-xs text-slate-400 text-right">
                                  {candidateB ? "공약 준비 중" : "후보 등록 전"}
                                </p>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Other Candidates */}
            {displayCandidates.length > 2 && (
              <div className="mt-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">기타 정당 및 무소속 후보</h3>
                <div className="grid grid-cols-2 gap-4">
                  {displayCandidates.slice(2).map((candidate) => (
                    <div 
                      key={candidate.id}
                      className="group bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
                      onClick={() => {
                        saveCandidateToSession(String(candidate.id ?? encodeURIComponent(candidate.name)), candidate);
                        setLocation(`/candidates/${candidate.id ?? encodeURIComponent(candidate.name)}`);
                      }}
                    >
                      <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-gray-100 bg-gray-50 flex items-center justify-center shrink-0 group-hover:border-indigo-100 transition-colors">
                        <PoliticianPhoto
                          name={candidate.name}
                          photo={candidate.photo}
                          resolvedUrl={candidatePhotos[candidate.name]}
                          avatarClassName="w-full h-full bg-gray-100 text-gray-400 flex items-center justify-center text-sm font-black"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${getPartyColor(candidate.party)}`} />
                          <div className={`text-[11px] font-bold ${getPartyColor(candidate.party).replace('bg-', 'text-')}`}>
                            {candidate.party}
                          </div>
                        </div>
                        <div className="text-[15px] font-black text-gray-900 mb-0.5">{candidate.name}</div>
                        <div className="text-[11px] text-gray-500 truncate leading-tight">
                          {candidate.slogan || "시민을 위한 새로운 선택"}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors shrink-0">
                        <Plus className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT: Widget Section */}
          <div className="flex flex-col gap-6">
            

            {/* Widget 1: 선거 주요 일정 */}
            <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 text-[15px]">선거 주요 일정</h3>
                <span className="text-[10px] font-bold text-[#6320EE] bg-indigo-50 px-2 py-1 rounded-md">D-32</span>
              </div>
              <div className="relative pl-3 space-y-6">
                {/* Timeline line */}
                <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-gray-100 z-0"></div>
                
                <div className="relative z-10 flex gap-4">
                  <div className="w-3 h-3 mt-1 rounded-full bg-white border-[3px] border-[#6320EE] flex-shrink-0"></div>
                  <div>
                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">OCT 15</div>
                    <div className="text-[13px] font-bold text-gray-900">제1차 TV 법정 토론회</div>
                    <div className="text-[11px] text-gray-400 mt-1">오후 8:00 MBC 생중계</div>
                  </div>
                </div>

                <div className="relative z-10 flex gap-4">
                  <div className="w-3 h-3 mt-1 rounded-full bg-white border-[3px] border-gray-200 flex-shrink-0"></div>
                  <div>
                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">OCT 28</div>
                    <div className="text-[13px] font-bold text-gray-900 opacity-60">재외 선거인 등록 마감</div>
                    <div className="text-[11px] text-gray-400 mt-1">중앙선관위 온라인 접수</div>
                  </div>
                </div>

                <div className="relative z-10 flex gap-4">
                  <div className="w-3 h-3 mt-1 rounded-full bg-white border-[3px] border-gray-200 flex-shrink-0"></div>
                  <div>
                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">NOV 07</div>
                    <div className="text-[13px] font-bold text-gray-900 opacity-60">제22대 총선 투표일</div>
                    <div className="text-[11px] text-gray-400 mt-1">오전 6시 ~ 오후 6시</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 2: 공약 토론 참여 */}
            <div className="bg-[#6320EE] rounded-[1.5rem] p-6 shadow-md text-white relative overflow-hidden">
              {/* Background abstract element */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                <span className="text-white text-lg">💬</span>
              </div>
              <h3 className="font-bold text-[15px] mb-3">공약 토론 참여</h3>
              <p className="text-xs text-indigo-100 leading-relaxed mb-6 opacity-90">
                현재 1,240명의 유권자가 경제 정책에 대해 열띤 토론 중입니다. 지금 참여하여 의견을 나누세요.
              </p>
              
              <div className="flex items-center gap-2 mb-6">
                <div className="flex -space-x-2">
                  <img src="https://i.pravatar.cc/100?img=11" className="w-7 h-7 rounded-full border-2 border-[#6320EE]" alt="User"/>
                  <img src="https://i.pravatar.cc/100?img=12" className="w-7 h-7 rounded-full border-2 border-[#6320EE]" alt="User"/>
                  <img src="https://i.pravatar.cc/100?img=13" className="w-7 h-7 rounded-full border-2 border-[#6320EE]" alt="User"/>
                </div>
                <span className="text-[10px] text-indigo-200">+ 124명 참여 중</span>
              </div>

              <Button
                className="w-full bg-white text-[#6320EE] hover:bg-gray-50 h-12 rounded-xl font-bold shadow-lg"
                onClick={() => setLocation("/community")}
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
        promise={selectedPledge}
        open={!!selectedPledge}
        onClose={() => { setSelectedPledge(null); setSelectedCompareWith(null); }}
        compareWith={selectedCompareWith}
      />
    </div>
  );
}

export default function ElectionHome() {
  const [, setLocation] = useLocation();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [temporaryRegions, setTemporaryRegions] = useState<{ code: string; name: string }[]>([]);

  // 유저 관심 지역 (localStorage, 동기 읽기로 깜박임 방지)
  const [userRegions] = useState<{ code: string; name: string }[]>(() => {
    const storedMulti = localStorage.getItem("userRegions");
    if (storedMulti) {
      try {
        const parsed = JSON.parse(storedMulti);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const storedSingle = localStorage.getItem("userRegion");
    if (storedSingle) {
      try {
        const parsed = JSON.parse(storedSingle);
        if (parsed?.code) return [parsed];
      } catch (e) {}
    }
    return [];
  });

  // 17개 시·도 전체 선거 목록 — 광역단체장만(기초 제외), 유저 관심 지역을 앞에 배치
  const allRegions = useMemo(() => {
    const all = MAYOR_RACES
      .map((r) => ({ code: r.regionCode, name: r.regionShort }));
    
    // 유저가 선택한 관심 지역만 반환 (최대 3개)
    const userFirst = userRegions
      .map((u) => all.find((a) => a.code === u.code))
      .filter((x): x is { code: string; name: string } => !!x)
      .slice(0, 6);
      
    // 검색 등으로 추가된 임시 지역들 포함
    const combined = [...userFirst];
    temporaryRegions.forEach(tr => {
      if (!combined.find(c => c.code === tr.code)) {
        combined.push(tr);
      }
    });

    return combined.length > 0 ? combined : all;
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

  const handleSearchSelect = (region: { code: string; name: string }) => {
    const existingIdx = allRegions.findIndex((r) => r.code === region.code);
    if (existingIdx !== -1) {
      setSelectedIdx(existingIdx);
    } else {
      setTemporaryRegions(prev => [...prev, region]);
      setSelectedIdx(allRegions.length);
    }
  };

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
      onSearchSelect={handleSearchSelect}
    />
  );
}
