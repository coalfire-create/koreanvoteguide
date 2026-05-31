import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { AssemblyMember, Bill } from "@shared/schema";
import { assemblyMembers as mockMembers, bills as mockBills, candidates as mockCandidates } from "./mock-data";

interface ApiResponse<T> {
  source: "api" | "mock" | "cache" | "db";
  data: T | null;
}

function transformApiMembers(raw: any[]): AssemblyMember[] {
  const memberMap = new Map<string, AssemblyMember>();

  for (const row of raw) {
    const id = row.MONA_CD || row.HG_NM || "";
    if (!memberMap.has(id)) {
      memberMap.set(id, {
        id,
        name: row.HG_NM || "",
        party: row.POLY_NM || "",
        district: row.ORIG_NM || "비례대표",
        photo: row.HG_NM_A ? `https://open.assembly.go.kr/portal/assm/assmpic/${row.HG_NM_A}` : "",
        electedYear: parseInt(row.ELECT_GBN_NM || "0") || new Date().getFullYear(),
        committee: row.CMIT_NM || "",
        votingRecords: [],
        activities: [],
        score: {
          attendanceRate: 0,
          billProposalCount: 0,
          votingParticipationRate: 0,
          totalScore: 0,
        },
      });
    }
  }

  return Array.from(memberMap.values());
}

function transformDbMembers(raw: any[]): AssemblyMember[] {
  return raw.map((row) => ({
    id: row.monaCd || row.id || "",
    name: row.name || "",
    party: row.party || "",
    district: row.district || "비례대표",
    photo: row.photoUrl || "",
    electedYear: row.electedYear || new Date().getFullYear(),
    committee: row.committee || "",
    votingRecords: [],
    activities: [],
    score: {
      attendanceRate: 0,
      billProposalCount: 0,
      votingParticipationRate: 0,
      totalScore: 0,
    },
  }));
}

function transformApiBills(raw: any[]): Bill[] {
  return raw.map((row, i) => {
    let status: "통과" | "계류" | "폐기" = "계류";
    const result = row.PROC_RESULT || row.PROC_RESULT_CD || row.RGS_PROC_RESULT_CD || "";
    if (result.includes("가결") || result.includes("통과")) status = "통과";
    else if (result.includes("폐기") || result.includes("부결")) status = "폐기";

    return {
      id: row.BILL_ID || `api-bill-${i}`,
      name: row.BILL_NM || row.BILL_NAME || "",
      summary: row.COMMITTEE || row.COMMITTEE_NM || "",
      proposedDate: row.PROPOSE_DT || row.PROC_DT || "",
      proposer: row.RST_PROPOSER || row.PROPOSER || "",
      status,
      votes: [],
    };
  });
}

function transformDbBills(raw: any[]): Bill[] {
  return raw.map((row) => {
    let status: "통과" | "계류" | "폐기" = "계류";
    const result = row.result || "";
    if (result.includes("가결") || result.includes("통과")) status = "통과";
    else if (result.includes("폐기") || result.includes("부결")) status = "폐기";

    return {
      id: row.billId || row.bill_id || "",
      name: row.billName || row.bill_name || "",
      summary: row.committee || "",
      proposedDate: row.proposeDate || row.propose_date || "",
      proposer: row.proposer || "",
      status,
      votes: [],
    };
  });
}

export function useAssemblyMembers() {
  const membersQuery = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/members"],
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const attendanceQuery = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/attendance"],
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const members = useMemo(() => {
    const membersData = membersQuery.data?.data;
    const source = membersQuery.data?.source;

    let apiMembers: AssemblyMember[] | null = null;
    if (membersData && membersData.length > 0) {
      if (source === "db") {
        apiMembers = transformDbMembers(membersData);
      } else if (source === "api") {
        apiMembers = transformApiMembers(membersData);
      }
    }

    if (apiMembers && apiMembers.length > 0 && attendanceQuery.data?.data) {
      const attendanceData = attendanceQuery.data.data;
      for (const member of apiMembers) {
        const att = attendanceData.find((a: any) => a.HG_NM === member.name);
        if (att) {
          const attend = parseInt(att.ATTEND_CNT || att.ATTEND || "0");
          const total = parseInt(att.TOTAL_CNT || att.ALLDAY || "1");
          member.score.attendanceRate = total > 0 ? Math.round((attend / total) * 100) : 0;
          const attendance = member.score.attendanceRate * 0.7;
          const billScore = Math.min(100, member.score.billProposalCount * 5) * 0.3;
          member.score.totalScore = Math.round(attendance + billScore);
        }
      }
    }

    return apiMembers && apiMembers.length > 0 ? apiMembers : mockMembers;
  }, [membersQuery.data, attendanceQuery.data]);

  return {
    members,
    isLoading: membersQuery.isLoading,
    isApi: membersQuery.data?.data != null && membersQuery.data.data.length > 0,
  };
}

