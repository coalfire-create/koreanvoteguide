// 본인확인기관(PASS/NICE/PortOne 등)이 돌려주는 생년월일을 만나이/연령대로 변환.
// - 만나이는 "올해 생일이 지났는가"로 +1/+0 보정. 한국 나이 아님.
// - ageGroup은 10대=10, 20대=20, ..., 60대 이상=60. 본 앱은 14+ 가입 제한이라 음수/0은 발생하지 않는 전제.

export interface ParsedBirthDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

// "YYYYMMDD" 또는 "YYYY-MM-DD" 모두 허용. 형식이 깨졌으면 null.
export function parseBirthDate(input: string | null | undefined): ParsedBirthDate | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // 실재하는 날짜인지 검증 (예: 2월 30일 차단)
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

// 만나이 계산. 오늘 날짜 기준, 생일이 지났으면 currentYear - birthYear, 아니면 -1.
// referenceDate 인자는 테스트용 — 기본은 new Date().
export function calculateAge(birthDateStr: string | null | undefined, referenceDate: Date = new Date()): number | null {
  const parsed = parseBirthDate(birthDateStr);
  if (!parsed) return null;

  const today = referenceDate;
  let age = today.getFullYear() - parsed.year;

  const monthDiff = today.getMonth() + 1 - parsed.month;
  const dayDiff = today.getDate() - parsed.day;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

// 연령대 버킷: 10대=10, 20대=20, ..., 60대 이상=60.
// 0~9세는 본 앱 가입 불가 영역이지만 안전을 위해 0 반환 (호출측에서 필터 가능).
export function calculateAgeGroup(birthDateStr: string | null | undefined, referenceDate: Date = new Date()): number | null {
  const age = calculateAge(birthDateStr, referenceDate);
  if (age === null) return null;
  if (age >= 60) return 60;
  return Math.floor(age / 10) * 10;
}

// 본인확인 API가 돌려주는 gender 값(M/F/1/2/남/여 등)을 "M"|"F"로 정규화.
// 1=남, 2=여(주민등록번호 뒷자리 1/3=남, 2/4=여 관행). 알 수 없으면 null.
export function normalizeGender(input: string | null | undefined): "M" | "F" | null {
  if (!input) return null;
  const s = String(input).trim().toUpperCase();
  if (["M", "MALE", "남", "남성", "1", "3"].includes(s)) return "M";
  if (["F", "FEMALE", "W", "여", "여성", "2", "4"].includes(s)) return "F";
  return null;
}
