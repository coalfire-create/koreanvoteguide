import { motion } from "framer-motion";
import { Link } from "wouter";
import { ChevronLeft, TrendingUp, Trophy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function Prediction() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b px-4 h-14 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="icon" className="-ml-2 shrink-0">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-[17px] font-black absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          정치 예측 마켓
        </h1>
        <div className="w-10 flex items-center justify-end">
          <div className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
            1,200 P
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4 pt-5 flex flex-col gap-6">
        
        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            예측 마켓은 출석체크로 모은 <strong>무료 포인트</strong>로만 참여할 수 있는 모의 게임입니다. 실제 돈이나 가상화폐가 오가지 않습니다.
          </p>
        </div>

        {/* Prediction Cards */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-black text-slate-900 px-1">🔥 지금 뜨거운 예측</h2>
          
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  법안 통과
                </span>
                <span className="text-xs font-medium text-slate-400">마감: D-3</span>
              </div>
              <h3 className="font-bold text-[16px] text-slate-900 leading-snug mb-4">
                제22대 국회 '저출생 대응 패키지 법안',<br />이번 달 본회의를 통과할까요?
              </h3>
              
              <div className="flex flex-col gap-3">
                <button className="w-full relative h-11 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 rounded-xl flex items-center justify-between px-4 transition-all">
                  <div className="absolute left-0 top-0 bottom-0 bg-indigo-100/50 rounded-l-xl" style={{ width: '65%' }} />
                  <span className="font-bold text-sm text-slate-800 relative z-10">통과한다</span>
                  <div className="flex items-center gap-2 relative z-10">
                    <span className="text-xs font-bold text-slate-400">배당률 1.4x</span>
                    <span className="text-sm font-black text-indigo-600">65%</span>
                  </div>
                </button>
                <button className="w-full relative h-11 bg-slate-50 border border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 rounded-xl flex items-center justify-between px-4 transition-all">
                  <div className="absolute left-0 top-0 bottom-0 bg-rose-100/50 rounded-l-xl" style={{ width: '35%' }} />
                  <span className="font-bold text-sm text-slate-800 relative z-10">통과하지 못한다</span>
                  <div className="flex items-center gap-2 relative z-10">
                    <span className="text-xs font-bold text-slate-400">배당률 2.8x</span>
                    <span className="text-sm font-black text-rose-500">35%</span>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  지지율
                </span>
                <span className="text-xs font-medium text-slate-400">마감: D-1</span>
              </div>
              <h3 className="font-bold text-[16px] text-slate-900 leading-snug mb-4">
                다음 주 발표될 갤럽 정기 여론조사에서,<br />대통령 국정 지지율은 오를까요?
              </h3>
              
              <div className="flex flex-col gap-3">
                <button className="w-full relative h-11 bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl flex items-center justify-between px-4 transition-all">
                  <div className="absolute left-0 top-0 bottom-0 bg-emerald-100/50 rounded-l-xl" style={{ width: '42%' }} />
                  <span className="font-bold text-sm text-slate-800 relative z-10">오른다 (또는 유지)</span>
                  <div className="flex items-center gap-2 relative z-10">
                    <span className="text-xs font-bold text-slate-400">배당률 2.1x</span>
                    <span className="text-sm font-black text-emerald-600">42%</span>
                  </div>
                </button>
                <button className="w-full relative h-11 bg-slate-50 border border-slate-200 hover:border-slate-400 hover:bg-slate-100/50 rounded-xl flex items-center justify-between px-4 transition-all">
                  <div className="absolute left-0 top-0 bottom-0 bg-slate-200/50 rounded-l-xl" style={{ width: '58%' }} />
                  <span className="font-bold text-sm text-slate-800 relative z-10">내린다</span>
                  <div className="flex items-center gap-2 relative z-10">
                    <span className="text-xs font-bold text-slate-400">배당률 1.7x</span>
                    <span className="text-sm font-black text-slate-600">58%</span>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