export function useAssemblyBills() {
  const query = useQuery<any>({
    queryKey: ["/api/bills"],
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const bills = useMemo(() => {
    const raw = query.data;
    if (!raw) return mockBills;

    // /api/bills returns a raw array of DB rows
    const billsData: any[] | null = Array.isArray(raw) ? raw : (raw?.data ?? null);
    const source: string = Array.isArray(raw) ? "db" : (raw?.source ?? "db");

    let apiBills: Bill[] | null = null;
    if (billsData && billsData.length > 0) {
      apiBills = source === "db" ? transformDbBills(billsData) : transformApiBills(billsData);
    }
    return apiBills && apiBills.length > 0 ? apiBills : mockBills;
  }, [query.data]);

  return {
    bills,
    isLoading: query.isLoading,
    isApi: Array.isArray(query.data) ? query.data.length > 0 : (query.data?.data?.length > 0),
  };
}

export function useEnactedBills() {
  const query = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/bills/enacted"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const bills = useMemo<Bill[]>(() => {
    const data = query.data?.data ?? [];
    const source = query.data?.source;
    return data.length > 0
      ? (source === "db" ? transformDbBills(data) : transformApiBills(data))
      : [];
  }, [query.data]);

  return {
    bills,
    isLoading: query.isLoading,
    isError: query.isError,
    count: bills.length,
  };
}

export function useCandidates() {
  return {
    candidates: mockCandidates,
    isLoading: false,
    isApi: false,
  };
}

// ===== 의원 상세 정보 (선관위 22대 총선: 재산/학력/전과/경력) =====

export interface LegislatorDetail {
  monaCd: string;
  name: string;
  party: string;
  district: string;
  photoUrl: string;
  committee: string;
  electedTerm: number;
  propertyAmount: string;         // "12억 3,456만원" or "정보 없음"
  education: string;              // 최종 학력 or "정보 없음"
  criminalRecord: string | null;  // null = 전과 없음
  criminalCount: number;
  career: string;
  necDetailSyncedAt: string | null;
  // 국회 API 추가 필드
  email: string | null;
  telNo: string | null;
  homepage: string | null;
  twitter: string | null;
  facebook: string | null;
  youtube: string | null;
  blog: string | null;
  instagram: string | null;
  birthDate: string | null;
  gender: string | null;
  reelectionGbn: string | null;   // 초선/재선/삼선 등
  committees: string | null;      // 전체 위원회 목록
  memTitle: string | null;        // 의원 경력 원문
  assemblyAddr: string | null;    // 의원실 주소
  // 공직자윤리위원회 재산 상세 (단위: 만원)
  propertyLand: number | null;
  propertyBuilding: number | null;
  propertyDeposit: number | null;
  propertyStock: number | null;
  propertyDebt: number | null;
  propertyDetailSyncedAt: string | null;
}

