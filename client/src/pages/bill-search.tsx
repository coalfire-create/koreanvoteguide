import { useState, useEffect, useRef, type ReactNode } from "react";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Search, FileText, Loader2, ExternalLink, Users, Building2, Info, CheckCircle2, Clock, ChevronDown, ChevronUp, ChevronRight, ThumbsUp, ThumbsDown, MinusCircle, ArrowLeft, Flame, Home, TrendingUp, Eye, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssemblyBills, useEnactedBills } from "@/lib/api-data";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Bill, AssemblyBill } from "@shared/schema";

// ===== AI 법안 설명 훅 =====
const aiDescCache = new Map<string, string>();

function useBillDescription(billName: string, summary?: string, committee?: string, proposer?: string) {
  const hasDesc = !!summary && summary.length > 5 && !summary.includes("위원회") && summary.length > 10;
  const [aiDesc, setAiDesc] = useState<string>(() => aiDescCache.get(billName) || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasDesc || !billName || aiDescCache.has(billName)) return;
    setLoading(true);
    fetch("/api/bills/describe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billName, committee, proposer }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.description) {
          aiDescCache.set(billName, data.description);
          setAiDesc(data.description);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [billName, hasDesc]);

  return { description: hasDesc ? summary! : (aiDesc || aiDescCache.get(billName) || ""), loading: loading && !aiDesc, isAI: !hasDesc };
}

