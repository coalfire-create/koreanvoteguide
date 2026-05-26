import { motion } from "framer-motion";
import { Link } from "wouter";
import { ChevronLeft, Sparkles, Bell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DailyBriefing() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b px-4 h-14 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="icon" className="-ml-2 shrink-0">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-[17px] font-black absolute left-1/2 -translate-x-1/2">
          AI 브리핑
        </h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-5 pt-6 flex flex-col gap-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              오늘의 요약
            </div>
            <span className="text-sm font-medium text-slate-500">2026.05.26</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 leading-tight">
            어제 서울시 지역구에서는<br />어떤 일이 있었을까요?
          </h2>
        </motion.div>

        {/* AI Briefing Cards */}
        <div className="flex flex-col gap-4 mt-2">
          
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl overflow-hidden">
                👨🏻‍💼
              </div>
              <div>
                <h3 className="font-bold text-slate-900">김민준 의원 (마포구)</h3>
                <p className="text-xs text-slate-500">어제 오후 2:30</p>
              </div>
            </div>
            <p className="text-[15px] leading-relaxed text-slate-700">
              청년 주거 문제 해결을 위한 <span className="font-bold bg-amber-100 px-1 rounded">청년주택특별법 개정안</span>을 대표 발의했습니다. 기존보다 임대주택 공급을 20% 확대하는 내용이 포함되었습니다.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl overflow-hidden">
                🏛️
              </div>
              <div>
                <h3 className="font-bold text-slate-900">지역 현안 뉴스</h3>
                <p className="text-xs text-slate-500">관심 지역: 서울</p>
              </div>
            </div>
            <p className="text-[15px] leading-relaxed text-slate-700">
              서울시가 내년부터 대중교통 무제한 이용권인 <span className="font-bold bg-indigo-100 px-1 rounded">기후동행카드</span> 혜택을 경기도 일부 지역까지 확대 적용하기로 경기도와 잠정 합의했습니다.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-slate-100 rounded-2xl p-5 flex flex-col items-center text-center gap-3"
        >
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-500">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 mb-1">내일 브리핑도 받아볼까요?</h3>
            <p className="text-sm text-slate-500">매일 아침 8시, 관심 지역 뉴스를 배달해드려요.</p>
          </div>
          <Button className="w-full mt-2 font-bold rounded-xl h-12 bg-slate-900 hover:bg-slate-800">
            알림 켜기
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
