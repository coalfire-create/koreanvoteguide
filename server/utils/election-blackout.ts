// 공직선거법 §108 — 선거일 전 6일부터 투표 마감 시각까지 여론조사 결과 공표·인용 금지.
// 자체 운영 지지율 투표/지지율 표시도 사실상 여론조사로 해석될 여지가 있어 동일 기간 차단한다.
//
// 환경변수로 선거일을 주입한다(예: ELECTION_DAY=2026-06-03). 미설정 시 차단하지 않는다.
// 시간대는 한국 표준시(KST, UTC+9) 기준.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parseElectionDay(): Date | null {
  const raw = process.env.ELECTION_DAY?.trim();
  if (!raw) return null;
  const d = new Date(raw + (raw.length === 10 ? "T00:00:00+09:00" : ""));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * 여론조사 결과 공표 금지 기간인지 판정한다.
 * - 시작: 선거일 6일 전 00:00 KST (예: 선거일이 6/3이면 5/28 00:00 KST부터)
 * - 종료: 선거일 18:00 KST (지방선거 투표 마감 시각)
 */
export function isPollPublicationBlackout(now: Date = new Date()): boolean {
  const electionDay = parseElectionDay();
  if (!electionDay) return false;

  const start = new Date(electionDay.getTime() - 6 * 24 * 60 * 60 * 1000);
  const end = new Date(electionDay.getTime() + 18 * 60 * 60 * 1000);
  return now >= start && now < end;
}

export function describeBlackoutWindow(): { start: string; end: string } | null {
  const electionDay = parseElectionDay();
  if (!electionDay) return null;
  const start = new Date(electionDay.getTime() - 6 * 24 * 60 * 60 * 1000);
  const end = new Date(electionDay.getTime() + 18 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

void KST_OFFSET_MS;
