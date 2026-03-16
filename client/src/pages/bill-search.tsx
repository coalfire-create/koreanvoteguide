import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Search, FileText, Loader2, ExternalLink, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssemblyBills } from "@/lib/api-data";
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

  const committee = dbQuery.data?.committee || bill.summary || "";
  const result = dbQuery.data?.result || bill.status || "";

  const resultStyle = (r: string) => {
    if (r.includes("가결") || r === "통과") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (r.includes("부결") || r === "폐기") return "bg-red-100 text-red-700 border-red-200";
    return "bg-amber-100 text-amber-700 border-amber-200";
  };

  const yesCount = dbQuery.data?.yesCount ?? 0;
  const noCount = dbQuery.data?.noCount ?? 0;
  const abstainCount = dbQuery.data?.abstainCount ?? 0;
  const totalVotes = yesCount + noCount + abstainCount;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[82vh] overflow-y-auto rounded-t-2xl px-0 pb-10"
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
        </SheetHeader>

        <Separator />

        <div className="px-5 pt-4 space-y-4">
          {dbQuery.isLoading && isRealBill ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">발의일</p>
                  <p className="text-sm font-medium">{bill.proposedDate || "—"}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">법안 번호</p>
                  <p className="text-sm font-medium">{dbQuery.data?.billNo || "—"}</p>
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
                    <div
                      className="bg-blue-400 h-full transition-all"
                      style={{ width: `${(yesCount / totalVotes) * 100}%` }}
                    />
                    <div
                      className="bg-red-400 h-full transition-all"
                      style={{ width: `${(noCount / totalVotes) * 100}%` }}
                    />
                  </div>
                </div>
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
  );
}

function BillCard({
  bill,
  onSelect,
}: {
  bill: Bill;
  onSelect: (bill: Bill) => void;
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
          <span
            className={`shrink-0 inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${statusColor[bill.status]}`}
          >
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
          {bill.proposer && (
            <span>발의: {bill.proposer}</span>
          )}
          {bill.proposedDate && (
            <span>{bill.proposedDate}</span>
          )}
        </div>

        <p className="text-xs text-primary/60 mt-2">
          ▸ 클릭해서 상세 정보 보기
        </p>
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

export default function BillSearch() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialQuery = params.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const { bills, isLoading } = useAssemblyBills();

  useEffect(() => {
    const q = new URLSearchParams(search).get("q");
    if (q) setSearchQuery(q);
  }, [search]);

  const filtered = searchQuery
    ? bills.filter(
        (b) =>
          b.name.includes(searchQuery) ||
          b.summary.includes(searchQuery) ||
          b.proposer.includes(searchQuery)
      )
    : bills;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-page-title-bills">
              법안 검색
            </h1>
          </div>
          <LastUpdated />
        </div>
        <p className="text-muted-foreground text-sm">
          법안을 검색하고 클릭해서 상세 정보를 확인하세요
        </p>
      </div>

      <div className="relative mb-6">
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

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="text-xs">
          전체 {filtered.length}건
        </Badge>
        {searchQuery && (
          <Badge variant="outline" className="text-xs">
            &ldquo;{searchQuery}&rdquo; 검색결과
          </Badge>
        )}
      </div>

      {isLoading ? (
        <BillsSkeleton />
      ) : (
        <div className="space-y-4">
          {filtered.map((bill) => (
            <BillCard key={bill.id} bill={bill} onSelect={setSelectedBill} />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground" data-testid="text-no-bill-results">
            검색 결과가 없습니다
          </p>
          <p className="text-xs text-muted-foreground mt-1">다른 키워드로 검색해 보세요</p>
        </div>
      )}

      <BillDetailSheet
        bill={selectedBill}
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
      />
    </div>
  );
}
