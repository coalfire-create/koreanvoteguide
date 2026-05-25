import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs);
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

const PARTY_COLORS: Record<string, string> = {
  "더불어민주당": "#1D4ED8",
  "국민의힘": "#DC2626",
  "조국혁신당": "#7C3AED",
  "개혁신당": "#EA580C",
  "진보당": "#D97706",
};

export function getPartyColor(party: string | null | undefined): string {
  if (!party) return "#6B7280";
  return PARTY_COLORS[party] ?? "#6B7280";
}

export function getPartyTextBg(party: string | null | undefined): string {
  const color = getPartyColor(party);
  return color;
}
