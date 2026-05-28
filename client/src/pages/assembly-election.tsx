import { useState, useMemo } from "react";
import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Landmark, Users, MapPin, Sparkles, TrendingUp, Plus } from "lucide-react";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { getPartyColor, getPartyRank } from "@/lib/mock-data";
import { saveCandidateToSession } from "@/pages/candidate-detail";
import PledgeDetailView, { type CompareWith } from "@/components/PledgeDetailView";

type NormalizedPledge = { id: string; title: string; description: string; realmName?: string; content?: string; method?: string; funding?: string; duration?: string };

interface AssemblyCandidate {
  id: string;
  name: string;
  party: string;
  candidateStatus: string;
  sdName: string;
  districtName: string;
  photo: string | null;
  job: string | null;
  career: string | null;
  career1: string | null;
  edu: string | null;
  pledges: any[];
  promises: any[];
  propertyAmount: string | null;
}

function normalizePledges(raw: any[]): NormalizedPledge[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, i) => {
    if (typeof item === "string") return { id: `p${i}`, title: item.replace(/^\d+\.\s*/, "").trim(), description: "" };
    return {
      id: item.id ?? `p${i}`,
      title: item.title ?? String(item),
      description: item.description ?? item.goalCont ?? "",
      realmName: item.realmName ?? undefined,
      content: item.goalCont ?? item.content ?? undefined,
      method: item.methCont ?? item.method ?? undefined,
      funding: item.deptCont ?? item.funding ?? undefined,
      duration: item.distCont ?? item.duration ?? undefined,
    };
  });
}

