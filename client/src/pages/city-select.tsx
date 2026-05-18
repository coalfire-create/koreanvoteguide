import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, MapPin, Search, Map, BarChart2, Newspaper, MessageCircle } from "lucide-react";
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
  return c ? `${c}22` : "#f3f4f6";
}

function getPartyText(party: string) {
  return PARTY_COLOR[party] ?? "#6b7280";
}

const FEATURES = [
  {
    icon: Map,
    color: "#6D28D9",
    title: "지역별 후보자 비교",
    desc: "내 지역 후보들의 공약·이력·뉴스를 한눈에 비교하세요",
  },
  {
    icon: BarChart2,
    color: "#2563EB",
    title: "국회의원 표결 추적",
    desc: "국회의원이 어떤 법안에 어떻게 투표했는지 확인하세요",
  },
  {
    icon: Newspaper,
    color: "#059669",
    title: "AI 정치 뉴스 분석",
    desc: "AI가 12개 언론사 뉴스를 분석해 핵심만 전달해요",
  },
  {
    icon: MessageCircle,
    color: "#EA580C",
    title: "유권자 커뮤니티",
    desc: "이웃들과 함께 지역 현안과 정치를 이야기해요",
  },
];

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-06-03").getTime() - Date.now()) / 86400000));

  return (
    <div className="min-h-screen flex flex-col w-full">
      {/* ─── Hero gradient ─── */}
      <div
        className="w-full flex-shrink-0 relative"
        style={{ background: "linear-gradient(145deg, #1e0040 0%, #4c1d95 45%, #6d28d9 100%)" }}
      >
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(167,139,250,0.18) 0%, transparent 70%)" }}
        />

        <div className="relative w-full px-6 pt-16 pb-14 max-w-[680px] mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-[12px] bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
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
            <h1 className="text-[42px] font-black text-white leading-[1.1] tracking-tight mb-4">
              이유있게<br />투표하세요
            </h1>
            <p className="text-[15px] text-white/65 leading-relaxed">
              후보자 정보부터 국회의원 활동까지<br />투표에 필요한 모든 정보를 한 곳에서
            </p>
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="w-full overflow-hidden" style={{ marginBottom: "-2px" }}>
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0 48L1440 48L1440 16C1100 52 420 -4 0 28L0 48Z" fill="#F8F9FA" />
          </svg>
        </div>
      </div>

      {/* ─── Feature cards ─── */}
      <div className="flex-1 bg-[#F8F9FA] w-full px-5 pt-6 pb-32 max-w-[680px] mx-auto self-center">
        <p className="text-[11px] font-black text-[#6D28D9] uppercase tracking-widest mb-5 px-1">
          이런 걸 도와드려요
        </p>

        <div className="space-y-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4 bg-white rounded-[18px] p-4 shadow-sm border border-gray-100/80"
              >
                <div
                  className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0"
                  style={{ background: `${feature.color}14` }}
                >
                  <Icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-black text-gray-900 leading-tight">{feature.title}</div>
                  <div className="text-[12px] text-gray-500 mt-1 leading-snug">{feature.desc}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Mini stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center justify-center gap-6 mt-7 px-2"
        >
          {[
            { num: "17개", label: "광역시도" },
            { num: "300+", label: "국회의원" },
            { num: "12개", label: "언론사 뉴스" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-[18px] font-black text-[#6D28D9]">{s.num}</div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ─── Fixed bottom CTA ─── */}
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
      toast({
        title: "지역은 최대 3개까지만 선택 가능합니다",
        variant: "destructive",
      });
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

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.03, delayChildren: 0.15 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 240, damping: 22 } },
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
          {/* Header */}
          <div className="w-full px-6 pt-14 pb-8 max-w-[760px] mx-auto">
            {/* Back button (only if came from welcome) */}

            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-[14px] bg-[#6D28D9] flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-sm tracking-tight">이유</span>
              </div>
              <span className="text-[#6D28D9] font-black text-xl tracking-tight">이유</span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[13px] font-bold text-[#6D28D9] bg-[#6D28D9]/10 px-3 py-1 rounded-full">
                2026 지방선거 D-{Math.max(0, Math.ceil((new Date("2026-06-03").getTime() - Date.now()) / 86400000))}
              </span>
            </div>

            <h1 className="text-[32px] font-black text-gray-900 leading-[1.2] tracking-tight mb-3">
              어느 지역<br />
              <span className="text-[#6D28D9]">지방 선거</span>가 궁금하세요?
            </h1>
            <p className="text-[14px] text-gray-500 leading-relaxed mb-6">
              관심 있는 광역시장 및 구청장 후보들을<br />최대 3개까지 선택할 수 있어요.
            </p>

            {/* Search Bar */}
            <div className="w-full">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="지역명을 검색하세요 (서울, 부산, 경기...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-[#6D28D9] focus:outline-none transition-all text-[15px] font-medium placeholder:text-gray-400 shadow-sm"
                />
              </div>
              <div className="flex gap-4 mt-3 px-1">
                <div className="text-[11px] font-bold text-gray-400">
                  선택된 지역 <span className="text-[#6D28D9]">{selectedRegions.length}</span>/3
                </div>
              </div>
            </div>
          </div>

          {/* Region Cards Grid */}
          <div className="w-full max-w-[760px] mx-auto px-4 pb-32">
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
                    className={`w-full text-left rounded-[20px] p-4 transition-all duration-200 border-2 shadow-sm focus:outline-none active:scale-[0.97] ${
                      isSelected
                        ? "border-[#6D28D9] bg-[#6D28D9]/5 shadow-lg shadow-[#6D28D9]/10 scale-[1.02]"
                        : "bg-white border-gray-100 hover:border-[#6D28D9]/30 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#6D28D9]" />
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
                            {race.level === "metropolitan" ? "광역" : "기초"}
                          </span>
                          <span className="text-[11px] font-medium text-gray-400">|</span>
                          <span className="text-[11px] font-bold text-gray-500">{race.positionLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <h3 className="text-[18px] font-black text-gray-900">{race.regionShort}</h3>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#6D28D9] text-white text-[10px] flex items-center justify-center font-black">
                              {selectedIndex + 1}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 transition-colors ${isSelected ? "text-[#6D28D9]" : "text-gray-300"}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {candA && (
                          <div
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full flex-1 min-w-0"
                            style={{ background: getPartyBg(candA.party) }}
                          >
                            <div
                              className="w-4 h-4 rounded-full overflow-hidden shrink-0"
                              style={{ background: getPartyText(candA.party) }}
                            >
                              <PoliticianPhoto
                                name={candA.name}
                                photo={candA.photo}
                                context={candA.party}
                                avatarClassName="w-full h-full flex items-center justify-center text-white text-[9px] font-black"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-black text-gray-900 truncate">{candA.name}</div>
                            </div>
                          </div>
                        )}
                        {candB && (
                          <div
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full flex-1 min-w-0"
                            style={{ background: getPartyBg(candB.party) }}
                          >
                            <div
                              className="w-4 h-4 rounded-full overflow-hidden shrink-0"
                              style={{ background: getPartyText(candB.party) }}
                            >
                              <PoliticianPhoto
                                name={candB.name}
                                photo={candB.photo}
                                context={candB.party}
                                avatarClassName="w-full h-full flex items-center justify-center text-white text-[9px] font-black"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-black text-gray-900 truncate">{candB.name}</div>
                            </div>
                          </div>
                        )}
                        {candC && (
                          <div
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full flex-1 min-w-0"
                            style={{ background: getPartyBg(candC.party) }}
                          >
                            <div
                              className="w-4 h-4 rounded-full overflow-hidden shrink-0"
                              style={{ background: getPartyText(candC.party) }}
                            >
                              <PoliticianPhoto
                                name={candC.name}
                                photo={candC.photo}
                                context={candC.party}
                                avatarClassName="w-full h-full flex items-center justify-center text-white text-[9px] font-black"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-black text-gray-900 truncate">{candC.name}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          {/* Bottom CTA */}
          <AnimatePresence>
            {selectedRegions.length > 0 && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-6 py-5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
              >
                <div className="max-w-[760px] mx-auto flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-[12px] text-gray-400 font-bold mb-1">선택된 지역</div>
                    <div className="flex gap-2">
                      {selectedRegions.map((r) => (
                        <span
                          key={r.code}
                          className="text-[14px] font-black text-[#6D28D9] bg-[#6D28D9]/5 px-3 py-1 rounded-full"
                        >
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleComplete}
                    className="bg-[#6D28D9] text-white px-8 h-14 rounded-[20px] font-black text-[16px] shadow-lg shadow-[#6D28D9]/20 active:scale-[0.98] transition-all"
                  >
                    {selectedRegions.length}개 지역 선택 완료
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!selectedRegions.length && (
            <div className="fixed bottom-0 left-0 right-0 bg-[#F8F9FA]/90 backdrop-blur-xl border-t border-gray-200/60 px-6 py-4 text-center">
              <p className="text-[12px] text-gray-400">
                나중에 지역을 변경하려면{" "}
                <span className="text-[#6D28D9] font-bold">더보기 → 지역 설정</span>에서 바꿀 수 있어요
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
