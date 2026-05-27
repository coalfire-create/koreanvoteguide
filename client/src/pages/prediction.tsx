import { Link } from "wouter";
import { ChevronLeft, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Prediction() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 flex flex-col">
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
        <div className="w-10" />
      </header>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4 pt-20 flex flex-col items-center gap-5 text-center">
        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center">
          <Clock className="w-10 h-10 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 mb-2">준비 중입니다</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            정치 예측 마켓 기능은 현재 개발 중입니다.<br />
            빠른 시일 내에 오픈할 예정입니다.
          </p>
        </div>
        <Link href="/">
          <Button variant="outline" className="rounded-xl font-bold">홈으로 돌아가기</Button>
        </Link>
      </main>
    </div>
  );
}
