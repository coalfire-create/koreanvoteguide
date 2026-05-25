// ===== 선거 모드 설정 =====
// 후보 등록 확정일(5/14)부터 자동으로 선거모드로 전환
export const ELECTION_START_DATE = new Date("2026-04-01T00:00:00+09:00"); // Temporarily set to April 1st for testing
export const ELECTION_DAY = new Date("2026-06-03T00:00:00+09:00");
export const PRE_VOTE_START = new Date("2026-05-29T06:00:00+09:00");

export function isElectionMode(): boolean {
  return true; // Force election mode for testing
}

export function getDaysUntilElection(): number {
  const diff = ELECTION_DAY.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function isPreVotePeriod(): boolean {
  const now = new Date();
  return now >= PRE_VOTE_START && now < ELECTION_DAY;
}

export function isElectionOver(): boolean {
  return new Date() >= ELECTION_DAY;
}

export function getElectionPhase(): "normal" | "campaign" | "pre-vote" | "done" {
  if (isElectionOver()) return "done";
  if (isPreVotePeriod()) return "pre-vote";
  if (isElectionMode()) return "campaign";
  return "normal";
}

// ===== 지방선거 선거 종류 =====
export const ELECTION_TYPES = [
  { code: "mayor",         label: "시·도지사" },
  { code: "edu",           label: "교육감" },
  { code: "district",      label: "구청장·시장·군수" },
  { code: "metro-council", label: "시·도의원" },
  { code: "local-council", label: "구·시·군의원" },
] as const;

export type ElectionTypeCode = typeof ELECTION_TYPES[number]["code"];

// ===== 시/도 목록 =====
export const REGIONS = [
  { code: "11", label: "서울특별시" },
  { code: "26", label: "부산광역시" },
  { code: "27", label: "대구광역시" },
  { code: "28", label: "인천광역시" },
  { code: "29", label: "광주광역시" },
  { code: "30", label: "대전광역시" },
  { code: "31", label: "울산광역시" },
  { code: "36", label: "세종특별자치시" },
  { code: "41", label: "경기도" },
  { code: "43", label: "충청북도" },
  { code: "44", label: "충청남도" },
  { code: "45", label: "전라북도" },
  { code: "46", label: "전라남도" },
  { code: "47", label: "경상북도" },
  { code: "48", label: "경상남도" },
  { code: "50", label: "제주특별자치도" },
  { code: "51", label: "강원특별자치도" },
] as const;