// ===== 시민 찬반 투표 컴포넌트 =====
function CitizenVoteSection({ billId }: { billId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ agree: number; disagree: number; myOpinion: string | null }>({
    queryKey: ["/api/bills", billId, "opinion"],
    queryFn: () => fetch(`/api/bills/${billId}/opinion`).then(r => r.json()),
    enabled: !!billId,
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (opinion: string) =>
      fetch(`/api/bills/${billId}/opinion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opinion }),
      }).then(r => r.json()),
    onSuccess: (result) => {
      queryClient.setQueryData(["/api/bills", billId, "opinion"], result);
    },
  });

  const agree = data?.agree ?? 0;
  const disagree = data?.disagree ?? 0;
  const total = agree + disagree;
  const agreePct = total > 0 ? Math.round((agree / total) * 100) : 50;
  const myOpinion = data?.myOpinion ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-100 flex items-center gap-2">
        <Users className="w-4 h-4 text-indigo-500" />
        <span className="text-[13px] font-extrabold text-slate-800">시민 찬반 의견</span>
        {total > 0 && <span className="ml-auto text-[11px] text-slate-400 font-medium">총 {total.toLocaleString()}명 참여</span>}
      </div>
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : (
          <>
            {total > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-blue-600">찬성 {agreePct}%</span>
                  <span className="text-red-500">반대 {100 - agreePct}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden flex bg-red-100">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-700" style={{ width: `${agreePct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{agree.toLocaleString()}명</span>
                  <span>{disagree.toLocaleString()}명</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => mutation.mutate("agree")}
                disabled={mutation.isPending}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-[14px] transition-all duration-200 active:scale-95 ${
                  myOpinion === "agree" ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-200" : "border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100"
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${myOpinion === "agree" ? "fill-white" : ""}`} />
                찬성{agree > 0 && <span className="text-[11px] font-normal opacity-80">{agree}</span>}
              </button>
              <button
                onClick={() => mutation.mutate("disagree")}
                disabled={mutation.isPending}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-[14px] transition-all duration-200 active:scale-95 ${
                  myOpinion === "disagree" ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-200" : "border-red-200 text-red-500 bg-red-50 hover:bg-red-100"
                }`}
              >
                <ThumbsDown className={`w-4 h-4 ${myOpinion === "disagree" ? "fill-white" : ""}`} />
                반대{disagree > 0 && <span className="text-[11px] font-normal opacity-80">{disagree}</span>}
              </button>
            </div>
            {myOpinion ? (
              <p className="text-center text-[11px] text-slate-400">{myOpinion === "agree" ? "👍 찬성" : "👎 반대"}에 투표했습니다 · 다시 누르면 취소</p>
            ) : (
              <p className="text-center text-[11px] text-slate-400">이 법안에 대한 내 의견을 표현해보세요</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ===== 심사중 법안 로우 컴포넌트 (CATEGORY_CONFIG 이후에 사용되므로 파일 아래에 선언됨) =====
// ReviewingBillRow 컴포넌트는 CATEGORY_CONFIG 정의 이후에 위치함 - 아래 성질 표현 남김

// ===== Types =====
interface MemberVote {
  legislatorId: string;
  legislatorName: string;
  party: string;
  voteResult: string;
}

interface BillDbDetail {
  billId: string;
  billNo: string;
  billName: string;
  proposer: string;
  proposeDate: string;
  result: string;
  committee: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  econScore: number | null;
  socialScore: number | null;
  envScore: number | null;
}

// ===== Category helpers =====
const CATEGORY_CONFIG: Record<string, { emoji: string; bg: string; text: string; border: string }> = {
  "교육": { emoji: "📚", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "복지": { emoji: "💚", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "경제": { emoji: "💰", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "환경": { emoji: "🌱", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  "의료": { emoji: "💊", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "건강": { emoji: "🏥", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "주거": { emoji: "🏠", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "임대": { emoji: "🏢", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "부동산": { emoji: "🏗️", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "육아": { emoji: "👶", bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  "보육": { emoji: "🧒", bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  "노동": { emoji: "👷", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  "임금": { emoji: "💵", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  "세금": { emoji: "🧾", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  "금융": { emoji: "🏦", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  "교통": { emoji: "🚇", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "식품": { emoji: "🍽️", bg: "bg-lime-50", text: "text-lime-700", border: "border-lime-200" },
  "안전": { emoji: "🛡️", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  "소비자": { emoji: "🛒", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  "청년": { emoji: "🎓", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  "노인": { emoji: "🧓", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "통신": { emoji: "📱", bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  "에너지": { emoji: "⚡", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  "일반": { emoji: "📋", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

function getCategoryStyle(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG["일반"];
}

function detectCategoryFromName(name: string): string {
  const keywords = Object.keys(CATEGORY_CONFIG).filter(k => k !== "일반");
  for (const kw of keywords) {
    if (name.includes(kw)) return kw;
  }
  return "일반";
}

function formatDate(d: string | undefined): string {
  if (!d) return "";
  // "2026-04-12" or "20260412"
  if (d.length === 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
  if (d.length >= 10) return d.slice(0, 10).replace(/-/g, ".");
  return d;
}

// ===== Reused detail components (kept from original) =====

// ===== 법안 설명 표시 컴포넌트 =====
function BillDescriptionText({ billName, summary, committee, proposer, className = "" }: { billName: string; summary?: string; committee?: string; proposer?: string; className?: string }) {
  const { description, loading, isAI } = useBillDescription(billName, summary, committee, proposer);
  if (loading) return <span className={`text-[10px] text-gray-300 animate-pulse ${className}`}>설명 불러오는 중...</span>;
  if (!description) return null;
  return (
    <span className={`text-[11px] text-gray-500 leading-relaxed ${className}`}>
      {description}
      {isAI && <span className="ml-1 text-[9px] text-indigo-300 font-medium">AI</span>}
    </span>
  );
}

function ReviewingBillRow({ bill, onClick }: { bill: any; onClick: () => void }) {
  const cat = bill.category || detectCategoryFromName(bill.billName || "");
  const catStyle = getCategoryStyle(cat);
  const statusLabel = bill.result || "심사중";
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-indigo-50/50 transition-colors text-left border-b border-slate-100 last:border-b-0 group"
    >
      <div className="mt-0.5 shrink-0 text-base">{catStyle.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-indigo-700 transition-colors">{bill.billName}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-slate-400">{bill.proposer?.split(" ")[0]} · {formatDate(bill.proposeDate)}</span>
          {bill.committee && <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{bill.committee}</span>}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text} border ${catStyle.border}`}>{statusLabel === "" ? "계류" : statusLabel}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 shrink-0 mt-2 transition-colors" />
    </button>
  );
}

function SpectrumBar({
  label,
  leftLabel,
  rightLabel,
  score,
  leftColor,
  rightColor,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  score: number | null;
  leftColor: string;
  rightColor: string;
}) {
  const hasScore = score !== null && score !== undefined;
  const pct = hasScore ? ((score! + 10) / 20) * 100 : 50;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        {hasScore ? (
          <span className="text-xs font-bold text-primary">{score! > 0 ? `+${score}` : score}</span>
        ) : (
          <span className="text-xs text-muted-foreground">데이터 없음</span>
        )}
      </div>
      <div
        className="relative h-3 rounded-full overflow-hidden"
        style={{ background: `linear-gradient(to right, ${leftColor}, #e5e7eb 40%, #e5e7eb 60%, ${rightColor})` }}
      >
        {hasScore && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gray-700 shadow-md transition-all duration-500"
            style={{ left: `calc(${pct}% - 6px)` }}
          />
        )}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-muted-foreground">{leftLabel}</span>
        <span className="text-[9px] text-muted-foreground">{rightLabel}</span>
      </div>
    </div>
  );
}

function generateDescription(bill: Bill, dbDetail: BillDbDetail | undefined): string {
  const name = (dbDetail?.billName || bill.name || "")
    .replace(/\s*일부개정법률안$/, "")
    .replace(/\s*전부개정법률안$/, "")
    .replace(/\s*법률안$/, "");
  const committee = dbDetail?.committee || bill.summary || "";
  const proposer = dbDetail?.proposer || bill.proposer || "";
  const date = dbDetail?.proposeDate || bill.proposedDate || "";
  const result = dbDetail?.result || "";

  let desc = `「${name}」`;
  if (bill.name.includes("일부개정")) desc += "은 기존 법률의 일부 조항을 수정·보완하는 개정안입니다.";
  else if (bill.name.includes("전부개정")) desc += "은 기존 법률 전체를 전면 개정하는 법안입니다.";
  else if (bill.name.includes("특별법") || bill.name.includes("특례법")) desc += "은 특정 사안에 대한 특별한 법적 근거를 마련하는 법안입니다.";
  else desc += "은 새로운 법적 근거를 마련하는 법안입니다.";
  if (committee) desc += ` ${committee} 소관으로`;
  if (proposer) desc += ` ${proposer}에 의해`;
  if (date) desc += ` ${date}에 발의되었습니다.`;
  else desc += " 발의되었습니다.";
  if (result && (result.includes("가결") || result === "통과")) desc += " 국회에서 가결·통과된 법률입니다.";
  else if (result && result.includes("부결")) desc += " 국회 표결에서 부결되었습니다.";
  else desc += " 현재 심사 진행 중입니다.";
  return desc;
}

const PARTY_COLORS: Record<string, string> = {
  "더불어민주당": "bg-blue-100 text-blue-800",
  "국민의힘": "bg-red-100 text-red-800",
  "조국혁신당": "bg-teal-100 text-teal-800",
  "개혁신당": "bg-orange-100 text-orange-800",
  "진보당": "bg-purple-100 text-purple-800",
  "기본소득당": "bg-green-100 text-green-800",
  "사회민주당": "bg-pink-100 text-pink-800",
  "무소속": "bg-gray-100 text-gray-600",
};
function partyColor(party: string) { return PARTY_COLORS[party] || "bg-slate-100 text-slate-600"; }

interface LegislatorVoteEntry { billId: string; billName: string; voteResult: string; }

function LegislatorBillsSheet({ legislatorId, legislatorName, party, open, onClose, onSelectBill }: {
  legislatorId: string; legislatorName: string; party: string; open: boolean; onClose: () => void;
  onSelectBill: (billId: string, billName: string) => void;
}) {
  const query = useQuery<{ monaCode: string; bills: LegislatorVoteEntry[]; total: number }>({
    queryKey: ["/api/legislators", legislatorId, "voted-bills"],
    queryFn: () => fetch(`/api/legislators/${legislatorId}/voted-bills`).then(r => r.json()),
    enabled: open && !!legislatorId, staleTime: 5 * 60 * 1000,
  });
  const bills = query.data?.bills ?? [];
  const ORDER = ["찬성", "반대", "기권", "불참", "알 수 없음"];
  const RESULT_COLORS: Record<string, string> = {
    찬성: "bg-blue-100 text-blue-700 border-blue-200", 반대: "bg-red-100 text-red-700 border-red-200",
    기권: "bg-amber-100 text-amber-700 border-amber-200", 불참: "bg-gray-100 text-gray-500 border-gray-200",
    "알 수 없음": "bg-gray-50 text-gray-400 border-gray-100",
  };
  const grouped = bills.reduce<Record<string, LegislatorVoteEntry[]>>((acc, b) => {
    const key = b.voteResult.includes("찬성") ? "찬성" : b.voteResult.includes("반대") ? "반대" : b.voteResult.includes("기권") ? "기권" : b.voteResult.includes("불참") ? "불참" : "알 수 없음";
    (acc[key] ??= []).push(b); return acc;
  }, {});
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <SheetTitle className="text-base leading-tight">{legislatorName} 의원 표결 기록</SheetTitle>
              <SheetDescription className="text-xs mt-0.5"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${partyColor(party)}`}>{party}</span></SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="px-5 py-4">
          {query.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" />데이터를 불러오는 중...</div>}
          {!query.isLoading && bills.length === 0 && (
            <div className="py-10 text-center"><FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm font-medium text-muted-foreground">표결 기록이 없습니다</p></div>
          )}
          {bills.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">총 {bills.length}건의 표결 기록</p>
              {ORDER.map((result) => { const group = grouped[result] ?? []; if (group.length === 0) return null; return (
                <div key={result}>
                  <div className="flex items-center gap-2 mb-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${RESULT_COLORS[result]}`}>{result} {group.length}건</span></div>
                  <div className="space-y-1.5">{group.map((b) => (
                    <button key={b.billId} onClick={() => { onClose(); onSelectBill(b.billId, b.billName); }} className="w-full text-left px-3 py-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <p className="text-xs font-medium leading-snug line-clamp-2">{b.billName}</p>
                    </button>
                  ))}</div>
                </div>
              ); })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MemberVotesSection({ billId, billResult = "", onSelectLegislator }: { billId: string; billResult?: string; onSelectLegislator: (id: string, name: string, party: string) => void }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 찬성: true, 반대: true, 기권: false, "불참/알 수 없음": false });
  const isDiscarded = billResult === "폐기" || billResult.includes("폐기");
  const query = useQuery<{ source: string; votes: MemberVote[] }>({
    queryKey: ["/api/bills", billId, "member-votes"],
    queryFn: () => fetch(`/api/bills/${billId}/member-votes`).then(r => r.json()),
    enabled: open && !isDiscarded, staleTime: 12 * 60 * 60 * 1000, retry: 1,
  });
  const votes = query.data?.votes ?? [];
  const byResult = votes.reduce<Record<string, MemberVote[]>>((acc, v) => {
    const key = v.voteResult.includes("찬성") ? "찬성" : v.voteResult.includes("반대") ? "반대" : v.voteResult.includes("기권") ? "기권" : v.voteResult.includes("불참") ? "불참" : "알 수 없음";
    (acc[key] ??= []).push(v); return acc;
  }, {});
  const ORDER = ["찬성", "반대", "기권", "불참", "알 수 없음"];
  const ICONS: Record<string, ReactNode> = { 찬성: <ThumbsUp className="w-3.5 h-3.5" />, 반대: <ThumbsDown className="w-3.5 h-3.5" />, 기권: <MinusCircle className="w-3.5 h-3.5" />, 불참: <MinusCircle className="w-3.5 h-3.5" />, "알 수 없음": <MinusCircle className="w-3.5 h-3.5" /> };
  const COLORS: Record<string, string> = { 찬성: "text-blue-600 bg-blue-50 border-blue-200", 반대: "text-red-600 bg-red-50 border-red-200", 기권: "text-amber-600 bg-amber-50 border-amber-200", 불참: "text-gray-500 bg-gray-50 border-gray-200", "알 수 없음": "text-gray-400 bg-gray-50 border-gray-100" };
  return (
    <div className="border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">의원별 표결 현황</span>{votes.length > 0 && <Badge variant="secondary" className="text-xs">{votes.length}명</Badge>}</div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="p-4 space-y-3">
          {query.isLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center"><Loader2 className="w-4 h-4 animate-spin" />국회 API에서 의원 표결 데이터를 가져오는 중입니다...</div>}
          {query.isError && <p className="text-xs text-red-500 text-center py-4">표결 데이터를 불러오지 못했습니다</p>}
          {!query.isLoading && !query.isError && votes.length === 0 && (
            <div className="text-center py-5 space-y-1">
              {billResult === "폐기" || billResult.includes("폐기") ? (<><p className="text-xs font-medium text-muted-foreground">폐기된 법안입니다</p><p className="text-xs text-muted-foreground">본회의 표결 없이 폐기되어 의원별 표결 기록이 없습니다</p></>) : billResult === "계류" || billResult === "" ? (<><p className="text-xs font-medium text-muted-foreground">아직 표결이 진행되지 않은 법안입니다</p><p className="text-xs text-muted-foreground">본회의 표결이 완료되면 기록이 표시됩니다</p></>) : (<p className="text-xs text-muted-foreground">이 법안에 대한 의원 표결 기록이 없습니다</p>)}
            </div>
          )}
          {votes.length > 0 && ORDER.map((result) => {
            const group = byResult[result] ?? []; if (group.length === 0) return null;
            const isExpanded = expanded[result] ?? false; const colorClass = COLORS[result];
            return (
              <div key={result} className={`border rounded-xl overflow-hidden ${colorClass}`}>
                <button className="w-full flex items-center justify-between px-3 py-2.5 text-left" onClick={() => setExpanded(e => ({ ...e, [result]: !e[result] }))}>
                  <div className="flex items-center gap-2">{ICONS[result]}<span className="font-semibold text-sm">{result}</span><span className="text-xs font-bold">{group.length}명</span></div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 bg-white/60"><div className="flex flex-wrap gap-1.5 pt-2">
                    {group.map(v => (
                      <button key={v.legislatorId || v.legislatorName} onClick={() => onSelectLegislator(v.legislatorId, v.legislatorName, v.party)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-75 transition-opacity cursor-pointer ${partyColor(v.party)}`}>
                        {v.legislatorName}<span className="text-[9px] opacity-60">{v.party.replace("더불어민주당", "민주").replace("국민의힘", "국힘").replace("조국혁신당", "조혁").replace("개혁신당", "개혁").replace("진보당", "진보").replace("무소속", "무소")}</span>
                      </button>
                    ))}
                  </div></div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BillDetailSheet({ bill, open, onClose, onSelectBill }: { bill: Bill | null; open: boolean; onClose: () => void; onSelectBill?: (billId: string, billName: string) => void; }) {
  const [selectedLegislator, setSelectedLegislator] = useState<{ id: string; name: string; party: string } | null>(null);
  const isRealBill = !!bill && !bill.id.startsWith("api-bill-") && !bill.id.startsWith("b");
  const dbQuery = useQuery<BillDbDetail>({
    queryKey: ["/api/db/bills", bill?.id],
    queryFn: () => fetch(`/api/db/bills/${bill!.id}`).then(r => { if (!r.ok) throw new Error("not found"); return r.json(); }),
    enabled: open && isRealBill, staleTime: 30 * 60 * 1000, retry: false,
  });

  // Track view count
  useEffect(() => {
    if (open && bill?.id) {
      fetch(`/api/bills/${bill.id}/view`, { method: "POST" }).catch(() => {});
    }
  }, [open, bill?.id]);

  if (!bill) return null;
  const d = dbQuery.data;
  const committee = d?.committee || bill.summary || "";
  const result = d?.result || (bill.status === "통과" ? "가결" : bill.status === "폐기" ? "폐기" : "계류");
  const resultStyle = (r: string) => {
    if (r.includes("가결") || r === "통과") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (r.includes("부결") || r === "폐기") return "bg-red-100 text-red-700 border-red-200";
    return "bg-amber-100 text-amber-700 border-amber-200";
  };
  const yesCount = d?.yesCount ?? 0; const noCount = d?.noCount ?? 0; const abstainCount = d?.abstainCount ?? 0;
  const totalVotes = yesCount + noCount + abstainCount;
  const hasScores = d && (d.econScore !== null || d.socialScore !== null || d.envScore !== null);
  const description = !dbQuery.isLoading ? generateDescription(bill, d) : "";

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-0 pb-10">
        <SheetHeader className="px-5 pb-3">
          <div className="flex items-start gap-2 mb-2"><FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" /><SheetTitle className="text-base font-bold leading-snug text-left">{bill.name}</SheetTitle></div>
          <Badge variant="outline" className={`self-start text-xs ${resultStyle(result)}`}>{result || "계류"}</Badge>
          <SheetDescription className="sr-only">법안 상세 정보 및 이념 성향 분석</SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="px-5 pt-4 space-y-4">
          {dbQuery.isLoading && isRealBill ? (
            <div className="flex flex-col gap-3"><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /></div>
          ) : (
            <>
              {description && (<div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 flex gap-2"><Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" /><p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{description}</p></div>)}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3"><p className="text-[10px] text-muted-foreground mb-1">발의일</p><p className="text-sm font-medium">{bill.proposedDate || "—"}</p></div>
                <div className="bg-muted/50 rounded-xl p-3"><p className="text-[10px] text-muted-foreground mb-1">법안 번호</p><p className="text-sm font-medium">{d?.billNo || "—"}</p></div>
              </div>
              {committee && (<div className="bg-muted/50 rounded-xl p-3 flex items-start gap-2"><Building2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] text-muted-foreground mb-0.5">소관 위원회</p><p className="text-sm font-medium">{committee}</p></div></div>)}
              {bill.proposer && (<div className="bg-muted/50 rounded-xl p-3"><p className="text-[10px] text-muted-foreground mb-1">발의자</p><p className="text-sm font-medium leading-relaxed">{bill.proposer}</p></div>)}
              {totalVotes > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2"><Users className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-xs font-semibold text-muted-foreground">표결 결과 (총 {totalVotes}명)</p></div>
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center"><p className="text-xl font-bold text-blue-700">{yesCount}</p><p className="text-[10px] text-blue-500">찬성</p></div>
                    <div className="flex-1 bg-red-50 rounded-xl p-3 text-center"><p className="text-xl font-bold text-red-700">{noCount}</p><p className="text-[10px] text-red-500">반대</p></div>
                    <div className="flex-1 bg-gray-100 rounded-xl p-3 text-center"><p className="text-xl font-bold text-gray-500">{abstainCount}</p><p className="text-[10px] text-gray-400">기권/불출석</p></div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                    <div className="bg-blue-400 h-full transition-all" style={{ width: `${(yesCount / totalVotes) * 100}%` }} />
                    <div className="bg-red-400 h-full transition-all" style={{ width: `${(noCount / totalVotes) * 100}%` }} />
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-bold mb-3 text-foreground">이념 성향 분석</p>
                <div className="bg-muted/40 rounded-xl p-4">
                  <SpectrumBar label="경제" leftLabel="친기업 / 규제완화" rightLabel="친노동 / 복지 / 증세" score={hasScores ? d!.econScore : null} leftColor="#3b82f6" rightColor="#ef4444" />
                  <SpectrumBar label="사회" leftLabel="보존 / 질서 / 안보" rightLabel="변화 / 인권 / 소수자" score={hasScores ? d!.socialScore : null} leftColor="#8b5cf6" rightColor="#ec4899" />
                  <SpectrumBar label="환경" leftLabel="개발 / 성장 / 원전" rightLabel="환경보존 / 친환경" score={hasScores ? d!.envScore : null} leftColor="#f59e0b" rightColor="#22c55e" />
                  {!hasScores && <p className="text-[10px] text-muted-foreground text-center mt-2">아직 분석된 성향 데이터가 없습니다</p>}
                </div>
              </div>
              {/* 시민 찬반 의견 투표 */}
              <CitizenVoteSection billId={bill.id} />
              {isRealBill && <MemberVotesSection billId={bill.id} billResult={result} onSelectLegislator={(id, name, party) => setSelectedLegislator({ id, name, party })} />}
              {isRealBill && (
                <a href={`https://likms.assembly.go.kr/bill/billDetail.do?billId=${bill.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />국회 원문 보기
                </a>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
    {selectedLegislator && (
      <LegislatorBillsSheet legislatorId={selectedLegislator.id} legislatorName={selectedLegislator.name} party={selectedLegislator.party} open={!!selectedLegislator} onClose={() => setSelectedLegislator(null)}
        onSelectBill={(billId, billName) => { setSelectedLegislator(null); onSelectBill?.(billId, billName); }} />
    )}
    </>
  );
}

// ===== New Section Components =====

function SectionHeader({ icon, title, subtitle, onViewAll }: { icon: ReactNode; title: string; subtitle?: string; onViewAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h2 className="text-[16px] font-extrabold text-slate-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {onViewAll && (
        <button onClick={onViewAll} className="text-[12px] font-bold text-primary flex items-center gap-0.5 hover:underline">
          전체보기 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function HotBillCard({ bill, onClick }: { bill: any; onClick: () => void }) {
  const cat = bill.category || detectCategoryFromName(bill.billName || "");
  const style = getCategoryStyle(cat);
  return (
    <button onClick={onClick}
      className={`min-w-[280px] max-w-[320px] snap-start shrink-0 rounded-2xl border ${style.border} ${style.bg} p-4 text-left
        hover:shadow-lg hover:scale-[1.02] transition-all duration-200 relative overflow-hidden`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
          <Flame className="w-3 h-3" /> HOT
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
          {style.emoji} {cat}
        </span>
      </div>
      <h3 className="text-[14px] font-bold text-slate-900 leading-snug line-clamp-2 mb-2">{bill.billName}</h3>
      <p className="text-[11px] text-slate-500 mb-2">{bill.proposer?.split(" ")[0]} · {formatDate(bill.proposeDate)}</p>
      <div className="border-t border-slate-200/60 pt-2 mt-1">
        <p className="text-[11px] text-slate-600 line-clamp-1">{bill.committee || "심사 진행 중"}</p>
      </div>
      <div className="flex items-center gap-1 mt-3 text-[11px] font-bold text-primary">
        상세보기 <ChevronRight className="w-3 h-3" />
      </div>
      {/* View count badge */}
      {(bill.viewCount ?? 0) > 0 && (
        <div className="absolute top-3 right-3 flex items-center gap-0.5 text-[9px] text-slate-400"><Eye className="w-3 h-3" />{bill.viewCount}</div>
      )}
    </button>
  );
}

function DailyLifeBillCard({ bill, onClick }: { bill: any; onClick: () => void }) {
  const cat = bill.category || detectCategoryFromName(bill.billName || "");
  const style = getCategoryStyle(cat);
  return (
    <button onClick={onClick}
      className="min-w-[240px] max-w-[260px] snap-start shrink-0 rounded-xl border border-slate-200 bg-white p-3.5 text-left
        hover:shadow-md hover:scale-[1.02] transition-all duration-200"
    >
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border} mb-2`}>
        {style.emoji} {cat}
      </span>
      <h3 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2 mb-1.5">{bill.billName}</h3>
      <p className="text-[11px] text-slate-400">{bill.proposer?.split(" ")[0]} · {formatDate(bill.proposeDate)}</p>
    </button>
  );
}

function PassedBillRow({ bill, onClick }: { bill: any; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 hover:bg-emerald-50/50 transition-colors text-left border-b border-slate-100 last:border-b-0"
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-slate-800 line-clamp-1">{bill.billName}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{bill.committee} · {formatDate(bill.proposeDate)}</p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {bill.passedDate && <span className="text-[10px] text-emerald-600 font-medium">{formatDate(bill.passedDate)}</span>}
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
      </div>
    </button>
  );
}

// Skeleton loaders
function HotBillSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {[1, 2, 3].map(i => (
        <div key={i} className="min-w-[280px] max-w-[320px] shrink-0 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <Skeleton className="h-5 w-16 mb-3 rounded-full" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3 mb-3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function DailyLifeSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="min-w-[240px] max-w-[260px] shrink-0 rounded-xl border border-slate-100 bg-white p-3.5">
          <Skeleton className="h-4 w-12 mb-2 rounded-full" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function PassedBillSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-slate-100">
          <Skeleton className="w-4 h-4 rounded-full shrink-0" />
          <div className="flex-1"><Skeleton className="h-4 w-3/4 mb-1.5" /><Skeleton className="h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}

// ===== Category filter pills =====
const FILTER_CATEGORIES = ["전체", "교육", "복지", "경제", "환경", "의료", "주거", "노동", "세금", "교통", "청년", "안전"];

// ===== Main Page Component =====
export default function BillSearch() {
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCat, setFilterCat] = useState("전체");
  const [hasSearched, setHasSearched] = useState(false);

  const { data: reviewingData } = useQuery<{ bills: any[]; total: number }>({
    queryKey: ["/api/bills/reviewing", 1],
    queryFn: () => fetch("/api/bills/reviewing?page=1&limit=6").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: hotBills } = useQuery<any[]>({
    queryKey: ["/api/bills/hot"],
    queryFn: () => fetch("/api/bills/hot").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: passedBills } = useQuery<any[]>({
    queryKey: ["/api/bills/passed", 1],
    queryFn: () => fetch("/api/bills/passed?page=1&limit=5").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newsData } = useQuery<{ items: any[] }>({
    queryKey: ["/api/news", "bill"],
    queryFn: async () => {
      const res = await fetch("/api/news?category=bill");
      if (!res.ok) return { items: [] };
      return res.json();
    },
  });

  const { bills: proposedBills, isLoading: proposedLoading } = useAssemblyBills();

  function dbBillToNormalized(raw: any): Bill {
    let status: "통과" | "계류" | "폐기" = "계류";
    const result = raw.result || "";
    if (result.includes("가결") || result.includes("통과")) status = "통과";
    else if (result.includes("폐기") || result.includes("부결")) status = "폐기";
    return { id: raw.billId || "", name: raw.billName || "", summary: raw.committee || "", proposedDate: raw.proposeDate || "", proposer: raw.proposer || "", status, votes: [] };
  }

  function selectDbBill(raw: any) { setSelectedBill(dbBillToNormalized(raw)); }

  const filteredBills = proposedBills.filter(b => {
    const matchesSearch = !searchQuery || b.name.includes(searchQuery) || b.summary.includes(searchQuery) || b.proposer.includes(searchQuery);
    const matchesCat = filterCat === "전체" || b.name.includes(filterCat) || b.summary.includes(filterCat);
    return matchesSearch && matchesCat;
  });

  const reviewingBills = reviewingData?.bills ?? [];
  const hotBillsList = hotBills ?? [];
  const passedBillsList = passedBills ?? [];
  const newsList = newsData?.items ?? [];

  function formatPubDate(d: string) {
    if (!d) return "";
    try {
      const date = new Date(d);
      const diff = Date.now() - date.getTime();
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) return "방금";
      if (hours < 24) return `${hours}시간 전`;
      return `${Math.floor(hours / 24)}일 전`;
    } catch { return ""; }
  }

  const SearchBar = (
    <div className="relative group w-full max-w-xl mx-auto">
      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="search"
        placeholder="법안 제목, 발의자, 키워드로 검색..."
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); setHasSearched(true); }}
        className="pl-14 pr-10 py-3 text-base rounded-2xl border border-gray-200 shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all w-full bg-white h-[50px] outline-none"
      />
      {searchQuery && (
        <button onClick={() => { setSearchQuery(""); setHasSearched(false); }} className="absolute right-4 top-1/2 -translate-y-1/2">
          <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ── 검색 전: 중앙 레이아웃 ── */}
      {!hasSearched && (
        <div className="flex flex-col items-center justify-start gap-6 px-5 pt-8">

          <div className="w-full max-w-xl flex flex-col gap-6">

            {/* 심사중인 법안 */}
            {reviewingBills.length > 0 && (
              <div className="w-full">
                <h2 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  최근 심사중인 법안
                  <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full ml-1">계류중</span>
                </h2>
                <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                  {reviewingBills.map((bill: any) => {
                    const cat = bill.category || detectCategoryFromName(bill.billName || "");
                    const style = getCategoryStyle(cat);
                    return (
                      <button key={bill.billId} onClick={() => selectDbBill(bill)}
                        className="shrink-0 flex flex-col gap-2 bg-white border border-gray-100 shadow-sm rounded-xl py-3 px-4 hover:border-indigo-200 transition-colors cursor-pointer text-left min-w-[200px] max-w-[240px]">
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                            {style.emoji} {cat}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{bill.proposer?.split(" ")[0]}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug">{bill.billName?.replace(/\s*일부개정법률안$/, "").replace(/\s*법률안$/, "")}</span>
                        <BillDescriptionText
                          billName={bill.billName}
                          committee={bill.committee}
                          proposer={bill.proposer}
                          className="line-clamp-2 block mt-1"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 핫한 법안 */}
            {hotBillsList.length > 0 && (
              <div className="w-full">
                <h2 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  지금 핫한 법안
                </h2>
                <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                  {hotBillsList.map((bill: any, idx: number) => {
                    const cat = bill.category || detectCategoryFromName(bill.billName || "");
                    const style = getCategoryStyle(cat);
                    return (
                      <button key={bill.billId} onClick={() => selectDbBill(bill)}
                        className="shrink-0 flex flex-col gap-2 bg-white border border-gray-100 shadow-sm rounded-xl py-3 px-4 hover:border-orange-200 transition-colors cursor-pointer text-left min-w-[200px] max-w-[240px]">
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-black text-white bg-orange-500 px-1.5 py-0.5 rounded text-[10px]">HOT {idx + 1}</span>
                          {(bill.viewCount ?? 0) > 0 && <span className="text-[10px] text-orange-500 font-bold flex items-center gap-0.5"><Eye className="w-3 h-3" />{bill.viewCount}</span>}
                        </div>
                        <span className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug">{bill.billName?.replace(/\s*일부개정법률안$/, "").replace(/\s*법률안$/, "")}</span>
                        <BillDescriptionText
                          billName={bill.billName}
                          committee={bill.committee}
                          proposer={bill.proposer}
                          className="line-clamp-2 block mt-1 mb-1"
                        />
                        <div className="flex items-center gap-1.5 mt-1">
                           <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                            {style.emoji} {cat}
                          </span>
                          <span className="text-[10px] text-gray-500 line-clamp-1">{bill.proposer?.split(" ")[0]} 발의</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 통과된 법안 */}
            {passedBillsList.length > 0 && (
              <div className="w-full">
                <h2 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  최근 통과된 법안
                </h2>
                <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                  {passedBillsList.map((bill: any) => (
                    <button key={bill.billId} onClick={() => selectDbBill(bill)}
                      className="shrink-0 flex items-center gap-2 bg-white border border-emerald-100 shadow-sm rounded-xl py-2 px-3 hover:border-emerald-300 transition-colors cursor-pointer">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-sm font-bold text-gray-800 max-w-[140px] truncate">{bill.billName?.replace(/\s*일부개정법률안$/, "").replace(/\s*법률안$/, "")}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 관련 뉴스 */}
            {newsList.length > 0 && (
              <div className="w-full">
                <h2 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-500" />
                  법안 관련 주요 뉴스
                </h2>
                <div className="flex flex-col gap-2">
                  {newsList.slice(0, 3).map((news: any, idx: number) => (
                    <a key={idx} href={news.link} target="_blank" rel="noopener noreferrer"
                      className="block bg-white border border-gray-100 shadow-sm rounded-xl p-3 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
                      <h3 className="text-sm font-bold text-gray-900 line-clamp-1 mb-1" dangerouslySetInnerHTML={{ __html: news.title }} />
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span dangerouslySetInnerHTML={{ __html: news.source || "뉴스" }} />
                        <span>{formatPubDate(news.pubDate)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 검색창 */}
          <div className="w-full max-w-xl mt-2">{SearchBar}</div>

          <p className="text-gray-300 text-xs">법안 제목이나 키워드로 검색하면 결과가 표시됩니다</p>
        </div>
      )}

      {/* ── 검색 후: sticky 필터 바 + 카드 그리드 ── */}
      {hasSearched && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          {/* sticky 검색 + 필터 바 */}
          <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-border/40 py-3 mb-6 -mx-4 px-4">
            <div className="max-w-4xl mx-auto space-y-2">
              {SearchBar}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {FILTER_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    className={`shrink-0 text-[12px] font-bold px-3 py-1 rounded-full border transition-colors ${filterCat === cat ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 결과 */}
          {proposedLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-xl border border-gray-100 bg-white p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : filteredBills.length > 0 ? (
            <>
              <p className="text-[11px] text-gray-400 font-medium mb-3">
                {searchQuery || filterCat !== "전체" ? `검색 결과 ${filteredBills.length}건` : `전체 ${filteredBills.length}건`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredBills.slice(0, 40).map(bill => {
                  const cat = detectCategoryFromName(bill.name);
                  const style = getCategoryStyle(cat);
                  const statusColor = bill.status === "통과" ? "bg-emerald-100 text-emerald-700" : bill.status === "폐기" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
                  return (
                    <button key={bill.id} onClick={() => setSelectedBill(bill)}
                      className="text-left rounded-2xl border border-gray-100 bg-white p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-lg">{style.emoji}</span>
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor}`}>{bill.status}</span>
                      </div>
                      <h3 className="text-[13px] font-bold text-gray-900 line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">{bill.name}</h3>
                      <BillDescriptionText
                        billName={bill.name}
                        summary={bill.summary}
                        committee={bill.summary}
                        proposer={bill.proposer}
                        className="line-clamp-2 block mb-2"
                      />
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        {bill.proposer && <span>{bill.proposer.split(" ")[0]}</span>}
                        {bill.proposedDate && <span>{formatDate(bill.proposedDate)}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredBills.length > 40 && (
                <p className="text-center text-[12px] text-gray-400 mt-4 font-medium">상위 40건만 표시됩니다. 검색어를 좁혀보세요.</p>
              )}
            </>
          ) : (
            <div className="text-center py-32">
              <Search className="w-16 h-16 text-gray-200 mx-auto mb-6" />
              <h3 className="text-xl font-bold mb-2">{searchQuery ? "검색 결과가 없습니다" : "법안을 검색해보세요"}</h3>
              <p className="text-gray-400">다른 키워드로 검색하거나 카테고리를 변경해보세요</p>
            </div>
          )}
        </div>
      )}

      <BillDetailSheet
        bill={selectedBill}
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        onSelectBill={(billId, billName) => {
          setSelectedBill({ id: billId, name: billName, summary: "", proposedDate: "", proposer: "", status: "통과", votes: [] });
        }}
      />
    </div>
  );
}
