// Kakao Login 버튼 — Kakao Identity Guideline에 맞춘 색상(#FEE500)과 라벨.
// 클릭 시 /api/auth/kakao 로 이동 → 서버가 Kakao authorize URL로 redirect.
// 클라이언트 SDK가 아니라 서버 OAuth 흐름이므로 SPA 라우터(<Link/>)가 아닌 full-page navigation 필요.

import { withApiBase } from "@/lib/api-base";

interface Props {
  className?: string;
  label?: string;
  // 로그인 후 돌아갈 경로 — 현재 URL을 next param으로 넘기고 싶다면 활용.
  // 백엔드에서 req.query.next로 받아 redirect 시 처리할 수 있도록 인터페이스만 노출.
  next?: string;
}

export function KakaoLoginButton({ className = "", label = "카카오로 1초 로그인", next }: Props) {
  const href = withApiBase(next ? `/api/auth/kakao?next=${encodeURIComponent(next)}` : "/api/auth/kakao");

  return (
    <a
      href={href}
      data-testid="kakao-login-button"
      className={`relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-[#FEE500] hover:bg-[#FDD800] active:bg-[#F1C400] transition-colors shadow-sm text-[#191919] font-bold text-[15px] ${className}`}
      aria-label="카카오 계정으로 로그인"
    >
      <KakaoBubbleIcon className="w-5 h-5" />
      <span>{label}</span>
    </a>
  );
}

// 공식 카카오톡 말풍선 실루엣 (단색). 외부 이미지 의존 없이 SVG inline.
function KakaoBubbleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#191919"
        d="M12 3C6.477 3 2 6.477 2 10.8c0 2.74 1.797 5.146 4.52 6.553l-1.13 4.142c-.099.363.304.65.624.443l4.928-3.21c.348.037.7.057 1.058.057 5.523 0 10-3.477 10-7.785S17.523 3 12 3z"
      />
    </svg>
  );
}

export default KakaoLoginButton;
