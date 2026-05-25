import { Share, Alert } from "react-native";

const APP_SCHEME = "antigravity";
const APP_NAME = "이유있는 투표";

export type ShareTarget = "member" | "post" | "bill" | "candidate";

interface ShareMemberOptions {
  id: string;
  name: string;
  party: string;
  district: string;
  promises?: { title: string }[];
}

interface SharePostOptions {
  id: string;
  title: string;
  content?: string;
  authorName?: string;
}

interface ShareBillOptions {
  id: string;
  name: string;
  status: string;
  proposer?: string;
  summary?: string;
}

interface ShareCandidateOptions {
  id: string | number;
  name: string;
  party: string;
  region: string;
  promises?: { title: string }[];
}

function partyEmoji(party: string): string {
  if (party.includes("더불어민주당")) return "🔵";
  if (party.includes("국민의힘")) return "🔴";
  if (party.includes("조국혁신당")) return "🟣";
  if (party.includes("개혁신당")) return "🟠";
  return "⚫";
}

function statusEmoji(status: string): string {
  if (status === "통과") return "✅";
  if (status === "폐기") return "❌";
  return "⏳";
}

// ─── 의원 공유 ────────────────────────────────────────────────────
export async function shareMember(opts: ShareMemberOptions) {
  const emoji = partyEmoji(opts.party);
  const topPromises = (opts.promises ?? []).slice(0, 3);

  const promiseLines = topPromises.length > 0
    ? "\n\n📋 주요 공약\n" + topPromises.map((p, i) => `${i + 1}. ${p.title}`).join("\n")
    : "";

  const message = [
    `${emoji} ${opts.name} 의원`,
    `${opts.party} · ${opts.district}`,
    promiseLines,
    `\n🗳️ ${APP_NAME} 앱에서 더 자세히 보기`,
    `antigravity://members/${opts.id}`,
  ].join("\n");

  try {
    await Share.share({ message, title: `${opts.name} 의원 정보 공유` });
  } catch (e: any) {
    if (e.message !== "The user did not share") Alert.alert("공유 실패", e.message);
  }
}

// ─── 게시글 공유 ──────────────────────────────────────────────────
export async function sharePost(opts: SharePostOptions) {
  const preview = opts.content
    ? opts.content.slice(0, 80) + (opts.content.length > 80 ? "..." : "")
    : "";

  const message = [
    `💬 ${opts.title}`,
    opts.authorName ? `by ${opts.authorName}` : "",
    preview ? `\n${preview}` : "",
    `\n🗳️ ${APP_NAME} 커뮤니티에서 보기`,
    `antigravity://community/${opts.id}`,
  ].filter(Boolean).join("\n");

  try {
    await Share.share({ message, title: opts.title });
  } catch (e: any) {
    if (e.message !== "The user did not share") Alert.alert("공유 실패", e.message);
  }
}

// ─── 법안 공유 ────────────────────────────────────────────────────
export async function shareBill(opts: ShareBillOptions) {
  const emoji = statusEmoji(opts.status);

  const message = [
    `📜 ${opts.name}`,
    `${emoji} ${opts.status}${opts.proposer ? ` · 발의: ${opts.proposer}` : ""}`,
    opts.summary ? `\n${opts.summary.slice(0, 100)}` : "",
    `\n🗳️ ${APP_NAME} 앱에서 법안 상세 보기`,
    `antigravity://bills/${opts.id}`,
  ].filter(Boolean).join("\n");

  try {
    await Share.share({ message, title: opts.name });
  } catch (e: any) {
    if (e.message !== "The user did not share") Alert.alert("공유 실패", e.message);
  }
}

// ─── 후보자 공유 ──────────────────────────────────────────────────
export async function shareCandidate(opts: ShareCandidateOptions) {
  const emoji = partyEmoji(opts.party);
  const topPromises = (opts.promises ?? []).slice(0, 3);

  const promiseLines = topPromises.length > 0
    ? "\n\n📋 주요 공약\n" + topPromises.map((p, i) => `${i + 1}. ${p.title}`).join("\n")
    : "";

  const message = [
    `${emoji} ${opts.name} 후보`,
    `${opts.party} · ${opts.region}`,
    promiseLines,
    `\n🗳️ ${APP_NAME} 앱에서 공약 비교하기`,
    `antigravity://city-select`,
  ].join("\n");

  try {
    await Share.share({ message, title: `${opts.name} 후보 공약 공유` });
  } catch (e: any) {
    if (e.message !== "The user did not share") Alert.alert("공유 실패", e.message);
  }
}
