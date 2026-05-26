import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Newspaper, AlertCircle, Loader2, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ─────────────────────────────────────────────
// 타입 — 서버 EvaluatePayload 스키마와 1:1 매핑
// ─────────────────────────────────────────────

interface EvaluateAxis {
  score: number;          // 0~10
  reasoning: string;
}

interface EvaluateInterest {
  category: string;
  percentage: number;
  evidence_count: number;
}

interface NewsEvidence {
  statementSummary: string;
  sourceDate: string;
  impact: string;
}

interface EvaluateResponse {
  summary: string;
  axes: { economy: EvaluateAxis; society: EvaluateAxis };
  topInterests: EvaluateInterest[];
  newsEvidence: NewsEvidence[];
  dataCounts?: {
    proposedBills: number;
    votingRecords: number;
    recentNews: number;
  };
}

interface AIAnalysisCardProps {
  /** 등록 의원이라면 monaCd, 아니면 후보자 등 정치인 이름 */
  monaCd?: string;
  politicianName?: string;
  /** 카드 제목 위에 표시할 정치인 이름 (UI 라벨용) */
  displayName?: string;
}

// ─────────────────────────────────────────────
// 헬퍼 — 0~10 축 시각화
// ─────────────────────────────────────────────

function AxisBar({
  label,
  leftLabel,
  rightLabel,
  score,
  reasoning,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  score: number;
  reasoning: string;
}) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px] text-gray-600 font-medium">
        <span>{label}</span>
        <span className="text-gray-400">{score}/10</span>
      </div>
      <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-purple-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      {reasoning && (
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          <span className="text-gray-400">근거:</span> {reasoning}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────

export default function AIAnalysisCard({
  monaCd,
  politicianName,
  displayName,
}: AIAnalysisCardProps) {
  const [data, setData] = useState<EvaluateResponse | null>(null);

  const mutation = useMutation<EvaluateResponse, Error, void>({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (monaCd) body.monaCd = monaCd;
      if (politicianName) body.politicianName = politicianName;
      const res = await apiRequest("POST", "/api/ai/evaluate", body);
      return (await res.json()) as EvaluateResponse;
    },
    onSuccess: (res) => setData(res),
  });

  const handleEvaluate = () => mutation.mutate();

  // ── 초기 상태: 분석 시작 버튼 ──
  if (!data && !mutation.isPending && !mutation.isError) {
    return (
      <div className="rounded-3xl glass-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-purple-50 p-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-gray-900">
              프리미엄 AI 분석
            </h3>
            <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              {displayName ?? "정치인"}의 발의 법안·표결 기록·최근 뉴스를 종합하여
              데이터에 기반한 객관적 성향을 분석합니다.
            </p>
          </div>
        </div>
        <button
          onClick={handleEvaluate}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 py-2.5 text-[13px] font-medium text-white hover:opacity-90 transition"
        >
          AI 분석 시작
        </button>
      </div>
    );
  }

  // ── 로딩 ──
  if (mutation.isPending) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          <p className="text-[13px] text-gray-500">
            발의 법안·표결·뉴스를 종합 분석 중입니다…
          </p>
        </div>
      </div>
    );
  }

  // ── 에러 ──
  if (mutation.isError && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-red-700">분석 실패</p>
            <p className="text-[12px] text-red-600 mt-1">
              {mutation.error?.message ?? "잠시 후 다시 시도해 주세요."}
            </p>
            <button
              onClick={handleEvaluate}
              className="mt-3 text-[12px] text-red-700 underline"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── 결과 표시 ──
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* 헤더 + 요약 */}
        <div className="rounded-3xl glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h3 className="text-[14px] font-semibold text-gray-900">
              AI 종합 분석
            </h3>
            {data.dataCounts && (
              <span className="ml-auto text-[10px] text-gray-400">
                법안 {data.dataCounts.proposedBills} · 표결 {data.dataCounts.votingRecords} · 뉴스 {data.dataCounts.recentNews}
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            {data.summary}
          </p>
        </div>

        {/* 평가 축 */}
        <div className="rounded-3xl glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h4 className="text-[13px] font-semibold text-gray-900">정치 성향</h4>
          </div>
          <AxisBar
            label="경제"
            leftLabel="친노동/규제"
            rightLabel="친시장/규제완화"
            score={data.axes.economy.score}
            reasoning={data.axes.economy.reasoning}
          />
          <AxisBar
            label="사회"
            leftLabel="진보/복지"
            rightLabel="보수/질서"
            score={data.axes.society.score}
            reasoning={data.axes.society.reasoning}
          />
        </div>

        {/* 관심 분야 */}
        {data.topInterests.length > 0 && (
          <div className="rounded-3xl glass-card p-5">
            <h4 className="text-[13px] font-semibold text-gray-900 mb-3">
              관심 분야 TOP {data.topInterests.length}
            </h4>
            <div className="space-y-2.5">
              {data.topInterests.map((interest) => (
                <div key={interest.category}>
                  <div className="flex items-center justify-between text-[12px] text-gray-700">
                    <span>{interest.category}</span>
                    <span className="text-gray-400">
                      {interest.percentage}% · 근거 {interest.evidence_count}건
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, interest.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 뉴스 근거 — 핵심 추가 섹션 */}
        <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="w-4 h-4 text-purple-600" />
            <h4 className="text-[13px] font-semibold text-gray-900">
              뉴스 기반 판단 근거
            </h4>
            <span className="ml-auto text-[10px] text-gray-500">
              {data.newsEvidence.length}건
            </span>
          </div>
          {data.newsEvidence.length === 0 ? (
            <p className="text-[12px] text-gray-500">
              점수 산출에 직접 영향을 준 뉴스 항목이 없습니다.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.newsEvidence.map((ev, i) => (
                <li
                  key={`${ev.sourceDate}-${i}`}
                  className="rounded-xl bg-white p-3 border border-purple-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium text-gray-900 leading-snug">
                      {ev.statementSummary}
                    </p>
                    {ev.sourceDate && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {ev.sourceDate}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-purple-700 mt-1.5 leading-relaxed">
                    {ev.impact}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          AI 분석 결과는 제공된 데이터(법안·표결·뉴스)에만 근거하며, 외부 지식이나 주관적 평가를 포함하지 않습니다.
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