export function useMemberDetail(monaCd: string | undefined) {
  const query = useQuery<{ source: string; data: LegislatorDetail; hasNecData: boolean }>({
    queryKey: ["/api/legislators", monaCd, "detail"],
    queryFn: () =>
      fetch(`/api/legislators/${monaCd}/detail`).then((r) => {
        if (!r.ok) throw new Error("의원 상세 정보를 불러올 수 없습니다.");
        return r.json();
      }),
    enabled: !!monaCd,
    staleTime: 24 * 60 * 60 * 1000, // 24시간 (선관위 데이터는 자주 안 바뀜)
    retry: 1,
  });

  return {
    detail: query.data?.data ?? null,
    hasNecData: query.data?.hasNecData ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export interface LegislatorAnalysisResult {
  legislatorId: string;
  analyzedAt: string;
  totalVotesConsidered: number;
  meaningfulVotesCount: number;
  topCategories: {
    category: string;
    percentage: number;
    billCount: number;
    weightedCount: number;
  }[];
  valueAxes: {
    id: "economy" | "government";
    label: string;
    score: number;
    leftLabel: string;
    rightLabel: string;
    description: string;
  }[];
  summaryText: string;
  keyBills: {
    billId: string;
    billName: string;
    committee: string;
    controversyWeight: number;
    vote: "찬성" | "반대";
    category: string;
    impactScore: number;
    date: string;
  }[];
  confidence: "high" | "medium" | "low";
}

export function useLegislatorAnalysis(monaCd: string | undefined) {
  const query = useQuery<LegislatorAnalysisResult>({
    queryKey: ["/api/members", monaCd, "analysis"],
    queryFn: () =>
      fetch(`/api/members/${monaCd}/analysis`).then((r) => {
        if (!r.ok) throw new Error("분석 정보를 불러올 수 없습니다.");
        return r.json();
      }),
    enabled: !!monaCd,
    staleTime: 60 * 60 * 1000,
  });

  return {
    analysis: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useMemberAlumni(monaCd: string | undefined) {
  const query = useQuery<{ alumni: any[]; university: string | null }>({
    queryKey: ["/api/legislators", monaCd, "alumni"],
    queryFn: () =>
      fetch(`/api/legislators/${monaCd}/alumni`).then((r) => {
        if (!r.ok) throw new Error("동문 의원 정보를 불러올 수 없습니다.");
        return r.json();
      }),
    enabled: !!monaCd,
    staleTime: 24 * 60 * 60 * 1000,
  });

  return {
    alumni: query.data?.alumni ?? [],
    university: query.data?.university ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}



export function useSchedulerStatus() {
  const query = useQuery<{
    lastRun: string | null;
    success: boolean | null;
    message: string;
    consecutiveFailures: number;
  }>({
    queryKey: ["/api/status"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  return {
    status: query.data,
    isLoading: query.isLoading,
  };
}

// ===== 인기 법안 (Hot Score: viewCount + voteCount + newsMentionCount 기반) =====
export function usePopularBill() {
  const query = useQuery<any[]>({
    queryKey: ["/api/bills/hot"],
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetch("/api/bills/hot").then((r) => r.json()),
  });

  return {
    bill: query.data?.[0] ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// ===== 인기 법안 Top 5 (Hot Score DB 컬럼 기반 — 실시간 스크래핑 없음) =====
export function useHotBills() {
  const query = useQuery<any[]>({
    queryKey: ["/api/bills/hot"],
    staleTime: 10 * 60 * 1000,
    // r.ok 를 검사해 비정상 응답은 throw → 기본 retry(지수 백오프) 가 동작하도록.
    queryFn: () =>
      fetch("/api/bills/hot").then((r) => {
        if (!r.ok) throw new Error(`인기 법안을 불러올 수 없습니다 (${r.status})`);
        return r.json();
      }),
  });

  return {
    bills: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// ===== 검색 히스토리 =====
export function useSearchHistory() {
  const query = useQuery<{ id: number; query: string; createdAt: string }[]>({
    queryKey: ["/api/search-history"],
    queryFn: () => fetch("/api/search-history").then((r) => r.json()),
    staleTime: 30 * 1000,
  });

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
  };
}

// 검색어 서버 저장 (컴포넌트 외부에서 호출 가능)
export async function saveSearchQuery(query: string) {
  if (!query || query.trim().length === 0) return;
  try {
    await fetch("/api/search-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    });
  } catch (e) {
    // 조용히 실패 허용
  }
}

// 검색어 전체 삭제
export async function clearSearchHistory() {
  await fetch("/api/search-history", { method: "DELETE" });
}

// 검색어 개별 삭제
export async function deleteSearchHistoryItem(id: number) {
  await fetch(`/api/search-history/${id}`, { method: "DELETE" });
}

// ===== 선거 후보자 실시간 지지율 =====
interface SupportRate {
  candidateId: string;
  name: string;
  party: string;
  voteCount: number;
  rate: number;
}

export function useSupportRates(regionCode: string | undefined) {
  const query = useQuery<{ rates: SupportRate[]; total: number }>({
    queryKey: ["/api/election/support-rates", regionCode],
    queryFn: () => fetch(`/api/election/support-rates/${regionCode}`).then((r) => r.json()),
    enabled: !!regionCode,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // 1분마다 갱신
  });

  return {
    rates: query.data?.rates ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
  };
}

// 지지 투표 전송
export async function castSupportVote(candidateId: string): Promise<{ success: boolean; action?: string; error?: string }> {
  try {
    const res = await fetch("/api/election/support-votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId }),
    });
    return res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
