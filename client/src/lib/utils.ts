import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBillEmoji(billName: string, committee?: string): string {
  const text = (billName + " " + (committee || "")).toLowerCase();
  
  if (text.includes("보건") || text.includes("의료") || text.includes("병원") || text.includes("간호")) return "🏥";
  if (text.includes("경제") || text.includes("재정") || text.includes("금융") || text.includes("예산") || text.includes("기획재정")) return "💰";
  if (text.includes("환경") || text.includes("기후") || text.includes("에너지") || text.includes("탄소")) return "🌿";
  if (text.includes("교육") || text.includes("학교") || text.includes("학생") || text.includes("교사")) return "🎓";
  if (text.includes("국방") || text.includes("군사") || text.includes("안보") || text.includes("병역")) return "🎖️";
  if (text.includes("행정") || text.includes("지방") || text.includes("자치")) return "🏛️";
  if (text.includes("법제") || text.includes("사법") || text.includes("검찰") || text.includes("경찰") || text.includes("인권")) return "⚖️";
  if (text.includes("문화") || text.includes("체육") || text.includes("관광") || text.includes("예술") || text.includes("방송") || text.includes("언론")) return "🎨";
  if (text.includes("과학") || text.includes("기술") || text.includes("정보") || text.includes("통신") || text.includes("디지털") || text.includes("ai")) return "🧪";
  if (text.includes("복지") || text.includes("노인") || text.includes("장애인") || text.includes("아동") || text.includes("가족") || text.includes("여성")) return "🧸";
  if (text.includes("교통") || text.includes("건설") || text.includes("국토") || text.includes("주택") || text.includes("부동산")) return "🏗️";
  if (text.includes("농림") || text.includes("축산") || text.includes("식품") || text.includes("해양") || text.includes("수산")) return "🌾";
  if (text.includes("노동") || text.includes("고용") || text.includes("근로")) return "👷";
  if (text.includes("정치") || text.includes("국회") || text.includes("선거")) return "🗳️";
  if (text.includes("외교") || text.includes("통일")) return "🌐";

  return "📄"; // Default emoji
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
