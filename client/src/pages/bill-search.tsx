import { useState, useEffect, type ReactNode } from "react";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, FileText, Loader2, ExternalLink, Users, Building2, Info, CheckCircle2, Clock, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, MinusCircle, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssemblyBills, useEnactedBills } from "@/lib/api-data";
import { useQuery } from "@tanstack/react-query";
import { LastUpdated } from "@/components/last-updated";
import type { Bill } from "@shared/schema";

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

  if (bill.name.includes("일부개정")) {
    desc += "은 기존 법률의 일부 조항을 수정·보완하는 개정안입니다.";
  } else if (bill.name.includes("전부개정")) {
    desc += "은 기존 법률 전체를 전면 개정하는 법안입니다.";
  } else if (bill.name.includes("특별법") || bill.name.includes("특례법")) {
    desc += "은 특정 사안에 대한 특별한 법적 근거를 마련하는 법안입니다.";
  } else {
    desc += "은 새로운 법적 근거를 마련하는 법안입니다.";
  }

  if (committee) desc += ` ${committee} 소관으로`;
  if (proposer) desc += ` ${proposer}에 의해`;
  if (date) desc += ` ${date}에 발의되었습니다.`;
  else desc += " 발의되었습니다.";

  if (result && (result.includes("가결") || result === "통과")) {
    desc += " 국회에서 가결·통과된 법률입니다.";
  } else if (result && result.includes("부결")) {
    desc += " 국회 표결에서 부결되었습니다.";
  } else {
    desc += " 현재 심사 진행 중입니다.";
  }

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

function partyColor(party: string) {
  return PARTY_COLORS[party] || "bg-slate-100 text-slate-600";
}

interface LegislatorVoteEntry {
  billId: string;
  billName: string;
  voteResult: string;
}

