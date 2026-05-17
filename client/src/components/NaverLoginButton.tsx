// Naver Login 버튼 — 네이버 로그인 가이드의 브랜드 그린(#03C75A)과 'N' 심볼.
// 클릭 시 /api/auth/naver 로 이동 → 서버가 네이버 authorize URL로 redirect.
// 서버 OAuth 흐름이므로 SPA 라우터(<Link/>)가 아닌 full-page navigation 필요.

interface Props {
  className?: string;
  label?: string;
  next?: string;
}

export function NaverLoginButton({ className = "", label = "네이버로 로그인", next }: Props) {
  const href = next ? `/api/auth/naver?next=${encodeURIComponent(next)}` : "/api/auth/naver";

  return (
    <a
      href={href}
      data-testid="naver-login-button"
      className={`relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-[#03C75A] hover:bg-[#02B350] active:bg-[#029D46] transition-colors shadow-sm text-white font-bold text-[15px] ${className}`}
      aria-label="네이버 계정으로 로그인"
    >
      <NaverMarkIcon className="w-4 h-4" />
      <span>{label}</span>
    </a>
  );
}

// 네이버 공식 'N' 심볼 (단색 흰색). 외부 이미지 의존 없이 SVG inline.
function NaverMarkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#FFFFFF"
        d="M13.07 10.69 6.66 1.5H1.5v17h5.43V9.31l6.41 9.19h5.16v-17h-5.43v9.19z"
      />
    </svg>
  );
}

export default NaverLoginButton;
