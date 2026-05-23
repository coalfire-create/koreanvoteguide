import React, { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export const REGIONS = [
  { code: "11", name: "서울" },
  { code: "26", name: "부산" },
  { code: "27", name: "대구" },
  { code: "28", name: "인천" },
  { code: "29", name: "광주" },
  { code: "30", name: "대전" },
  { code: "31", name: "울산" },
  { code: "36", name: "세종" },
  { code: "41", name: "경기" },
  { code: "43", name: "충북" },
  { code: "44", name: "충남" },
  { code: "45", name: "전북" },
  { code: "46", name: "전남" },
  { code: "47", name: "경북" },
  { code: "48", name: "경남" },
  { code: "50", name: "제주" },
  { code: "51", name: "강원" },
];

type Region = { code: string; name: string };

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, mutate } = useAuth();
  const { toast } = useToast();

  React.useEffect(() => {
    setLocation("/city-select");
  }, [setLocation]);

  const [selectedRegions, setSelectedRegions] = useState<Region[]>(() => {
    if (user?.favoriteRegions && Array.isArray(user.favoriteRegions) && user.favoriteRegions.length > 0) {
      return user.favoriteRegions;
    }
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

  const handleToggleRegion = (region: Region) => {
    setSelectedRegions((prev) => {
      const exists = prev.find((r) => r.code === region.code);
      if (exists) {
        return prev.filter((r) => r.code !== region.code);
      }
      if (prev.length >= 3) {
        toast({
          title: "최대 3개까지만 선택 가능합니다",
          description: "관심 지역은 최대 3개까지만 설정할 수 있습니다.",
        });
        return prev;
      }
      return [...prev, region];
    });
  };

  const handleComplete = async () => {
    if (selectedRegions.length === 0) return;
    localStorage.setItem("userRegions", JSON.stringify(selectedRegions));
    if (user) {
      try {
        await apiRequest("PATCH", "/api/auth/favorite-regions", { regions: selectedRegions });
        await mutate();
      } catch (err) {
        console.error("관심지역 저장 실패", err);
      }
    }
    setLocation("/");
  };

  const container: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.3 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } },
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col w-full pb-32">

      {/* ─── Hero ─── */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full px-6 pt-16 pb-10 max-w-[680px] mx-auto"
      >
        {/* Logo mark */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-[14px] bg-[#6D28D9] flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-sm tracking-tight">이유</span>
          </div>
          <span className="text-[#6D28D9] font-black text-xl tracking-tight">이유</span>
        </div>

        {/* Headline */}
        <h1 className="text-[32px] sm:text-[36px] font-black text-gray-900 leading-[1.25] tracking-tight mb-4 break-keep">
          내 지역구를 선택하고<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">AI 공약 분석</span>을 확인하세요
        </h1>
        <p className="text-[15px] text-gray-600 leading-[1.7] font-medium break-keep">
          후보자들의 핵심 정책과 실현가능성을 AI가 중립적으로 비교해 드립니다.<br />
          2026 지방선거, 현명한 선택을 위한 가장 스마트한 가이드.
          <br />
          <span className="text-[13px] text-gray-400 mt-2 inline-block font-normal">관심 지역은 최대 3개까지 선택할 수 있습니다.</span>
        </p>
      </motion.div>

      {/* ─── Region Grid ─── */}
      <div className="w-full max-w-[680px] mx-auto px-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-3 sm:grid-cols-4 gap-3"
        >
          {REGIONS.map((region) => {
            const selectedIndex = selectedRegions.findIndex((r) => r.code === region.code);
            const isSelected = selectedIndex !== -1;

            return (
              <motion.div key={region.code} variants={item}>
                <button
                  onClick={() => handleToggleRegion(region)}
                  className={`relative w-full py-5 flex flex-col items-center justify-center rounded-[20px] transition-all duration-200 shadow-sm border-2 focus:outline-none ${
                    isSelected
                      ? "bg-[#6D28D9] border-[#6D28D9] text-white shadow-lg shadow-[#6D28D9]/20 scale-[1.03]"
                      : "bg-white border-gray-100 text-gray-700 hover:border-[#6D28D9]/30 hover:shadow-md active:scale-[0.97]"
                  }`}
                >
                  {/* Order badge */}
                  {isSelected && (
                    <div className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-white text-[#6D28D9] rounded-full flex items-center justify-center text-[11px] font-black shadow border border-[#6D28D9]/20">
                      {selectedIndex + 1}
                    </div>
                  )}
                  <span className="text-[15px] font-bold leading-none">{region.name}</span>
                </button>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* ─── Bottom CTA ─── */}
      <AnimatePresence>
        {selectedRegions.length > 0 && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#F8F9FA]/90 backdrop-blur-xl border-t border-gray-200/60 px-6 py-5"
          >
            <div className="max-w-[680px] mx-auto">
              {/* Selected chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedRegions.map((r, i) => (
                  <motion.span
                    key={r.code}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    className="flex items-center gap-1.5 bg-[#6D28D9]/10 text-[#6D28D9] text-[12px] font-bold px-3 py-1.5 rounded-full"
                  >
                    <span className="w-4 h-4 bg-[#6D28D9] text-white rounded-full text-[10px] flex items-center justify-center font-black">{i + 1}</span>
                    {r.name}
                  </motion.span>
                ))}
              </div>

              <button
                onClick={handleComplete}
                className="w-full h-14 bg-[#6D28D9] hover:bg-[#5210d4] active:scale-[0.98] text-white rounded-[16px] text-[16px] font-black shadow-xl shadow-[#6D28D9]/30 flex items-center justify-center gap-2 transition-all duration-150"
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
    </div>
  );
}