function LegislatorBillsSheet({
  legislatorId,
  legislatorName,
  party,
  open,
  onClose,
  onSelectBill,
}: {
  legislatorId: string;
  legislatorName: string;
  party: string;
  open: boolean;
  onClose: () => void;
  onSelectBill: (billId: string, billName: string) => void;
}) {
  const query = useQuery<{ monaCode: string; bills: LegislatorVoteEntry[]; total: number }>({
    queryKey: ["/api/legislators", legislatorId, "voted-bills"],
    queryFn: () => fetch(`/api/legislators/${legislatorId}/voted-bills`).then((r) => r.json()),
    enabled: open && !!legislatorId,
    staleTime: 5 * 60 * 1000,
  });

  const bills = query.data?.bills ?? [];
  const ORDER = ["찬성", "반대", "기권", "불참", "알 수 없음"];
  const RESULT_COLORS: Record<string, string> = {
    찬성: "bg-blue-100 text-blue-700 border-blue-200",
    반대: "bg-red-100 text-red-700 border-red-200",
    기권: "bg-amber-100 text-amber-700 border-amber-200",
    불참: "bg-gray-100 text-gray-500 border-gray-200",
    "알 수 없음": "bg-gray-50 text-gray-400 border-gray-100",
  };

  const grouped = bills.reduce<Record<string, LegislatorVoteEntry[]>>((acc, b) => {
    const key = b.voteResult.includes("찬성") ? "찬성"
      : b.voteResult.includes("반대") ? "반대"
      : b.voteResult.includes("기권") ? "기권"
      : b.voteResult.includes("불참") ? "불참"
      : "알 수 없음";
    (acc[key] ??= []).push(b);
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors" data-testid="button-close-legislator-bills">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <SheetTitle className="text-base leading-tight">
                {legislatorName} 의원 표결 기록
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${partyColor(party)}`}>{party}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="px-5 py-4">
          {query.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              데이터를 불러오는 중...
            </div>
          )}

          {!query.isLoading && bills.length === 0 && (
            <div className="py-10 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">표결 기록이 없습니다</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">
                법안 상세 화면에서 '의원별 표결 현황'을 열면 해당 의원의 기록이 쌓입니다
              </p>
            </div>
          )}

          {bills.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">총 {bills.length}건의 표결 기록</p>
              {ORDER.map((result) => {
                const group = grouped[result] ?? [];
                if (group.length === 0) return null;
                return (
                  <div key={result}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${RESULT_COLORS[result]}`}>
                        {result} {group.length}건
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {group.map((b) => (
                        <button
                          key={b.billId}
                          onClick={() => {
                            onClose();
                            onSelectBill(b.billId, b.billName);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                          data-testid={`button-legislator-bill-${b.billId}`}
                        >
                          <p className="text-xs font-medium leading-snug line-clamp-2">{b.billName}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
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
    queryFn: () => fetch(`/api/bills/${billId}/member-votes`).then((r) => r.json()),
    enabled: open && !isDiscarded,
    staleTime: 12 * 60 * 60 * 1000,
    retry: 1,
  });

  const votes = query.data?.votes ?? [];
  const byResult = votes.reduce<Record<string, MemberVote[]>>((acc, v) => {
    const key = v.voteResult.includes("찬성") ? "찬성"
      : v.voteResult.includes("반대") ? "반대"
      : v.voteResult.includes("기권") ? "기권"
      : v.voteResult.includes("불참") ? "불참"
      : "알 수 없음";
    (acc[key] ??= []).push(v);
    return acc;
  }, {});

  const ORDER = ["찬성", "반대", "기권", "불참", "알 수 없음"];
  const ICONS: Record<string, ReactNode> = {
    찬성: <ThumbsUp className="w-3.5 h-3.5" />,
    반대: <ThumbsDown className="w-3.5 h-3.5" />,
    기권: <MinusCircle className="w-3.5 h-3.5" />,
    불참: <MinusCircle className="w-3.5 h-3.5" />,
    "알 수 없음": <MinusCircle className="w-3.5 h-3.5" />,
  };
  const COLORS: Record<string, string> = {
    찬성: "text-blue-600 bg-blue-50 border-blue-200",
    반대: "text-red-600 bg-red-50 border-red-200",
    기권: "text-amber-600 bg-amber-50 border-amber-200",
    불참: "text-gray-500 bg-gray-50 border-gray-200",
    "알 수 없음": "text-gray-400 bg-gray-50 border-gray-100",
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(!open)}
        data-testid="button-toggle-member-votes"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">의원별 표결 현황</span>
          {votes.length > 0 && (
            <Badge variant="secondary" className="text-xs">{votes.length}명</Badge>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {query.isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              국회 API에서 의원 표결 데이터를 가져오는 중입니다...
            </div>
          )}

          {query.isError && (
            <p className="text-xs text-red-500 text-center py-4">표결 데이터를 불러오지 못했습니다</p>
          )}

          {!query.isLoading && !query.isError && votes.length === 0 && (
            <div className="text-center py-5 space-y-1">
              {billResult === "폐기" || billResult.includes("폐기") ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">폐기된 법안입니다</p>
                  <p className="text-xs text-muted-foreground">본회의 표결 없이 폐기되어 의원별 표결 기록이 없습니다</p>
                </>
              ) : billResult === "계류" || billResult === "" ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">아직 표결이 진행되지 않은 법안입니다</p>
                  <p className="text-xs text-muted-foreground">본회의 표결이 완료되면 기록이 표시됩니다</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">이 법안에 대한 의원 표결 기록이 없습니다</p>
              )}
            </div>
          )}

          {votes.length > 0 && ORDER.map((result) => {
            const group = byResult[result] ?? [];
            if (group.length === 0) return null;
            const isExpanded = expanded[result] ?? false;
            const colorClass = COLORS[result as keyof typeof COLORS];
            return (
              <div key={result} className={`border rounded-xl overflow-hidden ${colorClass}`}>
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  onClick={() => setExpanded((e) => ({ ...e, [result]: !e[result] }))}
                >
                  <div className="flex items-center gap-2">
                    {ICONS[result as keyof typeof ICONS]}
                    <span className="font-semibold text-sm">{result}</span>
                    <span className="text-xs font-bold">{group.length}명</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 bg-white/60">
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {group.map((v) => (
                        <button
                          key={v.legislatorId || v.legislatorName}
                          onClick={() => onSelectLegislator(v.legislatorId, v.legislatorName, v.party)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-75 transition-opacity cursor-pointer ${partyColor(v.party)}`}
                          title={`${v.legislatorName} (${v.party}) - 클릭하면 표결 기록 보기`}
                          data-testid={`badge-vote-${v.legislatorId}`}
                        >
                          {v.legislatorName}
                          <span className="text-[9px] opacity-60">{v.party.replace("더불어민주당", "민주").replace("국민의힘", "국힘").replace("조국혁신당", "조혁").replace("개혁신당", "개혁").replace("진보당", "진보").replace("무소속", "무소")}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BillDetailSheet({
  bill,
  open,
  onClose,
  onSelectBill,
}: {
  bill: Bill | null;
  open: boolean;
  onClose: () => void;
  onSelectBill?: (billId: string, billName: string) => void;
}) {
  const [selectedLegislator, setSelectedLegislator] = useState<{ id: string; name: string; party: string } | null>(null);
  const isRealBill = !!bill && !bill.id.startsWith("api-bill-") && !bill.id.startsWith("b");

  const dbQuery = useQuery<BillDbDetail>({
    queryKey: ["/api/db/bills", bill?.id],
    queryFn: () =>
      fetch(`/api/db/bills/${bill!.id}`).then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      }),
    enabled: open && isRealBill,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  if (!bill) return null;

  const d = dbQuery.data;
  const committee = d?.committee || bill.summary || "";
  const result = d?.result || (bill.status === "통과" ? "가결" : bill.status === "폐기" ? "폐기" : "계류");

  const resultStyle = (r: string) => {
    if (r.includes("가결") || r === "통과") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (r.includes("부결") || r === "폐기") return "bg-red-100 text-red-700 border-red-200";
    return "bg-amber-100 text-amber-700 border-amber-200";
  };

  const yesCount = d?.yesCount ?? 0;
  const noCount = d?.noCount ?? 0;
  const abstainCount = d?.abstainCount ?? 0;
  const totalVotes = yesCount + noCount + abstainCount;

  const hasScores = d && (d.econScore !== null || d.socialScore !== null || d.envScore !== null);
  const description = !dbQuery.isLoading ? generateDescription(bill, d) : "";

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-0 pb-10"
      >
        <SheetHeader className="px-5 pb-3">
          <div className="flex items-start gap-2 mb-2">
            <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <SheetTitle className="text-base font-bold leading-snug text-left">
              {bill.name}
            </SheetTitle>
          </div>
          <Badge variant="outline" className={`self-start text-xs ${resultStyle(result)}`}>
            {result || "계류"}
          </Badge>
          <SheetDescription className="sr-only">법안 상세 정보 및 이념 성향 분석</SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="px-5 pt-4 space-y-4">
          {dbQuery.isLoading && isRealBill ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : (
            <>
              {description && (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 flex gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">발의일</p>
                  <p className="text-sm font-medium">{bill.proposedDate || "—"}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">법안 번호</p>
                  <p className="text-sm font-medium">{d?.billNo || "—"}</p>
                </div>
              </div>

              {committee && (
                <div className="bg-muted/50 rounded-xl p-3 flex items-start gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">소관 위원회</p>
                    <p className="text-sm font-medium">{committee}</p>
                  </div>
                </div>
              )}

              {bill.proposer && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">발의자</p>
                  <p className="text-sm font-medium leading-relaxed">{bill.proposer}</p>
                </div>
              )}

              {totalVotes > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground">
                      표결 결과 (총 {totalVotes}명)
                    </p>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-blue-700">{yesCount}</p>
                      <p className="text-[10px] text-blue-500">찬성</p>
                    </div>
                    <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-red-700">{noCount}</p>
                      <p className="text-[10px] text-red-500">반대</p>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-gray-500">{abstainCount}</p>
                      <p className="text-[10px] text-gray-400">기권/불출석</p>
                    </div>
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
                  <SpectrumBar
                    label="경제"
                    leftLabel="친기업 / 규제완화"
                    rightLabel="친노동 / 복지 / 증세"
                    score={hasScores ? d!.econScore : null}
                    leftColor="#3b82f6"
                    rightColor="#ef4444"
                  />
                  <SpectrumBar
                    label="사회"
                    leftLabel="보존 / 질서 / 안보"
                    rightLabel="변화 / 인권 / 소수자"
                    score={hasScores ? d!.socialScore : null}
                    leftColor="#8b5cf6"
                    rightColor="#ec4899"
                  />
                  <SpectrumBar
                    label="환경"
                    leftLabel="개발 / 성장 / 원전"
                    rightLabel="환경보존 / 친환경"
                    score={hasScores ? d!.envScore : null}
                    leftColor="#f59e0b"
                    rightColor="#22c55e"
                  />
                  {!hasScores && (
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      아직 분석된 성향 데이터가 없습니다
                    </p>
                  )}
                </div>
              </div>

              {isRealBill && (
                <MemberVotesSection
                  billId={bill.id}
                  billResult={result}
                  onSelectLegislator={(id, name, party) => setSelectedLegislator({ id, name, party })}
                />
              )}

              {isRealBill && (
                <a
                  href={`https://likms.assembly.go.kr/bill/billDetail.do?billId=${bill.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                  data-testid="link-bill-external"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  국회 원문 보기
                </a>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>

    {selectedLegislator && (
      <LegislatorBillsSheet
        legislatorId={selectedLegislator.id}
        legislatorName={selectedLegislator.name}
        party={selectedLegislator.party}
        open={!!selectedLegislator}
        onClose={() => setSelectedLegislator(null)}
        onSelectBill={(billId, billName) => {
          setSelectedLegislator(null);
          onSelectBill?.(billId, billName);
        }}
      />
    )}
    </>
  );
}

function BillCard({
  bill,
  onSelect,
  showEnactedBadge = false,
}: {
  bill: Bill;
  onSelect: (bill: Bill) => void;
  showEnactedBadge?: boolean;
}) {
  const statusColor = {
    통과: "bg-emerald-50 text-emerald-700",
    계류: "bg-amber-50 text-amber-700",
    폐기: "bg-red-50 text-red-700",
  };

  return (
    <Card
      data-testid={`card-bill-${bill.id}`}
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(bill)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <button
              className="text-left font-bold text-base hover:text-primary transition-colors leading-snug"
              data-testid={`button-bill-detail-${bill.id}`}
              onClick={(e) => { e.stopPropagation(); onSelect(bill); }}
            >
              {bill.name}
            </button>
          </div>
          <span className={`shrink-0 inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${statusColor[bill.status]}`}>
            {bill.status}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {bill.summary && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {bill.summary}
            </span>
          )}
          {bill.proposer && <span>발의: {bill.proposer}</span>}
          {bill.proposedDate && <span>{bill.proposedDate}</span>}
        </div>

        <p className="text-xs text-primary/60 mt-2">▸ 클릭해서 상세 정보 및 성향 분석 보기</p>
      </CardContent>
    </Card>
  );
}

function BillsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-5 w-3/4 mb-3" />
            <div className="flex gap-2 mb-3">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BillList({
  bills,
  isLoading,
  isError,
  searchQuery,
  onSelect,
  emptyMessage,
  loadingNote,
  showEnactedBadge = false,
}: {
  bills: Bill[];
  isLoading: boolean;
  isError?: boolean;
  searchQuery: string;
  onSelect: (b: Bill) => void;
  emptyMessage: string;
  loadingNote?: string;
  showEnactedBadge?: boolean;
}) {
  const filtered = searchQuery
    ? bills.filter(
        (b) =>
          b.name.includes(searchQuery) ||
          b.summary.includes(searchQuery) ||
          b.proposer.includes(searchQuery)
      )
    : bills;

  if (isLoading) return (
    <div>
      {loadingNote && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 p-3 bg-muted/50 rounded-xl">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          {loadingNote}
        </div>
      )}
      <BillsSkeleton />
    </div>
  );

  if (isError) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground text-sm">데이터를 불러오는 중 오류가 발생했습니다</p>
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="text-xs">전체 {filtered.length}건</Badge>
        {searchQuery && (
          <Badge variant="outline" className="text-xs">&ldquo;{searchQuery}&rdquo; 검색결과</Badge>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((bill) => (
            <BillCard key={bill.id} bill={bill} onSelect={onSelect} showEnactedBadge={showEnactedBadge} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground" data-testid="text-no-bill-results">{emptyMessage}</p>
          <p className="text-xs text-muted-foreground mt-1">다른 키워드로 검색해 보세요</p>
        </div>
      )}
    </>
  );
}

export default function BillSearch() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialQuery = params.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<"proposed" | "enacted">("proposed");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const { bills: proposedBills, isLoading: proposedLoading } = useAssemblyBills();
  const { bills: enactedBills, isLoading: enactedLoading, isError: enactedError } = useEnactedBills();

  useEffect(() => {
    const q = new URLSearchParams(search).get("q");
    if (q) setSearchQuery(q);
  }, [search]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 pb-24 min-h-screen bg-slate-50/30">
      <div className="mb-10 relative">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shadow-sm border border-primary/5">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900" data-testid="text-page-title-bills">법안 검색</h1>
              <p className="text-sm text-slate-500 font-medium mt-1">
                사회를 바꾸는 법안들을 확인하고 이념 성향 분석을 만나보세요
              </p>
            </div>
          </div>
          <LastUpdated />
        </div>
      </div>

      <div className="relative mb-8 group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
        </div>
        <Input
          type="search"
          placeholder="관심 있는 법안명, 위원회, 발의자를 검색해보세요"
          className="h-14 pl-12 pr-4 text-md rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all group-hover:shadow-md"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-bill-search"
        />
        {searchQuery && (
          <button 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setSearchQuery("")}
          >
            취소
          </button>
        )}
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(v) => setActiveTab(v as "proposed" | "enacted")} 
        className="space-y-8"
      >
        <div className="flex justify-center p-1 bg-slate-200/50 backdrop-blur-sm rounded-2xl w-fit mx-auto min-w-[320px]">
          <TabsList className="bg-transparent h-12 w-full gap-1">
            <TabsTrigger 
              value="proposed" 
              className="flex-1 h-full rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all gap-2"
              data-testid="tab-proposed-bills"
            >
              <Clock className="w-4 h-4" />
              심사 중인 법안
              <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1.5 opacity-60">22대</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="enacted" 
              className="flex-1 h-full rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all gap-2 text-slate-600"
              data-testid="tab-enacted-bills"
            >
              <CheckCircle2 className="w-4 h-4" />
              통과된 법안
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="proposed" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <BillList
            bills={proposedBills}
            isLoading={proposedLoading}
            searchQuery={searchQuery}
            onSelect={setSelectedBill}
            emptyMessage={searchQuery ? "검색 결과가 없습니다" : "로딩 중..."}
            loadingNote="국회 웹사이트의 최신 제안 법안들을 실시간으로 분석합니다"
          />
        </TabsContent>

        <TabsContent value="enacted" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <BillList
            bills={enactedBills}
            isLoading={enactedLoading}
            isError={enactedError}
            searchQuery={searchQuery}
            onSelect={setSelectedBill}
            emptyMessage={searchQuery ? "검색된 통과 법안이 없습니다" : "통과된 법안 정보를 불러오고 있습니다"}
            loadingNote="실제로 통과되어 법률이 된 국가 중요 법안 목록입니다"
            showEnactedBadge
          />
        </TabsContent>
      </Tabs>

      <BillDetailSheet
        bill={selectedBill}
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        onSelectBill={(billId, billName) => {
          setSelectedBill({
            id: billId,
            name: billName,
            summary: "",
            proposedDate: "",
            proposer: "",
            status: "통과",
            votes: [],
          });
        }}
      />
    </div>
  );
}
