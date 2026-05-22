import { useState, useMemo } from "react";
import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Landmark, Users, MapPin, Sparkles, TrendingUp, ChevronRight } from "lucide-react";
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

// election-home의 normalizePledges 동일 로직 (공약 구조화 데이터 보존)
function normalizePledges(raw: any[]): { id: string; title: string; description: string; realmName?: string; content?: string; method?: string; funding?: string; duration?: string }[] {
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

  // 공약 상세 비교 모달 상태 (시장 선거 election-home과 동일)
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

  const districts = useMemo(() => {
    const map = new Map<string, { key: string; sd: string; name: string; list: AssemblyCandidate[] }>();
    for (const c of candidates) {
      const key = c.districtName;
      if (!map.has(key)) map.set(key, { key, sd: c.sdName, name: c.districtName, list: [] });
      map.get(key)!.list.push(c);
    }
    return [...map.values()].sort((a, b) => a.sd.localeCompare(b.sd) || a.name.localeCompare(b.name));
  }, [candidates]);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = districts.find((d) => d.key === activeKey) ?? districts[0];

  // 후보 정렬 + VS / minor 분할 (시장 선거와 동일 규칙)
  const { vs, minor } = useMemo(() => {
    const sorted = [...(active?.list ?? [])]
      .filter((c) => !["등록무효", "사퇴", "사망", "등록거부"].includes(c.candidateStatus || ""))
      .sort((a, b) => getPartyRank(a.party) - getPartyRank(b.party));
    const pick = (p: string) => sorted.find((c) => c.party?.includes(p));
    const used = new Set<string>();
    const v: AssemblyCandidate[] = [];
    for (const p of ["더불어민주당", "국민의힘"]) { const c = pick(p); if (c) { v.push(c); used.add(c.id); } }
    for (const c of sorted) { if (v.length >= 2) break; if (!used.has(c.id)) { v.push(c); used.add(c.id); } }
    return { vs: v, minor: sorted.filter((c) => !used.has(c.id)) };
  }, [active]);

  const go = (c: AssemblyCandidate) => { saveCandidateToSession(String(c.id), c); setLocation(`/candidates/${c.id}`); };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 px-5 pt-9 pb-7 text-white">
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

      <div className="max-w-[1400px] mx-auto px-5">
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground text-sm">불러오는 중…</div>
        ) : districts.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">국회의원 재보궐선거 후보 정보가 없습니다.</div>
        ) : (
          <>
            {/* 선거구 탭 (가로 스크롤) */}
            <div className="sticky top-0 z-20 -mx-5 px-5 py-3 bg-background/95 backdrop-blur border-b border-border/40">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
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
              </div>
            </div>

            {/* ── 시장 선거와 동일한 쇼케이스 레이아웃 ── */}
            <div className="mt-6">
              <div className="relative flex flex-col items-center justify-center py-4">
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-center">{active?.name} 국회의원선거</h2>
                <p className="text-muted-foreground text-sm font-medium mt-2">국회의원 재·보궐선거 · 후보 {active?.list.length}명</p>
              </div>

              <div className="bg-card rounded-[2.5rem] shadow-sm border border-border/30 overflow-hidden mt-2">
                <div className="px-6 sm:px-8 pt-8 pb-8">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black flex items-center gap-2">주요 후보 핵심 정책 대결</h3>
                    <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                      <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-[10px] font-black text-red-600">재보궐 격전지</span>
                    </div>
                  </div>

                  {/* VS Matchup */}
                  <div className="flex flex-row items-center justify-center gap-2 sm:gap-6 md:gap-12 py-4">
                    {vs.map((c, idx) => {
                      const color = getPartyColor(c.party);
                      return (
                        <React.Fragment key={c.id}>
                          <motion.div whileHover={{ y: -8, scale: 1.02 }} className="flex flex-col items-center group cursor-pointer flex-1 max-w-[280px]" onClick={() => go(c)}>
                            <div className="relative">
                              <div className={`w-[120px] h-[120px] sm:w-[160px] sm:h-[160px] md:w-[200px] md:h-[200px] rounded-full overflow-hidden border-[6px] md:border-[8px] ${color.replace("bg-", "border-")} shadow-xl group-hover:shadow-2xl transition-all duration-300 relative z-10 bg-card`}>
                                <PoliticianPhoto name={c.name} photo={c.photo} context={c.party} avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-black`} />
                              </div>
                              <div className={`absolute -bottom-2 md:-bottom-3 left-1/2 -translate-x-1/2 ${color} text-white px-3 sm:px-6 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] md:text-[12px] font-black shadow-lg whitespace-nowrap z-20`}>
                                기호 {getPartyRank(c.party)} · {c.party.replace("더불어", "")}
                              </div>
                              <div className={`absolute inset-0 rounded-full border-2 ${color.replace("bg-", "border-")} opacity-20 scale-110 group-hover:scale-125 transition-transform duration-500`} />
                            </div>
                            <div className="text-center mt-6 md:mt-8">
                              <h4 className="text-[17px] sm:text-[20px] md:text-2xl font-black mb-1 md:mb-2">{c.name}</h4>
                              {(c.job || c.career1) && (
                                <p className={`text-[10px] sm:text-[11px] md:text-[13px] font-bold ${color.replace("bg-", "text-")} bg-muted px-2 sm:px-4 py-1 rounded-lg line-clamp-1`}>{c.job || c.career1}</p>
                              )}
                            </div>
                          </motion.div>
                          {idx === 0 && vs.length > 1 && (
                            <div className="flex flex-col items-center justify-center shrink-0">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-foreground text-background flex items-center justify-center text-xs sm:text-sm md:text-xl font-black italic shadow-lg z-10">VS</div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Minor candidates */}
                  {minor.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-border/30">
                      <h4 className="text-sm font-black text-muted-foreground mb-6 uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4" /> 다른 후보자들
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {minor.map((c) => {
                          const color = getPartyColor(c.party);
                          return (
                            <motion.div key={c.id} whileHover={{ y: -8, scale: 1.02 }} className="bg-card rounded-[2rem] p-5 border border-border/30 hover:border-primary/20 hover:shadow-xl transition-all cursor-pointer group" onClick={() => go(c)}>
                              <div className="flex flex-col items-center">
                                <div className="relative mb-5">
                                  <div className={`w-[90px] h-[90px] rounded-full overflow-hidden border-[6px] ${color.replace("bg-", "border-")} shadow-sm`}>
                                    <PoliticianPhoto name={c.name} photo={c.photo} context={c.party} avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-xl font-black`} />
                                  </div>
                                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${color} text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg border-2 border-card whitespace-nowrap`}>
                                    기호 {getPartyRank(c.party)}
                                  </div>
                                </div>
                                <h5 className="text-[16px] font-black mb-1 group-hover:text-primary transition-colors">{c.name}</h5>
                                <p className="text-[11px] text-muted-foreground font-bold mb-1">{c.party}</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mx-8 border-t border-border/30" />

                {/* Pledge Comparison (시장 선거와 동일) */}
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-black flex items-center gap-2">핵심 공약 비교 분석</h3>
                      <p className="text-xs text-muted-foreground font-medium">후보자별 공약을 비교하고 상세 분석을 확인하세요</p>
                    </div>
                    <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-black text-primary">AI 심층 비교</span>
                    </div>
                  </div>

                  {(() => {
                    const hasAny = (active?.list ?? []).some((c) => normalizePledges(c.pledges ?? c.promises ?? []).length > 0);
                    if (!hasAny) {
                      return (
                        <div className="flex flex-col items-center justify-center py-14 gap-3">
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-1">
                            <Sparkles className="w-7 h-7 text-muted-foreground" />
                          </div>
                          <p className="text-[15px] font-bold">국회의원 후보 공약은 준비 중입니다</p>
                          <p className="text-[12px] text-muted-foreground max-w-md text-center">
                            선관위는 단체장·교육감 후보의 매니페스토 공약만 제공합니다. 국회의원 재보궐 후보의 공약은 각 후보 상세 페이지의 검증 정보(재산·병역·세금·전과)와 경력을 참고하세요.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {vs.map((c) => {
                          const pledges = normalizePledges(c.pledges ?? c.promises ?? []);
                          const color = getPartyColor(c.party);
                          return (
                            <div key={c.id} className="flex flex-col gap-4">
                              <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                                <div className={`w-2 h-2 rounded-full ${color}`} />
                                <span className="text-[14px] font-black">{c.name}</span>
                                <span className="text-[11px] text-muted-foreground ml-auto">{pledges.length}개 공약</span>
                              </div>
                              {pledges.length === 0 ? (
                                <div className="bg-muted rounded-2xl p-6 text-center text-[12px] text-muted-foreground">등록된 공약이 없습니다.</div>
                              ) : pledges.map((p, pIdx) => (
                                <motion.div
                                  key={p.id}
                                  whileHover={{ y: -3 }}
                                  className="bg-card p-5 rounded-2xl shadow-sm border border-border/30 hover:border-primary/20 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
                                  onClick={() => {
                                    setSelectedCandidateId(String(c.id));
                                    setSelectedCandidateName(c.name);
                                    setSelectedCandidateParty(c.party);
                                    setSelectedCandidateJob(c.job ?? "");
                                    setSelectedCandidateCareer1(c.career1 ?? c.career ?? "");
                                    setSelectedPledge(p);
                                    const firstOther = vs.find((o) => o.id !== c.id);
                                    if (firstOther) {
                                      const otherPledges = normalizePledges(firstOther.pledges ?? firstOther.promises ?? []);
                                      const otherP = otherPledges[pIdx];
                                      setSelectedCompareWith(otherP ? {
                                        candidateId: String(firstOther.id),
                                        name: firstOther.name,
                                        party: firstOther.party,
                                        job: firstOther.job ?? "",
                                        career1: firstOther.career1 ?? firstOther.career ?? "",
                                        pledge: otherP,
                                      } : null);
                                    } else {
                                      setSelectedCompareWith(null);
                                    }
                                  }}
                                >
                                  <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
                                  <div className="flex items-start gap-3 pl-3">
                                    <div className="flex-1 min-w-0">
                                      {p.realmName && <span className="inline-block text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md mb-1.5 uppercase">{p.realmName}</span>}
                                      <h5 className="text-[14px] font-bold mb-1.5 leading-snug group-hover:text-primary transition-colors">{p.title}</h5>
                                      {p.description && <p className="text-[12px] text-muted-foreground line-clamp-2">{p.description}</p>}
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0 mt-0.5">
                                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary" />
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          );
                        })}
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