export default function AssemblyElection() {
  const [, setLocation] = useLocation();

  const [selectedPledge, setSelectedPledge] = useState<NormalizedPledge | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidateName, setSelectedCandidateName] = useState<string>("");
  const [selectedCandidateParty, setSelectedCandidateParty] = useState<string>("");
  const [selectedCandidateJob, setSelectedCandidateJob] = useState<string>("");
  const [selectedCandidateCareer1, setSelectedCandidateCareer1] = useState<string>("");
  const [selectedCompareWith, setSelectedCompareWith] = useState<CompareWith | null>(null);

  const { data: candidates = [], isLoading } = useQuery<AssemblyCandidate[]>({
    queryKey: ["/api/election/assembly"],
    queryFn: async () => {
      const res = await fetch("/api/election/assembly");
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const [userRegions, setUserRegions] = useState<{ code: string; name: string, level?: string }[]>(() => {
    const storedMulti = localStorage.getItem("userRegions");
    let regions: { code: string; name: string, level?: string }[] = [];
    if (storedMulti) {
      try {
        const parsed = JSON.parse(storedMulti);
        if (Array.isArray(parsed)) regions = parsed;
      } catch (e) {}
    }
    return regions.filter(r => r.level === "assembly").slice(0, 3);
  });

  // 전체 선거구 목록 (선택 여부 무관)
  const allDistricts = useMemo(() => {
    const map = new Map<string, { key: string; sd: string; name: string }>();
    for (const c of candidates) {
      const key = `${c.sdName}_${c.districtName}`;
      if (!map.has(key)) map.set(key, { key, sd: c.sdName, name: c.districtName });
    }
    return [...map.values()].sort((a, b) => a.sd.localeCompare(b.sd) || a.name.localeCompare(b.name));
  }, [candidates]);

  // 관심지역으로 필터된 선거구 (후보 포함)
  const districts = useMemo(() => {
    const map = new Map<string, { key: string; sd: string; name: string; list: AssemblyCandidate[] }>();
    for (const c of candidates) {
      const key = `${c.sdName}_${c.districtName}`;
      if (userRegions.some(r => r.code === key)) {
        if (!map.has(key)) map.set(key, { key, sd: c.sdName, name: c.districtName, list: [] });
        map.get(key)!.list.push(c);
      }
    }
    return [...map.values()].sort((a, b) => a.sd.localeCompare(b.sd) || a.name.localeCompare(b.name));
  }, [candidates, userRegions]);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = activeKey ? districts.find((d) => d.key === activeKey) : districts[0];

  const { vs, minor } = useMemo(() => {
    const sorted = [...(active?.list ?? [])]
      .filter((c) => !["등록무효", "사퇴", "사망", "등록거부"].includes(c.candidateStatus || ""))
      .sort((a, b) => getPartyRank(a.party) - getPartyRank(b.party));
    const pick = (p: string) => sorted.find((c) => c.party?.includes(p));
    const used = new Set<string>();
    const v: AssemblyCandidate[] = [];
    for (const p of ["민주당", "국민의힘"]) { const c = pick(p); if (c) { v.push(c); used.add(c.id); } }
    for (const c of sorted) { if (v.length >= 2) break; if (!used.has(c.id)) { v.push(c); used.add(c.id); } }
    return { vs: v, minor: sorted.filter((c) => !used.has(c.id)) };
  }, [active]);

  const addRegion = (d: { key: string; name: string }) => {
    if (userRegions.length >= 3) return;
    const next = [...userRegions, { code: d.key, name: d.name, level: "assembly" }];
    setUserRegions(next);
    const stored: { code: string; name: string; level?: string }[] = JSON.parse(localStorage.getItem("userRegions") ?? "[]");
    const merged = [...stored.filter((r) => r.level !== "assembly"), ...next];
    localStorage.setItem("userRegions", JSON.stringify(merged));
  };

  const go = (c: AssemblyCandidate) => { saveCandidateToSession(String(c.id), c); setLocation(`/candidates/${c.id}`); };

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] text-foreground pb-24">
      {/* 헤더 */}
      <div className="bg-[#0F172A] px-5 pb-7 text-white pt-[calc(2.25rem+env(safe-area-inset-top,0px))]">
        <div className="max-w-[1400px] mx-auto">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-white/70 hover:text-white text-[13px] font-bold mb-3">
              <ArrowLeft className="w-4 h-4" /> 지방선거 홈
            </button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">국회의원 재·보궐선거</h1>
              <p className="text-white/60 text-[12px] font-medium mt-0.5">제9회 지방선거 동시 실시 · 2026년 6월 3일</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[12px] text-white/70 font-bold">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {districts.length}개 선거구</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {candidates.length}명 후보</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-3 pt-3">
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground text-sm">불러오는 중…</div>
        ) : districts.length === 0 ? (
          /* 관심지역 미선택 → 인라인 선택기 */
          <div className="mt-6 bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-indigo-500" />
              <h3 className="text-[15px] font-black text-foreground">관심 선거구 선택</h3>
            </div>
            <p className="text-[12px] text-muted-foreground mb-4">선거구를 탭하면 후보 정보가 바로 나타납니다 (최대 3개)</p>
            <div className="flex flex-wrap gap-2">
              {allDistricts.map((d) => (
                <button
                  key={d.key}
                  onClick={() => addRegion(d)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border/60 bg-muted/30 text-[12px] font-bold text-foreground hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 active:scale-95 transition-all"
                >
                  <span className="text-[10px] text-muted-foreground">{d.sd.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, "")}</span>
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-3 px-3 py-3 bg-[#F2F2F7]/95 dark:bg-[#000000]/95 backdrop-blur border-b border-border/40">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center">
                {districts.map((d) => {
                  const on = d.key === active?.key;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setActiveKey(d.key)}
                      className={`shrink-0 px-3.5 py-2 rounded-full text-[12px] font-black transition-all border ${
                        on ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-card text-muted-foreground border-border/50 hover:border-indigo-300"
                      }`}
                    >
                      <span className="opacity-60 mr-1">{d.sd.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, "")}</span>
                      {d.name}
                    </button>
                  );
                })}
                <Link href="/city-select">
                  <button className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-[12px] font-bold bg-black/5 dark:bg-white/5 text-muted-foreground border border-transparent hover:bg-black/10 dark:hover:bg-white/10 transition-colors ml-1">
                    <span className="text-[14px] leading-none">+</span> 다른 지역 알아보기
                  </button>
                </Link>
              </div>
            </div>

            {/* Main content card */}
            <div className="mt-4">
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm">
                {/* 선거구 헤더 */}
                <div className="pt-5 pb-4 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <div className="flex items-center justify-between px-5 mb-3">
                    <span className="text-[12px] font-black px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      국회의원 재보궐
                    </span>
                    <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                      <TrendingUp className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-black text-red-600">격전지</span>
                    </div>
                  </div>
                  <div className="text-center px-5">
                    <h2 className="text-[20px] font-extrabold text-foreground tracking-tight">{active?.name} 국회의원선거</h2>
                    <p className="text-[12px] text-muted-foreground mt-1">2026. 6. 3 · 국회의원 재·보궐선거 · {active?.list.length}명 출마</p>
                  </div>
                </div>

                {/* VS Matchup — election-home과 동일 구조 */}
                <div className="px-4 pt-5 pb-5">
                  <div className="flex flex-row items-center justify-center gap-2 sm:gap-6 md:gap-12 py-4">
                    {vs.map((c, idx) => {
                      const color = getPartyColor(c.party);
                      return (
                        <React.Fragment key={c.id}>
                          <div
                            className="flex flex-col items-center cursor-pointer flex-1 max-w-[280px] active:opacity-70 transition-opacity"
                            onClick={() => go(c)}
                          >
                            <div className="relative">
                              <div className="w-[112px] h-[112px] sm:w-[148px] sm:h-[148px] rounded-full overflow-hidden border-[3px] border-white shadow-lg relative z-10 bg-card">
                                <PoliticianPhoto
                                  name={c.name}
                                  photo={c.photo}
                                  context={c.party}
                                  avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-2xl sm:text-3xl font-black`}
                                />
                              </div>
                            </div>
                            <div className="text-center mt-4">
                              <p className="text-[11px] text-muted-foreground mb-1">{c.party.replace("더불어", "").replace("당", "")}</p>
                              <h4 className="text-[18px] sm:text-[20px] font-black text-foreground break-keep">{c.name}</h4>
                              {(c.job || c.career1) && (
                                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{c.job || c.career1}</p>
                              )}
                            </div>
                          </div>
                          {idx === 0 && vs.length > 1 && (
                            <div className="flex flex-col items-center justify-center shrink-0">
                              <span className="text-[11px] font-black text-muted-foreground/40 tracking-widest">VS</span>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* 기타 후보 — 가로 스크롤 (election-home 동일) */}
                  {minor.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-black/5 dark:border-white/10">
                      <h4 className="text-[11px] text-muted-foreground mb-3">그 외 후보</h4>
                      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                        {minor.map((c) => {
                          const color = getPartyColor(c.party);
                          return (
                            <motion.div
                              key={c.id}
                              className="w-[110px] flex-shrink-0 bg-white dark:bg-[#2C2C2E] rounded-2xl p-3 cursor-pointer active:opacity-70 transition-opacity overflow-hidden"
                              onClick={() => go(c)}
                            >
                              <div className="flex flex-col items-center">
                                <div className="mb-3">
                                  <div className="w-[64px] h-[64px] rounded-full overflow-hidden border-2 border-white shadow-md">
                                    <PoliticianPhoto
                                      name={c.name}
                                      photo={c.photo}
                                      context={c.party}
                                      avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-lg font-black`}
                                    />
                                  </div>
                                </div>
                                <h5 className="text-[13px] font-bold text-foreground mb-0.5 break-keep text-center">{c.name}</h5>
                                <p className="text-[10px] text-muted-foreground text-center leading-tight">{c.party.replace("더불어", "").replace("당", "")}</p>
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

                {/* 공약 비교 — election-home 스택 레이아웃 동일 */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h3 className="text-[15px] font-bold text-foreground">핵심 공약 비교</h3>
                  </div>

                  {(() => {
                    const allMainPledges = vs.map((c) => normalizePledges(c.pledges ?? c.promises ?? []));
                    const maxPledgeCount = Math.max(...allMainPledges.map((p) => p.length), 0);
                    const hasAnyPledges = maxPledgeCount > 0 || minor.some((c) => normalizePledges(c.pledges ?? c.promises ?? []).length > 0);

                    if (!hasAnyPledges) {
                      return (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                            <Sparkles className="w-7 h-7 text-muted-foreground" />
                          </div>
                          <p className="text-[15px] font-bold text-foreground">국회의원 후보 공약은 준비 중입니다</p>
                          <p className="text-[12px] text-muted-foreground max-w-md text-center">
                            선관위는 단체장·교육감 후보의 매니페스토 공약만 제공합니다. 국회의원 재보궐 후보의 공약은 각 후보 상세 페이지의 검증 정보와 경력을 참고하세요.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-8 sm:gap-12">
                        {/* 주요 후보 공약 — VS 2열 레이아웃 */}
                        <div className="flex flex-col gap-6">
                          {Array.from({ length: maxPledgeCount }).map((_, pIdx) => {
                            const leftC = vs[0];
                            const rightC = vs[1];
                            const leftP = leftC ? normalizePledges(leftC.pledges ?? leftC.promises ?? [])[pIdx] : null;
                            const rightP = rightC ? normalizePledges(rightC.pledges ?? rightC.promises ?? [])[pIdx] : null;
                            if (!leftP && !rightP) return null;

                            const makePledgeCard = (candidate: typeof leftC, p: typeof leftP) => {
                              if (!candidate || !p) return <div className="flex-1" />;
                              const color = getPartyColor(candidate.party);
                              const otherC = candidate.id === leftC?.id ? rightC : leftC;
                              const otherP = otherC ? normalizePledges(otherC.pledges ?? otherC.promises ?? [])[pIdx] : null;
                              
                              return (
                                <div
                                  className={`flex-1 min-w-0 bg-white dark:bg-[#2C2C2E] rounded-[18px] shadow-sm border border-black/5 dark:border-white/5 cursor-pointer active:opacity-70 transition-all hover:shadow-md relative overflow-hidden group`}
                                  onClick={() => {
                                    setSelectedCandidateId(String(candidate.id));
                                    setSelectedCandidateName(candidate.name);
                                    setSelectedCandidateParty(candidate.party);
                                    setSelectedCandidateJob(candidate.job ?? "");
                                    setSelectedCandidateCareer1(candidate.career1 ?? candidate.career ?? "");
                                    setSelectedPledge(p);
                                    if (otherC && otherP) {
                                      setSelectedCompareWith({
                                        candidateId: String(otherC.id),
                                        name: otherC.name,
                                        party: otherC.party,
                                        job: otherC.job ?? "",
                                        career1: otherC.career1 ?? otherC.career ?? "",
                                        pledge: otherP,
                                      });
                                    } else {
                                      setSelectedCompareWith(null);
                                    }
                                  }}
                                >
                                  {/* 상단 컬러 바 */}
                                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${color} opacity-80`} />
                                  
                                  <div className="p-3.5 pt-4">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                                      <span className="text-[12px] font-black text-foreground truncate">{candidate.name}</span>
                                    </div>
                                    
                                    {p.realmName && (
                                      <span className="inline-block text-[10px] font-bold text-primary/60 mb-1">{p.realmName}</span>
                                    )}
                                    <h5 className="text-[13px] font-bold text-foreground leading-[1.4] line-clamp-3 mb-1.5 group-hover:text-primary transition-colors">
                                      {p.title}
                                    </h5>
                                    {p.description && (
                                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{p.description}</p>
                                    )}
                                    
                                    {(p.method || p.funding || p.duration) && (
                                      <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                                        {p.method && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">이행 ✓</span>}
                                        {p.funding && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 px-1.5 py-0.5 rounded-md">재원 ✓</span>}
                                        {p.duration && <span className="text-[10px] font-bold text-sky-600 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-400 px-1.5 py-0.5 rounded-md">기간 ✓</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            };

                            return (
                              <div key={pIdx} className="flex flex-col gap-2 relative">
                                <div className="flex items-center justify-center">
                                  <div className="bg-muted/50 px-3 py-1 rounded-full border border-black/5 dark:border-white/5">
                                    <span className="text-[11px] font-black text-muted-foreground tracking-widest">공약 {pIdx + 1}</span>
                                  </div>
                                </div>
                                <div className="flex items-stretch gap-3 relative z-0">
                                  {makePledgeCard(leftC, leftP)}
                                  
                                  {/* 중앙 VS 뱃지 */}
                                  {rightC && (
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center pointer-events-none">
                                      <div className="w-7 h-7 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center shadow-lg border-[2px] border-white dark:border-[#1C1C1E]">
                                        <span className="text-white dark:text-gray-900 text-[10px] font-black italic tracking-tighter pr-0.5">VS</span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {rightC && makePledgeCard(rightC, rightP)}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 기타 후보 공약 — election-home 동일 compact list */}
                        {minor.length > 0 && (
                          <div className="pt-5 border-t border-black/5 dark:border-white/10">
                            <div className="text-[11px] font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                              <Plus className="w-3 h-3" /> 기타 정당 후보 공약
                            </div>
                            <div className="flex flex-col gap-2">
                              {minor.map((c) => {
                                const pledges = normalizePledges(c.pledges ?? c.promises ?? []);
                                const color = getPartyColor(c.party);
                                return (
                                  <div key={c.id} className="bg-white dark:bg-[#2C2C2E] p-3 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                                      <span className="text-[11px] font-bold text-foreground">{c.name} (기호 {getPartyRank(c.party)})</span>
                                    </div>
                                    {pledges.length === 0 ? (
                                      <p className="text-[11px] text-muted-foreground">등록된 공약이 없습니다</p>
                                    ) : (
                                      <div className="flex flex-col gap-1.5">
                                        {pledges.slice(0, 3).map((p, pIdx) => (
                                          <div
                                            key={`${c.id}-${p.id}`}
                                            className="cursor-pointer active:opacity-70"
                                            onClick={() => {
                                              setSelectedCandidateId(String(c.id));
                                              setSelectedCandidateName(c.name);
                                              setSelectedCandidateParty(c.party);
                                              setSelectedCandidateJob(c.job ?? "");
                                              setSelectedCandidateCareer1(c.career1 ?? c.career ?? "");
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
          </>
        )}
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
    </div>
  );
}
