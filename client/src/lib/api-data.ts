import { useQuery } from "@tanstack/react-query";
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
    photo: row.photo || "",
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
    staleTime: 5 * 60 * 1000,
  });

  const attendanceQuery = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/attendance"],
    staleTime: 5 * 60 * 1000,
  });

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

  if (apiMembers && apiMembers.length > 0 && attendanceQuery.data?.source === "api" && attendanceQuery.data.data) {
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

  const members = apiMembers && apiMembers.length > 0 ? apiMembers : mockMembers;

  return {
    members,
    isLoading: membersQuery.isLoading,
    isApi: apiMembers !== null && apiMembers.length > 0,
  };
}

export function useAssemblyBills() {
  const query = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/bills"],
    staleTime: 5 * 60 * 1000,
  });

  const billsData = query.data?.data;
  const source = query.data?.source;

  let apiBills: Bill[] | null = null;
  if (billsData && billsData.length > 0) {
    if (source === "db") {
      apiBills = transformDbBills(billsData);
    } else if (source === "api") {
      apiBills = transformApiBills(billsData);
    }
  }

  const bills = apiBills && apiBills.length > 0 ? apiBills : mockBills;

  return {
    bills,
    isLoading: query.isLoading,
    isApi: apiBills !== null && apiBills.length > 0,
  };
}

export function useEnactedBills() {
  const query = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/bills/enacted"],
    staleTime: 30 * 60 * 1000,
  });

  const data = query.data?.data ?? [];
  const source = query.data?.source;

  const bills: Bill[] = data.length > 0
    ? (source === "db" ? transformDbBills(data) : transformApiBills(data))
    : [];

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
