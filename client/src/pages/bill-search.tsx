import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bills, getVoteBgColor, getPartyColor } from "@/lib/mock-data";

function BillCard({ bill }: { bill: typeof bills[0] }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = {
    "통과": "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    "계류": "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "폐기": "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  };

  const voteCounts = {
    "찬성": bill.votes.filter((v) => v.vote === "찬성").length,
    "반대": bill.votes.filter((v) => v.vote === "반대").length,
    "불출석": bill.votes.filter((v) => v.vote === "불출석").length,
    "미참석": bill.votes.filter((v) => v.vote === "미참석").length,
  };

  return (
    <Card data-testid={`card-bill-${bill.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-base" data-testid={`text-bill-name-${bill.id}`}>{bill.name}</h3>
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${statusColor[bill.status]}`}>
                {bill.status}
              </span>
              <span className="text-xs text-muted-foreground">발의일: {bill.proposedDate}</span>
              <span className="text-xs text-muted-foreground">발의자: {bill.proposer}</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{bill.summary}</p>

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span className="text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-md">
            찬성 {voteCounts["찬성"]}
          </span>
          <span className="text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded-md">
            반대 {voteCounts["반대"]}
          </span>
          <span className="text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-md">
            불출석 {voteCounts["불출석"]}
          </span>
          <span className="text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md">
            미참석 {voteCounts["미참석"]}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
          data-testid={`button-expand-bill-${bill.id}`}
        >
          {expanded ? (
            <>투표 현황 접기 <ChevronUp className="w-4 h-4 ml-1" /></>
          ) : (
            <>의원별 투표 현황 보기 <ChevronDown className="w-4 h-4 ml-1" /></>
          )}
        </Button>

        {expanded && (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>의원명</TableHead>
                  <TableHead>정당</TableHead>
                  <TableHead className="text-center">투표</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.votes.map((vote) => (
                  <TableRow key={vote.memberId} data-testid={`row-bill-vote-${bill.id}-${vote.memberId}`}>
                    <TableCell className="font-medium">{vote.memberName}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className={`w-2 h-2 rounded-full ${getPartyColor(vote.party)}`} />
                        {vote.party}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${getVoteBgColor(vote.vote)}`}>
                        {vote.vote}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BillSearch() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialQuery = params.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);

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
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title-bills">법안 검색</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          법안을 검색하고 의원별 투표 현황을 확인하세요
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="법안명, 내용, 발의자로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-bill-search"
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="text-xs">전체 {filtered.length}건</Badge>
        {searchQuery && (
          <Badge variant="outline" className="text-xs">
            &ldquo;{searchQuery}&rdquo; 검색결과
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {filtered.map((bill) => (
          <BillCard key={bill.id} bill={bill} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground" data-testid="text-no-bill-results">검색 결과가 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">다른 키워드로 검색해 보세요</p>
        </div>
      )}
    </div>
  );
}
