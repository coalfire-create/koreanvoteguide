import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Landmark, ShieldCheck, Receipt, Scale, Vote, GraduationCap,
  Briefcase, Check, Plus, X, CheckCircle2, Users, MapPin,
} from "lucide-react";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { getPartyColor, getPartyRank } from "@/lib/mock-data";
import { saveCandidateToSession } from "@/pages/candidate-detail";

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
  age: number | null;
  pledges: any[];
  promises: any[];
  propertyAmount: string | null;
  militaryService: string | null;
  taxPaid: string | null;
  taxArrears: string | null;
  candidacyHistory: string | null;
  criminal: string | null;
  criminalRecords: (string | { title?: string; crime?: string; summary?: string; date?: string })[];
}

const partyText = (p: string) => getPartyColor(p).replace("bg-", "text-");

function criminalLinesOf(c: AssemblyCandidate): string[] {
  const arr = Array.isArray(c.criminalRecords) ? c.criminalRecords : [];
  return arr
    .map((r) => (typeof r === "string" ? r : `${r.title ?? r.crime ?? r.summary ?? "내용 미상"}${r.date ? ` (${r.date})` : ""}`))
    .filter(Boolean);
}

export default function AssemblyElection() {
  const [, setLocation] = useLocation();
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

  // 선거구별 그룹핑 (sdName + 선거구명)
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
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // 선거구 변경 시 비교 선택 초기화
  useEffect(() => { setCompareIds([]); }, [active?.key]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  };

  const compareList = (active?.list ?? []).filter((c) => compareIds.includes(c.id));

  const goDetail = (c: AssemblyCandidate) => {
    saveCandidateToSession(String(c.id), c);
    setLocation(`/candidates/${c.id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 px-5 pt-10 pb-8 text-white">
        <div className="max-w-6xl mx-auto">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-white/70 hover:text-white text-[13px] font-bold mb-4">
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
          <div className="mt-4 flex items-center gap-4 text-[12px] text-white/70 font-bold">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {districts.length}개 선거구</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {candidates.length}명 후보</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5">
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
                      <span className={`ml-1.5 text-[10px] ${on ? "text-white/70" : "text-muted-foreground/60"}`}>{d.list.length}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 안내 */}
            <div className="flex items-center justify-between mt-5 mb-3">
              <h2 className="text-[15px] font-black flex items-center gap-1.5">
                <span className={partyText(active?.list[0]?.party ?? "")}>{active?.name}</span>
                <span className="text-muted-foreground font-bold text-[13px]">후보 {active?.list.length}명</span>
              </h2>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                비교할 후보 선택 {compareIds.length}/3
              </span>
            </div>

            {/* 후보 카드 그리드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {active?.list.map((c) => {
                const color = getPartyColor(c.party);
                const selected = compareIds.includes(c.id);
                const full = compareIds.length >= 3 && !selected;
                return (
                  <div
                    key={c.id}
                    className={`relative bg-card rounded-3xl border p-4 transition-all ${
                      selected ? "border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg" : "border-border/40 hover:border-indigo-200 hover:shadow-md"
                    }`}
                  >
                    {/* 비교 토글 */}
                    <button
                      onClick={() => toggleCompare(c.id)}
                      disabled={full}
                      className={`absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                        selected ? "bg-indigo-600 text-white" : full ? "bg-muted text-muted-foreground/40 cursor-not-allowed" : "bg-muted text-muted-foreground hover:bg-indigo-100 hover:text-indigo-600"
                      }`}
                      title={selected ? "비교 빼기" : "비교 담기"}
                    >
                      {selected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>

                    <button onClick={() => goDetail(c)} className="w-full flex flex-col items-center text-center">
                      <div className={`w-[78px] h-[78px] rounded-full overflow-hidden border-[5px] ${color.replace("bg-", "border-")} shadow-sm mb-3`}>
                        <PoliticianPhoto
                          name={c.name}
                          photo={c.photo ?? ""}
                          context={c.party}
                          avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-xl font-black`}
                        />
                      </div>
                      <div className={`text-white text-[10px] font-black px-2 py-0.5 rounded-full ${color} mb-1.5`}>
                        기호 {getPartyRank(c.party)} · {c.party.replace("더불어", "")}
                      </div>
                      <h3 className="text-[15px] font-black leading-tight">{c.name}</h3>
                      <p className="text-[11px] text-muted-foreground font-bold mt-0.5 line-clamp-1">{c.job || c.career1 || ""}</p>
                      {c.propertyAmount && (
                        <p className="text-[10px] text-emerald-600 font-bold mt-1">재산 {c.propertyAmount}</p>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 비교 패널 */}
            {compareList.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-black flex items-center gap-2">
                    <Scale className="w-5 h-5 text-indigo-600" /> 후보 비교 ({compareList.length}명)
                  </h2>
                  <button onClick={() => setCompareIds([])} className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> 선택 초기화
                  </button>
                </div>
                <CompareTable list={compareList} onDetail={goDetail} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── 비교 테이블 ───────────────────────────────────────────────
function CompareTable({ list, onDetail }: { list: AssemblyCandidate[]; onDetail: (c: AssemblyCandidate) => void }) {
  // 좌측 라벨 열 + 후보 열
  const cols = `92px repeat(${list.length}, minmax(150px, 1fr))`;
  const Row = ({ label, icon, render }: { label: string; icon: React.ReactNode; render: (c: AssemblyCandidate) => React.ReactNode }) => (
    <div className="grid gap-3 py-3 border-b border-border/30 items-start" style={{ gridTemplateColumns: cols }}>
      <div className="flex items-center gap-1 text-[11px] font-black text-muted-foreground">{icon}{label}</div>
      {list.map((c) => (
        <div key={c.id} className="min-w-0 text-[13px] font-bold text-foreground leading-snug whitespace-pre-line break-words">{render(c)}</div>
      ))}
    </div>
  );
  const SectionRow = ({ title }: { title: string }) => (
    <div className="grid gap-3 pt-4 pb-1" style={{ gridTemplateColumns: cols }}>
      <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.12em] col-span-full">{title}</span>
    </div>
  );

  return (
    <div className="bg-card rounded-3xl border border-border/40 p-4 overflow-x-auto">
      {/* 헤더 행: (빈 라벨칸) + 후보 사진/이름 */}
      <div className="grid gap-3 pb-3 border-b-2 border-border/50" style={{ gridTemplateColumns: cols }}>
        <div />
        {list.map((c) => {
          const color = getPartyColor(c.party);
          return (
            <button key={c.id} onClick={() => onDetail(c)} className="flex flex-col items-center text-center group">
              <div className={`w-14 h-14 rounded-full overflow-hidden border-[3px] ${color.replace("bg-", "border-")} mb-1.5`}>
                <PoliticianPhoto name={c.name} photo={c.photo ?? ""} context={c.party} avatarClassName={`w-full h-full ${color} text-white flex items-center justify-center text-base font-black`} />
              </div>
              <span className="text-[13px] font-black group-hover:text-indigo-600">{c.name}</span>
              <span className={`text-[10px] font-bold ${color.replace("bg-", "text-")}`}>{c.party.replace("더불어", "")}</span>
            </button>
          );
        })}
      </div>

      <SectionRow title="검증 정보" />
      <Row label="재산" icon={<Landmark className="w-3 h-3" />} render={(c) => <span className="text-emerald-700">{c.propertyAmount || "정보 없음"}</span>} />
      <Row label="병역" icon={<ShieldCheck className="w-3 h-3" />} render={(c) => c.militaryService || "정보 없음"} />
      <Row label="세금납부" icon={<Receipt className="w-3 h-3" />} render={(c) => c.taxPaid || "정보 없음"} />
      <Row label="세금체납" icon={<Receipt className="w-3 h-3" />} render={(c) => c.taxArrears || "없음"} />
      <Row label="전과" icon={<Scale className="w-3 h-3" />} render={(c) => {
        const lines = criminalLinesOf(c);
        if (lines.length) return <span className="text-rose-700">{lines.join("\n")}</span>;
        if (c.criminal) return <span className="text-rose-700">{c.criminal}</span>;
        return <span className="text-emerald-700">없음</span>;
      }} />
      <Row label="입후보" icon={<Vote className="w-3 h-3" />} render={(c) => c.candidacyHistory || "정보 없음"} />

      <SectionRow title="기본 정보" />
      <Row label="직업" icon={<Briefcase className="w-3 h-3" />} render={(c) => c.job || "정보 없음"} />
      <Row label="학력" icon={<GraduationCap className="w-3 h-3" />} render={(c) => c.edu || "정보 없음"} />
      <Row label="경력" icon={<Briefcase className="w-3 h-3" />} render={(c) => c.career || c.career1 || "정보 없음"} />

      <SectionRow title="핵심 공약" />
      <div className="grid gap-3 pt-1" style={{ gridTemplateColumns: cols }}>
        <div className="flex items-center gap-1 text-[11px] font-black text-muted-foreground"><CheckCircle2 className="w-3 h-3" />공약</div>
        {list.map((c) => {
          const pledges = Array.isArray(c.pledges) ? c.pledges : [];
          return (
            <div key={c.id} className="min-w-0">
              {pledges.length === 0 ? (
                <p className="text-[12px] text-muted-foreground leading-relaxed">선관위 공약(매니페스토) 미등록<br /><span className="text-[10px]">국회의원 재보궐 후보는 공약 정보가 제공되지 않습니다.</span></p>
              ) : (
                <ul className="space-y-1.5">
                  {pledges.map((p: any, i: number) => (
                    <li key={i} className="text-[12px] font-bold text-foreground flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{p.title ?? (typeof p === "string" ? p : "")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
