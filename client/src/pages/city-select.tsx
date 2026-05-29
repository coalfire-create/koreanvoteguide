import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ChevronRight, MapPin, Search, Map as MapIcon, BarChart2, Newspaper, MessageCircle, X, Landmark } from "lucide-react";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const PARTY_COLOR: Record<string, string> = {
  "민주당": "#3A6BFF",
  "국민의힘": "#FF3B3B",
  "조국혁신당": "#1e3a8a",
  "개혁신당": "#f97316",
};

function getPartyBg(party: string) {
  const c = PARTY_COLOR[party];
  return c ? `${c}18` : "#f3f4f6";
}

function getPartyText(party: string) {
  return PARTY_COLOR[party] ?? "#6b7280";
}

function abbrevParty(party: string): string {
  const MAP: Record<string, string> = {
    "민주당": "민주당",
    "국민의힘": "국민의힘",
    "조국혁신당": "조국혁신당",
    "개혁신당": "개혁신당",
  };
  return MAP[party] ?? party.slice(0, 5);
}

const FEATURES = [
  { icon: MapIcon,       color: "#ffffff", title: "지역별 후보자 비교",    desc: "내 지역 후보들의 공약·이력·뉴스를 한눈에" },
  { icon: BarChart2,     color: "#ffffff", title: "국회의원 표결 추적",    desc: "어떤 법안에 어떻게 투표했는지 확인" },
  { icon: Newspaper,     color: "#ffffff", title: "AI 정치 뉴스 분석",     desc: "12개 언론사 뉴스를 AI가 핵심만 전달" },
  { icon: MessageCircle, color: "#ffffff", title: "유권자 커뮤니티",       desc: "이웃들과 지역 현안과 정치를 이야기" },
];

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-06-03").getTime() - Date.now()) / 86400000));

  return (
    <div className="min-h-screen flex flex-col w-full bg-[#0F172A]">
      {/* ─── Hero ─── */}
      <div className="w-full flex-shrink-0 relative overflow-hidden bg-[#0F172A]">
        {/* Decorative blobs */}
        <div className="absolute top-8 right-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-20 right-16 w-14 h-14 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute bottom-16 left-4 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative w-full px-6 pt-16 pb-14 max-w-[680px] mx-auto">
          {/* D-day badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-white/10 text-white text-[12px] font-bold px-3 py-1.5 rounded-full mb-6 border border-white/10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />
            2026 지방선거 D-{daysLeft}
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-[44px] font-black text-white leading-[1.05] tracking-tight mb-4">
              이유있게<br />투표하세요
            </h1>
            <p className="text-[15px] text-gray-300 leading-relaxed">
              후보자 정보부터 국회의원 활동까지<br />투표에 필요한 모든 정보를 한 곳에서
            </p>
          </motion.div>
        </div>

        <div className="w-full overflow-hidden" style={{ marginBottom: "-2px" }}>
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0 48L1440 48L1440 16C1100 52 420 -4 0 28L0 48Z" fill="#0F172A" />
          </svg>
        </div>
      </div>

      {/* ─── Features ─── */}
      <div className="flex-1 bg-[#0F172A] w-full px-5 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] max-w-[680px] mx-auto self-center">
        <p className="text-[11px] font-black text-white/50 uppercase tracking-widest mb-4 px-1">
          이런 걸 도와드려요
        </p>

        <div className="space-y-2.5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4 bg-[#1E293B] rounded-[18px] p-4 shadow-sm border border-white/5"
              >
                <div
                  className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0 bg-white/10"
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-black text-white leading-tight">{f.title}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5 leading-snug">{f.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              </motion.div>
            );
          })}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.68 }}
          className="flex items-center mt-6 bg-[#1E293B] rounded-[18px] border border-white/5 shadow-sm overflow-hidden"
        >
          {[
            { num: "17개", label: "광역시도" },
            { num: "300+", label: "국회의원" },
            { num: "12개", label: "언론사 뉴스" },
          ].map((s, i) => (
            <div key={s.label} className={`flex-1 py-4 text-center ${i < 2 ? "border-r border-white/5" : ""}`}>
              <div className="text-[18px] font-black text-white">{s.num}</div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ─── Fixed CTA ─── */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 260, damping: 26 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0F172A]/90 backdrop-blur-xl border-t border-white/10 px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="max-w-[680px] mx-auto">
          <button
            onClick={onStart}
            className="w-full h-14 bg-white hover:bg-gray-100 active:scale-[0.98] text-[#0F172A] rounded-[16px] text-[16px] font-black shadow-xl shadow-white/10 flex items-center justify-center gap-2 transition-all duration-150"
          >
            지역 선택하고 시작하기
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-center text-[11px] text-gray-500 mt-2.5 font-medium">무료 · 광고 없음 · 1분이면 완료</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function CitySelect() {
  const [, setLocation] = useLocation();
  const { user, mutate } = useAuth();
  const { toast } = useToast();
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-06-03").getTime() - Date.now()) / 86400000));

  const [step, setStep] = useState<"welcome" | "select">(() => {
    if (
      typeof window !== "undefined" &&
      (localStorage.getItem("hasSeenOnboarding") || localStorage.getItem("userRegions"))
    ) {
      return "select";
    }
    return "welcome";
  });

  const [electionTab, setElectionTab] = useState<"local" | "assembly">(() => {
    // /city-select?tab=assembly 로 접속 시 보궐선거 탭 자동 선택
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "assembly") return "assembly";
    }
    return "local";
  });

  // 보궐선거 후보 데이터
  const { data: assemblyRaw = [], isLoading: assemblyLoading, isError: assemblyError, refetch: assemblyRefetch, error: assemblyErrorDetail } = useQuery<any[]>({
    queryKey: ["/api/election/assembly"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
      try {
        const r = await fetch("/api/election/assembly", { 
          credentials: "include",
          signal: controller.signal,
          headers: { "Accept": "application/json" }
        });
        clearTimeout(timeoutId);
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`서버 오류: ${r.status}${text ? ` - ${text.slice(0, 100)}` : ""}`);
        }
        const data = await r.json();
        if (!Array.isArray(data)) throw new Error("응답 형식 오류");
        return data;
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === "AbortError") throw new Error("요청 시간 초과 (15초)");
        throw e;
      }
    },
    staleTime: 3 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000), // 1s, 2s, 4s 지수 백오프
  });

  const assemblyDistricts = useMemo(() => {
    const map = new Map<string, { code: string; sd: string; dist: string; candidates: any[] }>();
    for (const c of assemblyRaw) {
      const key = `${c.sdName}_${c.districtName}`;
      if (!map.has(key)) {
        map.set(key, { code: key, sd: c.sdName, dist: c.districtName, candidates: [] });
      }
      map.get(key)!.candidates.push(c);
    }
    return Array.from(map.values()).sort((a, b) => a.sd.localeCompare(b.sd) || a.dist.localeCompare(b.dist));
  }, [assemblyRaw]);

  const [selectedRegions, setSelectedRegions] = useState<{ code: string; name: string; level: string }[]>(() => {
    if (user?.favoriteRegions && Array.isArray(user.favoriteRegions) && user.favoriteRegions.length > 0) {
      return user.favoriteRegions;
    }
    const stored = localStorage.getItem("userRegions");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState("");

  const handleStartSelect = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setStep("select");
  };

  const handleSelect = (regionCode: string, regionShort: string, level: string) => {
    const exists = selectedRegions.find((r) => r.code === regionCode);
    if (exists) {
      setSelectedRegions((prev) => prev.filter((r) => r.code !== regionCode));
      return;
    }
    const isAssembly = level === "assembly";
    const sameLevel = selectedRegions.filter((r) => (r.level === "assembly") === isAssembly);
    if (sameLevel.length >= 3) {
      toast({
        title: isAssembly
          ? "보궐선거 지역은 최대 3개까지 선택 가능합니다"
          : "지방선거 지역은 최대 3개까지 선택 가능합니다",
        variant: "destructive",
      });
      return;
    }
    setSelectedRegions((prev) => [...prev, { code: regionCode, name: regionShort, level }]);
  };

  const handleComplete = async () => {
    if (selectedRegions.length === 0) return;
    const isFirstTime = !localStorage.getItem("hasSeenTour");
    localStorage.setItem("userRegions", JSON.stringify(selectedRegions));
    if (user) {
      try {
        await apiRequest("PATCH", "/api/auth/favorite-regions", { regions: selectedRegions });
        await mutate();
        toast({ title: "관심 지역이 저장되었습니다" });
      } catch (err) {
        console.error("관심지역 저장 실패", err);
        toast({ title: "저장에 실패했습니다", variant: "destructive" });
      }
    }
    setLocation(isFirstTime ? "/intro-tour" : "/");
  };

  const container: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.03, delayChildren: 0.1 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
  };

  return (
    <AnimatePresence mode="wait">
      {step === "welcome" ? (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
        >
          <WelcomeScreen onStart={handleStartSelect} />
        </motion.div>
      ) : (
        <motion.div
          key="select"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-[#0F172A] flex flex-col w-full"
        >
          {/* ─── Header ─── */}
          <div className="w-full px-6 pb-6 max-w-[760px] mx-auto pt-[calc(1rem+env(safe-area-inset-top,0px))]">
            {/* Logo + D-day */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setLocation("/")}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-[0.98] transition-all shadow-sm border border-white/10"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span className="text-white font-black text-lg tracking-tight">투표에 이유를 만들자</span>
              </div>
              <span className="text-[12px] font-bold text-white bg-white/10 px-3 py-1 rounded-full shrink-0 border border-white/10">
                D-{daysLeft}
              </span>
            </div>

            <h1 className="text-[28px] font-black text-white leading-[1.25] tracking-tight mb-2">
              어느 선거가<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">궁금하세요?</span>
            </h1>
            <p className="text-[13px] text-gray-400 leading-relaxed mb-4">
              최대 3개 지역을 선택하면 맞춤 후보 정보를 바로 볼 수 있어요.
            </p>

            {/* 선거 탭 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setElectionTab("local")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-black transition-all ${
                  electionTab === "local"
                    ? "bg-white text-[#0F172A] shadow-md shadow-white/25"
                    : "bg-[#1E293B] text-gray-400 border border-white/10"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                지방선거
              </button>
              <button
                onClick={() => setElectionTab("assembly")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-black transition-all ${
                  electionTab === "assembly"
                    ? "bg-white text-[#0F172A] shadow-md shadow-white/25"
                    : "bg-[#1E293B] text-gray-400 border border-white/10"
                }`}
              >
                <Landmark className="w-4 h-4" />
                보궐선거
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-8 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-white transition-colors" />
              <input
                type="text"
                placeholder={electionTab === "local" ? "지역명 검색 (서울, 부산, 경기...)" : "선거구 검색 (계양구, 안산시...)"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-11 pr-4 bg-[#1E293B] border border-white/10 rounded-2xl focus:border-white focus:outline-none transition-all text-[16px] font-medium text-white placeholder:text-gray-500 shadow-sm"
              />
            </div>
            <div className="text-[11px] font-bold text-gray-400 px-1 mt-2">
              선택{" "}
              <span className="text-white">
                {selectedRegions.filter((r) => (r.level === "assembly") === (electionTab === "assembly")).length}
              </span>{" "}
              / 3
            </div>
          </div>

          {/* ─── Region Cards ─── */}
          <div className="w-full max-w-[760px] mx-auto px-4 pb-36">
            <motion.div
              key={electionTab}
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {electionTab === "local" ? (
                // ── 지방선거 카드 ──
                MAYOR_RACES.filter(
                  (r) => r.region.includes(searchQuery) || r.regionShort.includes(searchQuery),
                ).map((race) => {
                  const [candA, candB, candC] = race.candidates;
                  const isSelected = selectedRegions.some((r) => r.code === race.regionCode);
                  const selectedIndex = selectedRegions.findIndex((r) => r.code === race.regionCode);

                  return (
                    <motion.button
                      key={race.regionCode}
                      variants={item}
                      onClick={() => handleSelect(race.regionCode, race.regionShort, race.level || "metropolitan")}
                      className={`w-full text-left rounded-[20px] p-4 transition-all duration-200 border-2 focus:outline-none active:scale-[0.97] shadow-sm ${
                        isSelected
                          ? "border-white bg-white shadow-md shadow-white/10 scale-[1.01]"
                          : "bg-[#1E293B] border-white/5 hover:border-white/20 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <MapPin className={`w-3 h-3 ${isSelected ? "text-[#0F172A]/60" : "text-gray-400"}`} />
                            <span className={`text-[10px] font-bold tracking-tight ${isSelected ? "text-[#0F172A]/60" : "text-gray-400"}`}>{race.positionLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <h3 className={`text-[20px] font-black leading-none ${isSelected ? "text-[#0F172A]" : "text-white"}`}>{race.regionShort}</h3>
                            {isSelected && (
                              <span className="inline-flex w-5 h-5 rounded-full bg-[#0F172A] text-white text-[10px] items-center justify-center font-black shrink-0">
                                {selectedIndex + 1}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${isSelected ? "bg-[#0F172A] border-[#0F172A]" : "border-white/10 bg-[#1E293B]"}`}>
                          {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {([candA, candB, candC] as typeof candA[]).filter(Boolean).map((cand, idx) => (
                          <div key={idx} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: isSelected ? getPartyBg(cand.party) : '#0F172A' }}>
                            <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border-[1.5px]" style={{ borderColor: `${getPartyText(cand.party)}66` }}>
                              <PoliticianPhoto name={cand.name} photo={cand.photo} context={cand.party} avatarClassName="w-full h-full flex items-center justify-center text-white text-[8px] font-black" />
                            </div>
                            <span className={`text-[12px] font-black truncate flex-1 ${isSelected ? "text-gray-900" : "text-white"}`}>{cand.name}</span>
                            <span className="text-[10px] font-bold shrink-0" style={{ color: getPartyText(cand.party) }}>{abbrevParty(cand.party)}</span>
                          </div>
                        ))}
                      </div>
                    </motion.button>
                  );
                })
              ) : (
                // ── 보궐선거 카드 ──
                assemblyLoading ? (
                  <div className="col-span-2 space-y-3 py-4">
                    <p className="text-center text-gray-500 text-[13px] mb-3">보궐선거 후보 정보를 불러오는 중...</p>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-[110px] rounded-[20px] bg-[#1E293B] animate-pulse border border-white/5" />
                    ))}
                  </div>
                ) : assemblyError ? (
                  <div className="col-span-2 py-12 text-center flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white text-[14px] font-bold mb-1">보궐선거 정보를 불러오지 못했습니다</p>
                      <p className="text-gray-400 text-[12px]">
                        {(assemblyErrorDetail as any)?.message || "서버에 연결할 수 없습니다"}
                      </p>
                    </div>
                    <button
                      onClick={() => assemblyRefetch()}
                      className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white text-[13px] font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/25"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : assemblyDistricts.length === 0 ? (
                  <div className="col-span-2 py-16 text-center text-gray-500 text-[13px]">
                    보궐선거 후보 정보가 없습니다.
                  </div>
                ) : (
                  assemblyDistricts.filter(
                    (d) => d.sd.includes(searchQuery) || d.dist.includes(searchQuery),
                  ).map((d) => {
                    const isSelected = selectedRegions.some((r) => r.code === d.code);
                    const selectedIndex = selectedRegions.findIndex((r) => r.code === d.code);
                    
                    return (
                      <motion.button
                        key={d.code}
                        variants={item}
                        onClick={() => handleSelect(d.code, d.dist, "assembly")}
                        className={`w-full text-left rounded-[20px] p-4 transition-all duration-200 border-2 focus:outline-none active:scale-[0.97] shadow-sm ${
                          isSelected
                            ? "border-white bg-white shadow-md shadow-white/10 scale-[1.01]"
                            : "bg-[#1E293B] border-white/5 hover:border-white/20 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Landmark className={`w-3 h-3 ${isSelected ? "text-[#0F172A]/50" : "text-gray-400"}`} />
                              <span className={`text-[10px] font-bold tracking-tight ${isSelected ? "text-[#0F172A]/60" : "text-gray-400"}`}>{d.sd.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, "")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <h3 className={`text-[15px] font-black tracking-tight truncate max-w-[120px] ${isSelected ? "text-[#0F172A]" : "text-white"}`}>{d.dist}</h3>
                              {isSelected && (
                                <span className="inline-flex w-5 h-5 rounded-full bg-[#0F172A] text-white text-[10px] items-center justify-center font-black shrink-0">
                                  {selectedIndex + 1}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${isSelected ? "bg-[#0F172A] border-[#0F172A]" : "border-white/10 bg-[#1E293B]"}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {d.candidates?.slice(0, 3).map((cand: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: isSelected ? getPartyBg(cand.party) : '#0F172A' }}>
                              <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border-[1.5px]" style={{ borderColor: `${getPartyText(cand.party)}66` }}>
                                <PoliticianPhoto name={cand.name} photo={cand.photo} context={cand.party} avatarClassName="w-full h-full flex items-center justify-center text-white text-[8px] font-black" />
                              </div>
                              <span className={`text-[12px] font-black truncate flex-1 ${isSelected ? "text-gray-900" : "text-white"}`}>{cand.name}</span>
                              <span className="text-[10px] font-bold shrink-0" style={{ color: getPartyText(cand.party) }}>{abbrevParty(cand.party)}</span>
                            </div>
                          ))}
                        </div>
                      </motion.button>
                    );
                  })
                )
              )}
            </motion.div>
          </div>

          {/* ─── Bottom CTA ─── */}
          <AnimatePresence>
            {selectedRegions.length > 0 && (
              <motion.div
                initial={{ y: 140, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 140, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-[#F8F9FA]/90 backdrop-blur-xl border-t border-gray-200/60 px-6 py-5 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.08)]"
              >
                <div className="max-w-[760px] mx-auto">
                  {/* Removable chips */}
                  <div className="flex flex-col gap-2.5 mb-3">
                    {/* 지방선거 선택 항목 */}
                    {selectedRegions.filter(r => r.level !== "assembly").length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-gray-400 shrink-0 w-12">지방선거</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedRegions.filter(r => r.level !== "assembly").map((r, i) => (
                            <motion.button
                              key={r.code}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              onClick={() => setSelectedRegions((prev) => prev.filter((s) => s.code !== r.code))}
                              className="flex items-center gap-1.5 bg-[#0F172A]/10 hover:bg-[#0F172A]/20 text-[#0F172A] text-[13px] font-bold px-3 py-1.5 rounded-full transition-colors"
                            >
                              <span className="w-4 h-4 bg-[#0F172A] text-white rounded-full text-[9px] flex items-center justify-center font-black shrink-0">{i + 1}</span>
                              <MapPin className="w-3 h-3 opacity-60 shrink-0" />
                              <span className="truncate max-w-[80px]">{r.name}</span>
                              <X className="w-3 h-3 opacity-50" />
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 보궐선거 선택 항목 */}
                    {selectedRegions.filter(r => r.level === "assembly").length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-gray-400 shrink-0 w-12">보궐선거</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedRegions.filter(r => r.level === "assembly").map((r, i) => (
                            <motion.button
                              key={r.code}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              onClick={() => setSelectedRegions((prev) => prev.filter((s) => s.code !== r.code))}
                              className="flex items-center gap-1.5 bg-[#0F172A]/10 hover:bg-[#0F172A]/20 text-[#0F172A] text-[13px] font-bold px-3 py-1.5 rounded-full transition-colors"
                            >
                              <span className="w-4 h-4 bg-[#0F172A] text-white rounded-full text-[9px] flex items-center justify-center font-black shrink-0">{i + 1}</span>
                              <Landmark className="w-3 h-3 opacity-60 shrink-0" />
                              <span className="truncate max-w-[80px]">{r.name}</span>
                              <X className="w-3 h-3 opacity-50" />
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleComplete}
                    className="w-full h-14 bg-[#6D28D9] hover:bg-[#5b21b6] active:scale-[0.98] text-white rounded-[18px] text-[16px] font-black shadow-xl shadow-[#6D28D9]/25 flex items-center justify-center gap-2 transition-all duration-150"
                  >
                    {selectedRegions.length === 1
                      ? `${selectedRegions[0].name} 선택 완료`
                      : `${selectedRegions.length}개 지역 선택 완료`}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Bottom hint — nothing selected ─── */}
          {!selectedRegions.length && (
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-6 py-4">
              <div className="max-w-[760px] mx-auto flex items-center justify-between">
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  관심 지역을 선택하면<br />맞춤 후보 정보를 바로 볼 수 있어요
                </p>
                <button
                  onClick={() => { localStorage.setItem("hasSeenTour", "true"); setLocation("/"); }}
                  className="text-[13px] font-bold text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-4"
                >
                  건너뛰기
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
