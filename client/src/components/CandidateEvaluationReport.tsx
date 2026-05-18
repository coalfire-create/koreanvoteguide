// 후보 객관 평가 리포트 — 앱 실데이터(표결·대표발의·선관위 경력/공약) 기반.
// 비용(LLM) 때문에 자동 호출하지 않고 사용자가 "리포트 생성" 클릭 시에만 fetch.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FileBarChart2, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";

interface KeyVote { bill: string; vote: string; note: string }
interface ProposedBill { bill: string; purpose: string }
interface AdminRecord { role: string; policy: string; outcome: string }
interface MajorActivity { title: string; fact: string }

interface CandidateReport {
  candidateName: string;
  hasLegislativeExperience: boolean;
  legislative: {
    votingAnalysis: string;
    keyVotes: KeyVote[];
    proposedBills: ProposedBill[];
    committeeFocus: string;
  } | null;
  administrative: {
    records: AdminRecord[];
    majorActivities: MajorActivity[];
  } | null;
  dataGaps: string[];
  keywords: string[];
}

interface ReportEnvelope {
  report: CandidateReport;
  sources: {
    legislatorMatched: boolean;
    voteRecords: number;
    proposedBills: number;
    electionCandidateMatched: boolean;
    pledges: number;
    statements: number;
  };
  generatedAt: string;
}

interface Props {
  candidateName: string;
  party?: string;
}

function voteBadgeClass(vote: string): string {
  if (vote.includes("찬성")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (vote.includes("반대")) return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

export function CandidateEvaluationReport({ candidateName, party }: Props) {
  const [requested, setRequested] = useState(false);

  const { data, isLoading, error } = useQuery<ReportEnvelope>({
    queryKey: ["/api/candidates/evaluation-report", candidateName, party],
    enabled: requested && !!candidateName,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const qs = new URLSearchParams({ name: candidateName });
      if (party) qs.set("party", party);
      const res = await fetch(`/api/candidates/evaluation-report?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `리포트 생성 실패 (${res.status})`);
      }
      return res.json();
    },
  });

  if (!requested) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileBarChart2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[15px] text-foreground">객관 평가 리포트</h3>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              국회 표결·대표발의 법안, 선관위 등록 경력·공약 등 <b>검증 가능한 데이터</b>만으로
              가치판단 없이 정리합니다. 근거가 없는 항목은 "데이터 미보유"로 표기됩니다.
            </p>
          </div>
        </div>
        <Button className="w-full mt-4" onClick={() => setRequested(true)}>
          {candidateName} 리포트 생성
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-8 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-[13px] text-muted-foreground">실데이터를 수집해 분석 중입니다…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[14px] text-amber-800">리포트를 생성할 수 없습니다</p>
            <p className="text-[12px] text-amber-700 mt-1">{(error as Error).message}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full mt-4" onClick={() => setRequested(false)}>
          닫기
        </Button>
      </div>
    );
  }

  if (!data) return null;
  const { report, sources, generatedAt } = data;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-[16px] text-foreground">
          {report.candidateName} 객관 평가 리포트
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> 데이터 기반
        </span>
      </div>

      {/* 1. 입법 활동 */}
      {report.legislative && (
        <section className="space-y-3">
          <h4 className="font-bold text-[14px] text-foreground border-l-4 border-primary pl-2">
            1. 입법(국회) 활동
          </h4>
          <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-line">
            {report.legislative.votingAnalysis}
          </p>

          {report.legislative.keyVotes?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[12px] font-bold text-muted-foreground">주요 표결</p>
              {report.legislative.keyVotes.map((v, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-2.5">
                  <div className="flex items-start gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${voteBadgeClass(v.vote)}`}
                    >
                      {v.vote}
                    </span>
                    <span className="text-[12px] font-semibold text-foreground leading-snug">
                      {v.bill}
                    </span>
                  </div>
                  {v.note && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{v.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {report.legislative.proposedBills?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[12px] font-bold text-muted-foreground">대표발의 법안</p>
              {report.legislative.proposedBills.map((b, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-2.5">
                  <p className="text-[12px] font-semibold text-foreground">{b.bill}</p>
                  {b.purpose && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{b.purpose}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {report.legislative.committeeFocus && (
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[12px] font-bold text-muted-foreground mb-1">소속 상임위 활동</p>
              <p className="text-[12px] text-foreground/90 leading-relaxed">
                {report.legislative.committeeFocus}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 2. 행정/주요 활동 */}
      {report.administrative && (
        <section className="space-y-3">
          <h4 className="font-bold text-[14px] text-foreground border-l-4 border-primary pl-2">
            {report.legislative ? "2. 행정·주요 활동" : "행정·주요 활동"}
          </h4>

          {report.administrative.records?.length > 0 && (
            <div className="space-y-1.5">
              {report.administrative.records.map((r, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-2.5">
                  <p className="text-[12px] font-bold text-foreground">{r.role}</p>
                  <p className="text-[12px] text-foreground/90 mt-0.5">{r.policy}</p>
                  {r.outcome && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{r.outcome}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {report.administrative.majorActivities?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[12px] font-bold text-muted-foreground">주요 활동</p>
              {report.administrative.majorActivities.map((a, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-2.5">
                  <p className="text-[12px] font-semibold text-foreground">{a.title}</p>
                  {a.fact && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{a.fact}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 데이터 공백 */}
      {report.dataGaps?.length > 0 && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-3">
          <p className="text-[11px] font-bold text-amber-700 mb-1">검증 가능한 데이터 미보유</p>
          <ul className="list-disc list-inside space-y-0.5">
            {report.dataGaps.map((g, i) => (
              <li key={i} className="text-[11px] text-amber-700/90">{g}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 결론 키워드 3 */}
      {report.keywords?.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-muted-foreground mb-2">데이터 도출 핵심 키워드</p>
          <div className="flex flex-wrap gap-2">
            {report.keywords.slice(0, 3).map((k, i) => (
              <span
                key={i}
                className="text-[12px] font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
              >
                #{k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 근거 출처 */}
      <p className="text-[10px] text-muted-foreground/80 border-t border-border/40 pt-3 leading-relaxed">
        근거: 국회 표결 {sources.voteRecords.toLocaleString()}건 · 대표발의 {sources.proposedBills}건 ·
        선관위 등록 공약 {sources.pledges}건 · 행보 {sources.statements}건
        <br />
        {new Date(generatedAt).toLocaleString("ko-KR")} 생성 · 데이터 없는 항목은 추정하지 않고 위에 명시했습니다.
      </p>
    </div>
  );
}

export default CandidateEvaluationReport;
