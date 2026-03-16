import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, FileText, Loader2, ExternalLink, Users, Building2, Info, CheckCircle2, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssemblyBills, useEnactedBills } from "@/lib/api-data";
import { useQuery } from "@tanstack/react-query";
import { LastUpdated } from "@/components/last-updated";
import type { Bill } from "@shared/schema";

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

function BillDetailSheet({
  bill,
  open,
  onClose,
}: {
  bill: Bill | null;
  open: boolean;
  onClose: () => void;
}) {
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
  const result = d?.result || (bill.status === "통과" ? "가결" : bill.status === "폐기" ? "부결" : "계류");

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
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-page-title-bills">법안 검색</h1>
          </div>
          <LastUpdated />
        </div>
        <p className="text-muted-foreground text-sm">
          법안을 클릭해서 설명과 이념 성향 분석을 확인하세요
        </p>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="법안명, 위원회, 발의자로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-bill-search"
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "proposed" | "enacted")} className="w-full">
        <TabsList className="w-full mb-5 grid grid-cols-2">
          <TabsTrigger value="proposed" className="flex items-center gap-1.5" data-testid="tab-proposed-bills">
            <Clock className="w-3.5 h-3.5" />
            심사 중인 법안
          </TabsTrigger>
          <TabsTrigger value="enacted" className="flex items-center gap-1.5" data-testid="tab-enacted-bills">
            <CheckCircle2 className="w-3.5 h-3.5" />
            통과된 법안
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposed">
          <BillList
            bills={proposedBills}
            isLoading={proposedLoading}
            searchQuery={searchQuery}
            onSelect={setSelectedBill}
            emptyMessage="검색 결과가 없습니다"
          />
        </TabsContent>

        <TabsContent value="enacted">
          <BillList
            bills={enactedBills}
            isLoading={enactedLoading}
            isError={enactedError}
            searchQuery={searchQuery}
            onSelect={setSelectedBill}
            emptyMessage="통과된 법안이 없습니다"
            loadingNote="국회 API에서 통과된 법안을 불러오는 중입니다. 잠시만 기다려주세요..."
            showEnactedBadge
          />
        </TabsContent>
      </Tabs>

      <BillDetailSheet
        bill={selectedBill}
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
      />
    </div>
  );
}
