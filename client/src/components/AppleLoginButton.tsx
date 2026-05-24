// Sign in with Apple 버튼 — 애플 휴먼 인터페이스 가이드(검정 배경 + 흰 로고) 준수.
// 클릭 시 /api/auth/apple 로 이동 → 서버가 애플 authorize URL로 redirect.
// 서버 OAuth 흐름이므로 SPA 라우터(<Link/>)가 아닌 full-page navigation 필요.

interface Props {
  className?: string;
  label?: string;
  next?: string;
}

export function AppleLoginButton({ className = "", label = "Apple로 로그인", next }: Props) {
  const href = next ? `/api/auth/apple?next=${encodeURIComponent(next)}` : "/api/auth/apple";

  return (
    <a
      href={href}
      data-testid="apple-login-button"
      className={`relative flex items-center justify-center gap-3 w-full h-14 rounded-2xl bg-black hover:bg-neutral-900 active:bg-neutral-800 transition-colors text-white font-bold text-[15px] ${className}`}
      aria-label="Apple로 로그인"
    >
      <AppleMarkIcon className="w-5 h-5" />
      <span>{label}</span>
    </a>
  );
}

// 애플 공식 로고. 외부 이미지 의존 없이 SVG inline.
function AppleMarkIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.05 12.54c-.03-2.66 2.17-3.94 2.27-4-1.24-1.81-3.16-2.06-3.84-2.08-1.63-.17-3.18.96-4.01.96-.82 0-2.1-.94-3.45-.91-1.77.03-3.41 1.03-4.32 2.62-1.84 3.2-.47 7.93 1.32 10.52.87 1.27 1.91 2.69 3.27 2.64 1.31-.05 1.81-.85 3.4-.85 1.58 0 2.03.85 3.42.82 1.41-.02 2.31-1.29 3.17-2.57.99-1.47 1.4-2.9 1.43-2.97-.03-.01-2.74-1.05-2.76-4.17zM14.43 4.84c.72-.88 1.21-2.1 1.08-3.32-1.04.04-2.3.69-3.05 1.57-.67.77-1.26 2.01-1.1 3.2 1.16.09 2.35-.59 3.07-1.45z" />
    </svg>
  );
}

export default AppleLoginButton;
