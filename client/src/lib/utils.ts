import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** ISO / YYYYMMDD 날짜 문자열 → "N분 전" / "N시간 전" / "N일 전" / "M월 D일" */
export function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const normalized =
    dateStr.length === 8
      ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      : dateStr;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateStr;
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/** 정당명 → 차트/SVG 용 hex 색상 */
export function getPartyHex(party: string): string {
  if (party?.includes("민주당")) return "#3A6BFF";
  if (party?.includes("국민의힘")) return "#FF3B3B";
  if (party?.includes("조국혁신당")) return "#1e3a8a";
  if (party?.includes("개혁신당")) return "#FF8C00";
  if (party?.includes("진보당")) return "#D60024";
  return "#6D28D9";
}

/** 정당명 → Tailwind 텍스트+배경 클래스 (인라인 배지용) */
export function getPartyTextBg(party: string | null | undefined): string {
  if (!party) return "text-gray-500 bg-gray-50";
  if (party.includes("민주당")) return "text-[#3A6BFF] bg-blue-50";
  if (party.includes("국민의힘")) return "text-[#FF3B3B] bg-red-50";
  if (party.includes("조국혁신당")) return "text-blue-800 bg-blue-50";
  if (party.includes("개혁신당")) return "text-[#FF8C00] bg-orange-50";
  if (party.includes("진보당")) return "text-[#D60024] bg-red-50";
  if (party.includes("무소속")) return "text-gray-500 bg-gray-50";
  return "text-gray-600 bg-gray-50";
}

export function getBillEmoji(billName: string, committee?: string): string {
  return "";
}

export function getBillInitial(billName: string, committee?: string): string {
  const text = (billName + " " + (committee || "")).toLowerCase();
  
  if (text.includes("보건") || text.includes("의료") || text.includes("병원") || text.includes("간호")) return "의료";
  if (text.includes("경제") || text.includes("재정") || text.includes("금융") || text.includes("예산") || text.includes("기획재정")) return "경제";
  if (text.includes("환경") || text.includes("기후") || text.includes("에너지") || text.includes("탄소")) return "환경";
  if (text.includes("교육") || text.includes("학교") || text.includes("학생") || text.includes("교사")) return "교육";
  if (text.includes("국방") || text.includes("군사") || text.includes("안보") || text.includes("병역")) return "국방";
  if (text.includes("행정") || text.includes("지방") || text.includes("자치")) return "행정";
  if (text.includes("법제") || text.includes("사법") || text.includes("검찰") || text.includes("경찰") || text.includes("인권")) return "법사";
  if (text.includes("문화") || text.includes("체육") || text.includes("관광") || text.includes("예술") || text.includes("방송") || text.includes("언론")) return "문화";
  if (text.includes("과학") || text.includes("기술") || text.includes("정보") || text.includes("통신") || text.includes("디지털") || text.includes("ai")) return "IT";
  if (text.includes("복지") || text.includes("노인") || text.includes("장애인") || text.includes("아동") || text.includes("가족") || text.includes("여성")) return "복지";
  if (text.includes("교통") || text.includes("건설") || text.includes("국토") || text.includes("주택") || text.includes("부동산")) return "국토";
  if (text.includes("농림") || text.includes("축산") || text.includes("식품") || text.includes("해양") || text.includes("수산")) return "농림";
  if (text.includes("노동") || text.includes("고용") || text.includes("근로")) return "노동";
  if (text.includes("정치") || text.includes("국회") || text.includes("선거")) return "정치";
  if (text.includes("외교") || text.includes("통일")) return "외교";

  return "일반";
}
