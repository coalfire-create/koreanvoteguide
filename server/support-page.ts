import type { Express } from "express";

// App Store 가이드 1.5 대응 — 지원(Support) 페이지.
// 사용자가 문의/도움말/자주 묻는 질문을 확인하고 운영자에게 연락할 수 있는 페이지.
// /legal/* 와 동일하게 명시적 라우트로 등록되어 SPA 폴백(index.html)에 걸리지 않는다.

const SUPPORT_EMAIL = "coalfireant@gmail.com";
const PRIVACY_EMAIL = "cpo@xn--2r5b1f.com";
const UPDATED = "2026-06-02";

const SUPPORT_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<title>고객지원 | 이유</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="description" content="이유(이유있는 투표) 앱 고객지원 — 문의, 자주 묻는 질문, 도움말."/>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;line-height:1.7;max-width:760px;margin:0 auto;padding:2rem 1rem 4rem;color:#1a1a1a;background:#fff}
  h1{font-size:1.6rem;margin-bottom:.25rem}
  h2{font-size:1.15rem;margin-top:2.25rem}
  .lead{color:#555;margin-top:0}
  .meta{color:#777;font-size:.85rem}
  a{color:#6D28D9}
  .card{border:1px solid #eee;border-radius:12px;padding:1rem 1.25rem;margin:1rem 0;background:#fafafa}
  .btn{display:inline-block;background:#6D28D9;color:#fff;text-decoration:none;padding:.7rem 1.2rem;border-radius:10px;font-weight:600;margin-top:.5rem}
  details{border-bottom:1px solid #eee;padding:.85rem 0}
  summary{cursor:pointer;font-weight:600}
  details p{margin:.6rem 0 0;color:#444}
  footer{margin-top:3rem;color:#777;font-size:.85rem}
</style></head>
<body>
<h1>이유 고객지원</h1>
<p class="lead">이유(이유있는 투표) — 후보·공약·법안·국회의원을 AI가 분석해 한 화면에서 보여주는 유권자용 정치정보 서비스입니다.</p>

<div class="card">
  <strong>문의하기</strong>
  <p style="margin:.4rem 0">앱 이용 중 궁금한 점이나 오류·개선 의견이 있으면 이메일로 연락 주세요. 보통 <strong>영업일 기준 1~2일 이내</strong>에 답변드립니다.</p>
  <a class="btn" href="mailto:${SUPPORT_EMAIL}?subject=%5B%EC%9D%B4%EC%9C%A0%5D%20%EB%AC%B8%EC%9D%98">${SUPPORT_EMAIL} 로 메일 보내기</a>
</div>

<h2>자주 묻는 질문</h2>

<details><summary>이유는 어떤 앱인가요?</summary>
<p>2026 지방선거를 앞두고 후보의 공약을 AI가 5개 축(이행계획 구체성·경제적 타당성·내부 정합성·재정 실현가능성·선례 검증)으로 채점하고, 후보 비교·국회의원 표결 분석·법안 해설·정치 뉴스 요약·유권자 커뮤니티를 제공하는 정치정보 서비스입니다.</p></details>

<details><summary>앱을 켜면 화면이 안 나와요.</summary>
<p>네트워크 연결을 확인한 뒤 앱을 완전히 종료했다가 다시 실행해 주세요. 그래도 빈 화면이 보이면 앱을 삭제 후 재설치하거나, 위 이메일로 사용 기기와 iOS 버전을 함께 알려주시면 도와드리겠습니다.</p></details>

<details><summary>후보·의원 정보는 어디서 가져오나요?</summary>
<p>국회 '열린국회정보' 공공 API, 중앙선거관리위원회 공개 데이터, 그리고 주요 언론사의 공개 뉴스(RSS)를 가공해 제공합니다. 원자료에 오류가 있을 수 있으며, 발견 시 위 이메일로 제보해 주시면 신속히 확인합니다.</p></details>

<details><summary>AI 점수는 어떻게 매겨지나요?</summary>
<p>공개된 공약 내용을 바탕으로 AI가 5개 평가 축에 따라 점수와 근거를 생성합니다. 점수는 참고용 분석이며 특정 후보·정당을 지지하거나 반대하지 않습니다.</p></details>

<details><summary>계정·게시글을 삭제하고 싶어요.</summary>
<p>앱의 마이페이지에서 직접 탈퇴 및 게시글 삭제가 가능합니다. 어려우시면 위 이메일로 요청해 주세요.</p></details>

<details><summary>부적절한 게시물을 신고하고 싶어요.</summary>
<p>커뮤니티 게시글·댓글의 신고 기능을 이용해 주세요. 접수 후 24시간 이내에 검토하여 조치합니다. 긴급한 경우 위 이메일로도 접수합니다.</p></details>

<details><summary>개인정보 관련 문의는 어디로 하나요?</summary>
<p>개인정보 열람·정정·삭제 등은 <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a> 로 문의해 주세요.</p></details>

<h2>약관 및 정책</h2>
<p>
  <a href="/legal/terms">이용약관</a> ·
  <a href="/legal/privacy">개인정보처리방침</a>
</p>

<footer>
  <p>이유(이유있는 투표) · 고객지원 이메일: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
  <p class="meta">최종 업데이트: ${UPDATED}</p>
</footer>
</body></html>`;

export function registerSupportPage(app: Express): void {
  const handler = (_req: unknown, res: any) => {
    res.set("Cache-Control", "public, max-age=3600");
    res.type("html").send(SUPPORT_HTML);
  };
  app.get("/support", handler);
  // App Store Connect 에 둘 중 어느 경로를 넣어도 동작하도록 별칭 제공
  app.get("/help", handler);
}
