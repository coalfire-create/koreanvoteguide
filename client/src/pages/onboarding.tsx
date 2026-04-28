import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { MapPin, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

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
  
  // legacy userRegion 처리 포함 (단일에서 배열로 마이그레이션)
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(() => {
    // 1. 기존 유저 DB 선호지역
    if (user && user.favoriteRegions && Array.isArray(user.favoriteRegions) && user.favoriteRegions.length > 0) {
      return user.favoriteRegions;
    }
    // 2. 새로운 로컬스토리지 다중지역
    const storedMulti = localStorage.getItem("userRegions");
    if (storedMulti) {
      try {
        const parsed = JSON.parse(storedMulti);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    // 3. 기존 로컬스토리지 단일지역
    const storedSingle = localStorage.getItem("userRegion");
    if (storedSingle) {
      try {
        const parsed = JSON.parse(storedSingle);
        if (parsed?.code) return [parsed];
      } catch (e) {}
    }
    return [];
  });

  // 초기 렌더링 검사 제거: 명시적으로 편집하러 온 사용자일 수 있음.
  // App.tsx에서 첫 진입 시 권한을 제어합니다.

  const handleToggleRegion = (region: Region) => {
    setSelectedRegions((prev) => {
      const exists = prev.find((r) => r.code === region.code);
      if (exists) {
        return prev.filter((r) => r.code !== region.code);
      } else {
        return [...prev, region];
      }
    });
  };

  const handleComplete = async () => {
    if (selectedRegions.length === 0) return;
    
    // 로컬스토리지 저장
    localStorage.setItem("userRegions", JSON.stringify(selectedRegions));
    
    // 로그인 상태면 DB 동기화
    if (user) {
      try {
        await apiRequest("PATCH", "/api/auth/favorite-regions", { regions: selectedRegions });
        await mutate(); // auth state 업데이트
      } catch (err) {
        console.error("관심지역 저장 실패", err);
      }
    }
    
    setLocation("/");
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.2 }
    }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.9 },
    show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200, damping: 20 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col p-6 items-center flex-1 w-full max-w-[430px] mx-auto relative pb-28">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full text-center mt-12 mb-8"
      >
        <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200">
          <MapPin className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
          투표소 가는 길
        </h1>
        <p className="text-gray-500 font-medium whitespace-pre-wrap">당신의 관심 지역을 선택하세요\n(여러 개 선택 시 순위가 지정됩니다)</p>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="w-full grid grid-cols-3 gap-3 flex-1"
      >
        {REGIONS.map((region) => {
          const selectedIndex = selectedRegions.findIndex((r) => r.code === region.code);
          const isSelected = selectedIndex !== -1;
          
          return (
            <motion.div key={region.code} variants={item}>
              <button
                onClick={() => handleToggleRegion(region)}
                className={`w-full p-4 h-auto flex flex-col items-center justify-center gap-2 rounded-xl transition-all relative shadow-sm border-2 ${
                  isSelected 
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md" 
                    : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200 text-gray-700"
                }`}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm border-2 border-white">
                    {selectedIndex + 1}
                  </div>
                )}
                <span className="text-[17px] font-bold">{region.name}</span>
              </button>
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {selectedRegions.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-indigo-100 z-50 flex items-center justify-center shadow-[0_-5px_20px_rgba(0,0,0,0.05)] max-w-[430px] mx-auto"
          >
            <Button
              onClick={handleComplete}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-xl text-lg font-bold shadow-lg flex items-center justify-center gap-2"
            >
              선택 완료 <ChevronRight className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
