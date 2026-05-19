import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ChevronRight, MapPin, Search, Map, BarChart2, Newspaper, MessageCircle, X } from "lucide-react";
import { MAYOR_RACES } from "@/lib/mayor-candidates";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PARTY_COLOR: Record<string, string> = {
  "더불어민주당": "#3A6BFF",
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
    "더불어민주당": "민주당",
    "국민의힘": "국민의힘",
    "조국혁신당": "조국혁신당",
    "개혁신당": "개혁신당",
  };
  return MAP[party] ?? party.slice(0, 5);
}

const FEATURES = [
  { icon: Map,           color: "#6D28D9", title: "지역별 후보자 비교",    desc: "내 지역 후보들의 공약·이력·뉴스를 한눈에" },
  { icon: BarChart2,     color: "#2563EB", title: "국회의원 표결 추적",    desc: "어떤 법안에 어떻게 투표했는지 확인" },
  { icon: Newspaper,     color: "#059669", title: "AI 정치 뉴스 분석",     desc: "12개 언론사 뉴스를 AI가 핵심만 전달" },
  { icon: MessageCircle, color: "#EA580C", title: "유권자 커뮤니티",       desc: "이웃들과 지역 현안과 정치를 이야기" },
];

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-06-03").getTime() - Date.now()) / 86400000));

  return (
    <div className="min-h-screen flex flex-col w-full">
      {/* ─── Hero gradient ─── */}
      <div
        className="w-full flex-shrink-0 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #1e0040 0%, #4c1d95 45%, #6d28d9 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(167,139,250,0.18) 0%, transparent 70%)" }}
        />
        {/* Decorative blobs */}
        <div className="absolute top-8 right-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-20 right-16 w-14 h-14 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute bottom-16 left-4 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative w-full px-6 pt-16 pb-14 max-w-[680px] mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-[12px] bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/10">
              <span className="text-white font-black text-sm tracking-tight">이유</span>
            </div>
            <span className="text-white font-black text-lg tracking-tight">이유있는 투표</span>
          </div>

          {/* D-day badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white/90 text-[12px] font-bold px-3 py-1.5 rounded-full mb-6 border border-white/10"
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
            <p className="text-[15px] text-white/65 leading-relaxed">
              후보자 정보부터 국회의원 활동까지<br />투표에 필요한 모든 정보를 한 곳에서
            </p>
          </motion.div>
        </div>

        <div className="w-full overflow-hidden" style={{ marginBottom: "-2px" }}>
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0 48L1440 48L1440 16C1100 52 420 -4 0 28L0 48Z" fill="#F8F9FA" />
          </svg>
        </div>
      </div>

      {/* ─── Features ─── */}
      <div className="flex-1 bg-[#F8F9FA] w-full px-5 pt-6 pb-36 max-w-[680px] mx-auto self-center">
        <p className="text-[11px] font-black text-[#6D28D9] uppercase tracking-widest mb-4 px-1">
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
                className="flex items-center gap-4 bg-white rounded-[18px] p-4 shadow-sm border border-gray-100/80"
              >
                <div
                  className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0"
                  style={{ background: `${f.color}14` }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-black text-gray-900 leading-tight">{f.title}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5 leading-snug">{f.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-200 shrink-0" />
              </motion.div>
            );
          })}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.68 }}
          className="flex items-center mt-6 bg-white rounded-[18px] border border-gray-100 shadow-sm overflow-hidden"
        >
          {[
            { num: "17개", label: "광역시도" },
            { num: "300+", label: "국회의원" },
            { num: "12개", label: "언론사 뉴스" },
          ].map((s, i) => (
            <div key={s.label} className={`flex-1 py-4 text-center ${i < 2 ? "border-r border-gray-100" : ""}`}>
              <div className="text-[18px] font-black text-[#6D28D9]">{s.num}</div>
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#F8F9FA]/90 backdrop-blur-xl border-t border-gray-200/60 px-5 py-5"
      >
        <div className="max-w-[680px] mx-auto">
          <button
            onClick={onStart}
            className="w-full h-14 bg-[#6D28D9] hover:bg-[#5b21b6] active:scale-[0.98] text-white rounded-[16px] text-[16px] font-black shadow-xl shadow-[#6D28D9]/25 flex items-center justify-center gap-2 transition-all duration-150"
          >
            지역 선택하고 시작하기
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-center text-[11px] text-gray-400 mt-2.5 font-medium">무료 · 광고 없음 · 1분이면 완료</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function CitySelect() {
  const [, setLocation] = useLocation();
  const { user, mutate } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<"welcome" | "select">(() => {
    if (
      typeof window !== "undefined" &&
      (localStorage.getItem("hasSeenOnboarding") || localStorage.getItem("userRegions"))
    ) {
      return "select";
    }
    return "welcome";
  });

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
    if (selectedRegions.length >= 3) {
      toast({ title: "지역은 최대 3개까지만 선택 가능합니다", variant: "destructive" });
      return;
    }
    setSelectedRegions((prev) => [...prev, { code: regionCode, name: regionShort, level }]);
  };

  const handleComplete = async () => {
    if (selectedRegions.length === 0) return;
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
    setLocation("/");
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
          className="min-h-screen bg-[#F8F9FA] flex flex-col w-full"
        >
          {/* ─── Header ─── */}
          <div className="w-full px-6 pt-14 pb-6 max-w-[760px] mx-auto">
            {/* Logo + D-day */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[11px] bg-[#6D28D9] flex items-center justify-center shadow-md shrink-0">
                  <span className="text-white font-black text-xs tracking-tight">이유</span>
                </div>
                <span className="text-[#6D28D9] font-black text-lg tracking-tight">이유있는 투표</span>
              </div>
              <span className="text-[12px] font-bold text-[#6D28D9] bg-[#6D28D9]/10 px-3 py-1 rounded-full shrink-0">
                D-{daysLeft}
              </span>
            </div>

            <h1 className="text-[28px] font-black text-gray-900 leading-[1.25] tracking-tight mb-2">
              어느 지역<br />
              <span className="text-[#6D28D9]">지방 선거</span>가 궁금하세요?
            </h1>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-5">
              광역단체장 후보를 최대 3개 지역까지 선택할 수 있어요.<br />
              선택 순서가 홈 화면 우선순위가 됩니다.
            </p>

            {/* Search */}
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="지역명 검색 (서울, 부산, 경기...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-11 pr-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-[#6D28D9] focus:outline-none transition-all text-[14px] font-medium placeholder:text-gray-400 shadow-sm"
              />
            </div>
            <div className="text-[11px] font-bold text-gray-400 px-1 mt-2">
              선택 <span className="text-[#6D28D9]">{selectedRegions.length}</span> / 3
            </div>
          </div>

          {/* ─── Region Cards ─── */}
          <div className="w-full max-w-[760px] mx-auto px-4 pb-36">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {MAYOR_RACES.filter(
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
                        ? "border-[#6D28D9] bg-white shadow-md shadow-[#6D28D9]/10 scale-[1.01]"
                        : "bg-white border-gray-100 hover:border-[#6D28D9]/40 hover:shadow-md"
                    }`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <MapPin className="w-3 h-3 text-[#6D28D9]/50" />
                          <span className="text-[10px] font-bold text-gray-400 tracking-tight">
                            {race.positionLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[20px] font-black text-gray-900 leading-none">{race.regionShort}</h3>
                          {isSelected && (
                            <span className="inline-flex w-5 h-5 rounded-full bg-[#6D28D9] text-white text-[10px] items-center justify-center font-black shrink-0">
                              {selectedIndex + 1}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Check circle */}
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                          isSelected ? "bg-[#6D28D9] border-[#6D28D9]" : "border-gray-200 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Candidates — one row per candidate */}
                    <div className="space-y-1.5">
                      {([candA, candB, candC] as typeof candA[]).filter(Boolean).map((cand, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5"
                          style={{ background: getPartyBg(cand.party) }}
                        >
                          <div
                            className="w-5 h-5 rounded-full overflow-hidden shrink-0 border-[1.5px]"
                            style={{ borderColor: `${getPartyText(cand.party)}66` }}
                          >
                            <PoliticianPhoto
                              name={cand.name}
                              photo={cand.photo}
                              context={cand.party}
                              avatarClassName="w-full h-full flex items-center justify-center text-white text-[8px] font-black"
                            />
                          </div>
                          <span className="text-[12px] font-black text-gray-900 truncate flex-1">{cand.name}</span>
                          <span className="text-[10px] font-bold shrink-0" style={{ color: getPartyText(cand.party) }}>
                            {abbrevParty(cand.party)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          {/* ─── Bottom CTA — regions selected ─── */}
          <AnimatePresence>
            {selectedRegions.length > 0 && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-xl border-t border-gray-100 px-5 pt-4 pb-5 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="max-w-[760px] mx-auto">
                  {/* Removable chips */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedRegions.map((r, i) => (
                      <motion.button
                        key={r.code}
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        onClick={() => setSelectedRegions((prev) => prev.filter((s) => s.code !== r.code))}
                        className="flex items-center gap-1.5 bg-[#6D28D9]/10 hover:bg-[#6D28D9]/20 text-[#6D28D9] text-[13px] font-bold px-3 py-1.5 rounded-full transition-colors"
                      >
                        <span className="w-4 h-4 bg-[#6D28D9] text-white rounded-full text-[9px] flex items-center justify-center font-black shrink-0">
                          {i + 1}
                        </span>
                        {r.name}
                        <X className="w-3 h-3 opacity-50" />
                      </motion.button>
                    ))}
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
                  onClick={() => setLocation("/")}
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
