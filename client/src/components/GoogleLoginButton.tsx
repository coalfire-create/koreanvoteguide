// Google Login 버튼 — 구글 로그인 가이드의 브랜드 디자인 규격 적용.
// 클릭 시 /api/auth/google 로 이동 → 서버가 구글 authorize URL로 redirect.
// 서버 OAuth 흐름이므로 SPA 라우터(<Link/>)가 아닌 full-page navigation 필요.

interface Props {
  className?: string;
  label?: string;
  next?: string;
}

export function GoogleLoginButton({ className = "", label = "Google로 로그인", next }: Props) {
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google";

  return (
    <a
      href={href}
      data-testid="google-login-button"
      className={`relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-white border border-slate-200 hover:bg-[#F8F9FA] active:bg-[#F1F3F4] transition-colors shadow-sm text-[#3C4043] font-bold text-[15px] ${className}`}
      aria-label="구글 계정으로 로그인"
    >
      <GoogleMarkIcon className="w-5 h-5 mr-1" />
      <span>{label}</span>
    </a>
  );
}

// 구글 공식 G 심볼 (컬러). 외부 이미지 의존 없이 SVG inline.
function GoogleMarkIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default GoogleLoginButton;
