import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, AlertCircle, Quote, CheckCircle2, Lightbulb } from "lucide-react";

interface CandidatePledge {
  name: string;
  party: string;
  pledge: string;
  /** 후보 추가 컨텍스트 — DB 동기화 후 LLM 정확도 향상용 (선택) */
  job?: string;
  career1?: string;
}

interface TopicAnalysisViewProps {
  topic: string;
  candidates: CandidatePledge[];
  open: boolean;
  onClose: () => void;
}

interface TopicAnalysisResult {
  summary: string;
  candidateAnalyses: {
    name: string;
    party: string;
    strength: string;
    comparison: string;
  }[];
  voterTip: string;
}

function partyColor(party: string): string {
  if (party?.includes("더불어민주당")) return "#3A6BFF";
  if (party?.includes("국민의힘")) return "#FF3B3B";
  if (party?.includes("조국혁신당")) return "#1e3a8a";
  if (party?.includes("개혁신당")) return "#FF8C00";
  if (party?.includes("진보당")) return "#D60024";
  return "#6D28D9";
}

export default function TopicAnalysisView({
  topic,
  candidates,
  open,
  onClose,
}: TopicAnalysisViewProps) {
  const { data: result, isLoading, isError } = useQuery<TopicAnalysisResult>({
    queryKey: ["topic-analysis", topic, candidates.map(c => c.name).join(",")],
    queryFn: async () => {
      const res = await fetch("/api/candidates/analyze-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, candidates }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const json = await res.json();
      // 백엔드 폴백/부분 응답에도 화면이 깨지지 않도록 모든 키를 안전 기본값으로 보강
      return {
        summary: json?.summary ?? "AI 분석을 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.",
        candidateAnalyses: Array.isArray(json?.candidateAnalyses)
          ? json.candidateAnalyses.map((ca: any) => ({
              name: ca?.name ?? "",
              party: ca?.party ?? "",
              strength: ca?.strength ?? "",
              comparison: ca?.comparison ?? "",
            }))
          : [],
        voterTip: json?.voterTip ?? "",
      } as TopicAnalysisResult;
    },
    enabled: open && candidates.length > 0,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[110] bg-white flex flex-col"
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-10">
            <button onClick={onClose} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h2 className="text-[17px] font-black text-gray-900">
              {topic} 분야 AI 통합 분석
            </h2>
            <div className="w-10" />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Topic Hero Section */}
            <div className="px-6 py-10 bg-gradient-to-b from-indigo-50/50 to-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-[20px] font-black text-gray-900">{topic} 분야 정책 비교</h3>
                  <p className="text-[13px] text-gray-500 font-bold">후보자들의 주요 공약을 AI가 심층 분석합니다</p>
                </div>
              </div>

              {isLoading && (
                <div className="space-y-4 py-10">
                  <div className="h-4 bg-gray-100 rounded-full w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-full w-1/2 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-full w-2/3 animate-pulse" />
                  <p className="text-center text-sm text-gray-400 mt-4">AI가 전체 후보의 공약을 분석 중입니다...</p>
                </div>
              )}

              {isError && (
                <div className="flex items-center gap-3 p-6 bg-red-50 rounded-3xl text-[14px] text-red-600 border border-red-100">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  AI 분석을 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.
                </div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {/* Summary Card */}
                  <div className="bg-white p-6 rounded-[2.5rem] border border-indigo-100 shadow-xl shadow-indigo-50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Quote className="w-20 h-20 text-indigo-600" />
                    </div>
                    <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-3">전체 분석 요약</p>
                    <p className="text-[16px] text-gray-800 leading-relaxed font-medium relative z-10">
                      {result.summary}
                    </p>
                  </div>

                  {/* Voter Tip */}
                  {result.voterTip && (
                    <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Lightbulb className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-amber-600 uppercase tracking-wider mb-1">유권자 체크포인트</p>
                        <p className="text-[14px] text-amber-900 font-bold leading-relaxed">{result.voterTip}</p>
                      </div>
                    </div>
                  )}

                  {/* Candidate Grid */}
                  <div className="space-y-4">
                    <h4 className="text-[15px] font-black text-gray-900 ml-2">후보별 차별화 지점</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {result.candidateAnalyses.map((ca, idx) => {
                        const color = partyColor(ca.party);
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white rounded-3xl p-6 border border-gray-100 hover:border-indigo-100 transition-all shadow-sm group"
                          >
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-[13px] shadow-sm" style={{ backgroundColor: color }}>
                                {ca.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-[13px] font-black text-gray-900">{ca.name}</p>
                                <p className="text-[10px] font-bold text-gray-400">{ca.party}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="bg-gray-50 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> 핵심 강점
                                </p>
                                <p className="text-[13px] text-gray-700 leading-relaxed font-medium">{ca.strength}</p>
                              </div>
                              <div className="bg-gray-50 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3 text-indigo-500" /> 차별화 포인트
                                </p>
                                <p className="text-[13px] text-gray-700 leading-relaxed font-medium">{ca.comparison}</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
            
            <div className="p-8 text-center">
              <p className="text-[12px] text-gray-400 font-medium italic">
                * AI 분석 결과는 후보자들의 공약 텍스트를 기반으로 자동 생성되었습니다.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
