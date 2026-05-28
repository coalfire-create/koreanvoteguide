import type { Express } from "express";

// 약관/개인정보처리방침/운영정책 — 변호사 자문 후 본문을 교체할 것.
// 이 파일은 *템플릿*이며, 운영 전 실제 사업자 정보·CPO·관할 법원 등을 반드시 채워야 한다.

const TOS_VERSION = "2026-06-01";
const PRIVACY_VERSION = "2026-06-01";

const TOS_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<title>이용약관 | 이유</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{font-family:system-ui,sans-serif;line-height:1.7;max-width:760px;margin:2rem auto;padding:0 1rem;color:#222}
  h1{font-size:1.5rem}h2{font-size:1.15rem;margin-top:2rem}
  .meta{color:#666;font-size:.85rem}
</style></head>
<body>
<h1>이용약관</h1>
<p class="meta">시행일: ${TOS_VERSION}</p>
<h2>제1조 (목적)</h2>
<p>본 약관은 (가칭) 이유 서비스(이하 "회사")가 제공하는 정치 정보 및 커뮤니티 서비스의 이용과 관련하여
회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
<h2>제2조 (정의)</h2>
<p>"회원"이란 본 약관에 동의하고 서비스에 가입한 자를 말합니다. "콘텐츠"란 회원이 작성한 게시글·댓글·반응·태그를 포함합니다.</p>
<h2>제3조 (서비스 제공)</h2>
<p>회사는 국회 공공 API, 중앙선거관리위원회 공개 데이터, 언론사 RSS 등 공개된 정보를 가공하여 제공합니다.
정보의 정확성을 검증하기 위해 노력하나, 원자료의 오류로 인한 손해는 책임지지 않습니다.</p>
<h2>제4조 (게시물 관리)</h2>
<p>회사는 공직선거법, 정보통신망법, 명예훼손 등 법령에 위반되는 게시물에 대해 임시조치·삭제할 수 있습니다.
선거 기간 중 후보자 등에 대한 게시물은 24시간 내 신고 처리 절차를 따릅니다.</p>
<h2>제5조 (회원의 의무)</h2>
<p>회원은 타인의 명예를 훼손하거나 허위사실을 공표하지 않으며, 선거운동 목적으로 서비스를 사용하지 않습니다.</p>
<h2>제6조 (계정 해지)</h2>
<p>회원은 언제든지 마이페이지에서 탈퇴할 수 있습니다. 탈퇴 시 식별정보는 즉시 비식별화되며 30일 후 완전 삭제됩니다.</p>
<h2>제7조 (책임의 제한)</h2>
<p>천재지변, 외부 API 장애, 회원 간 분쟁 등 회사의 합리적 통제 범위를 벗어난 사유로 인한 손해에는 회사가 책임을 지지 않습니다.</p>
<h2>제8조 (분쟁 해결)</h2>
<p>본 약관에 관한 분쟁의 관할은 민사소송법에 의한 회사 본점 소재지 법원으로 합니다.</p>
<p class="meta">⚠️ 본 약관은 템플릿이며, 운영 전 변호사 자문을 거쳐 사업자 정보·관할·환불 등을 보강해야 합니다.</p>
</body></html>`;

const PRIVACY_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<title>개인정보처리방침 | 이유</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{font-family:system-ui,sans-serif;line-height:1.7;max-width:760px;margin:2rem auto;padding:0 1rem;color:#222}
  h1{font-size:1.5rem}h2{font-size:1.15rem;margin-top:2rem}
  .meta{color:#666;font-size:.85rem}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ddd;padding:.5rem;text-align:left;font-size:.95rem}
</style></head>
<body>
<h1>개인정보처리방침</h1>
<p class="meta">시행일: ${PRIVACY_VERSION}</p>

<h2>1. 수집하는 개인정보 항목 및 수집 방법</h2>
<table>
<tr><th>구분</th><th>항목</th><th>수집 방법</th></tr>
<tr><td>필수</td><td>아이디, 비밀번호(해시), 이름, 휴대폰 번호, 출생연도</td><td>회원가입 시 입력</td></tr>
<tr><td>선택</td><td>닉네임, 관심 의원/지역, 게시글·댓글·반응</td><td>서비스 이용 중 입력</td></tr>
<tr><td>자동</td><td>접속 IP(임시), 쿠키, 서비스 이용 기록</td><td>자동 생성</td></tr>
</table>

<h2>2. 이용 목적</h2>
<p>회원 식별·인증, 부정 이용 방지, 본인확인, 게시물 작성·관리, 커뮤니티 운영, 통계 분석 및 서비스 개선.</p>

<h2>3. 보유 및 이용 기간</h2>
<ul>
  <li>회원정보: 회원 탈퇴 시까지. 탈퇴 후 30일간 비식별화 보존 후 완전 삭제.</li>
  <li>휴면 계정: 1년간 미접속 시 분리 보관(개인정보보호법 §39-6).</li>
  <li>휴대폰 인증번호: 발급 후 3분(만료 후 자동 삭제).</li>
  <li>검색 기록: 최대 30일.</li>
  <li>관계법령(전자상거래법·통신비밀보호법 등)에 따라 별도 보관이 필요한 경우 해당 기간 동안 보관.</li>
</ul>

<h2>4. 제3자 제공</h2>
<p>이용자의 별도 동의 또는 법령상 근거가 없는 한 제3자에게 제공하지 않습니다.</p>

<h2>5. 처리 위탁</h2>
<table>
<tr><th>수탁자</th><th>위탁 업무</th></tr>
<tr><td>Supabase (DB 호스팅)</td><td>데이터 저장</td></tr>
<tr><td>(예정) PASS/NICE/KMC</td><td>본인확인</td></tr>
<tr><td>(선택) SMS 발송 제공사</td><td>인증번호 발송</td></tr>
</table>

<h2>6. 만 14세 미만 아동</h2>
<p>회사는 만 14세 미만 아동의 회원가입을 받지 않습니다. 가입 시 출생연도로 차단합니다.</p>

<h2>7. 정보주체의 권리</h2>
<p>회원은 언제든지 마이페이지에서 본인 정보를 열람·수정·삭제·탈퇴할 수 있습니다.
열람·정정·삭제 요청은 cpo@xn--2r5b1f.com (개인정보 보호체임자 메일)으로도 접수합니다.</p>

<h2>8. 안전성 확보 조치</h2>
<p>비밀번호 scrypt 해시, 전화번호 HMAC 해시, 세션 쿠키 httpOnly+secure, 전 구간 HTTPS,
관리자 권한 분리, 접근 로그 기록, 정기 백업 및 취약점 점검을 수행합니다.</p>

<h2>9. 쿠키</h2>
<p>로그인 유지를 위해 세션 쿠키(kvg.sid)를 사용합니다. 브라우저 설정에서 거부할 수 있으나, 거부 시 일부 기능이 제한됩니다.</p>

<h2>10. 개인정보 보호책임자</h2>
<p>성명: 이유 운영팀 · 직책: CPO · 이메일: cpo@xn--2r5b1f.com</p>

<h2>11. 정책 변경</h2>
<p>본 방침은 ${PRIVACY_VERSION}부터 적용됩니다. 변경 시 7일 전 공지합니다.</p>

<p class="meta">⚠️ 본 방침은 템플릿입니다. 운영 전 CPO 지정, 위탁사 확정, 보존 기간 등은 사업자 실정에 맞게 갱신해야 합니다.</p>
</body></html>`;

export function registerLegalPages(app: Express): void {
  app.get("/legal/terms", (_req, res) => {
    res.set("Cache-Control", "public, max-age=3600");
    res.type("html").send(TOS_HTML);
  });
  app.get("/legal/privacy", (_req, res) => {
    res.set("Cache-Control", "public, max-age=3600");
    res.type("html").send(PRIVACY_HTML);
  });
  app.get("/legal/versions", (_req, res) => {
    res.json({ tos: TOS_VERSION, privacy: PRIVACY_VERSION });
  });
}
