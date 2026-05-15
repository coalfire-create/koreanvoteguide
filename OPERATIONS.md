# 운영 매뉴얼 — 상용화 체크리스트

이 문서는 P0~P3 작업 후 운영 전 반드시 점검해야 할 항목과 외부 의존 작업을 정리한다.

## 0. 시크릿 로테이션 (즉시)

기존 로컬 `.env`에 노출되었던 모든 키를 **즉시 폐기/재발급**한다.

- [ ] `DATABASE_URL` — Supabase에서 DB 비밀번호 변경 후 새 URL 발급
- [ ] `OPEN_ASSEMBLY_API_KEY` — 열린국회정보에서 재발급
- [ ] `GEMINI_API_KEY` — Google AI Studio에서 폐기 후 재발급
- [ ] `GROQ_API_KEY` — Groq 콘솔에서 폐기 후 재발급
- [ ] `DATA_GO_KR_API_KEY` — 공공데이터포털에서 재발급
- [ ] `SESSION_SECRET` — `openssl rand -base64 48` 결과로 교체 (32자 이상 필수)
- [ ] `PHONE_PEPPER` — `openssl rand -hex 32` (한 번 정하면 절대 변경 금지)

새 키는 Railway/Vercel Variables에만 등록하고 로컬 `.env`에는 더미 값만 둔다.

## 1. 외부 계약 / 자문 (코드만으로는 불가)

- [ ] **PASS / NICE / KMC 본인확인기관 연동 계약**
  자체 SMS는 정보통신망법상 본인확인이 아니다. 실명인증 뱃지/실명 게시 기능을 운영하려면 KISA 지정 본인확인기관 SDK 연동 필수.
- [ ] **SMS 발송사 연동** (NHN Cloud Notification, NAVER Cloud SENS, Aligo 등)
  현재 `/api/auth/send-code`는 프로덕션에서 503을 반환한다 (어댑터 미구현).
- [ ] **선거전문 변호사 자문**
  - 공직선거법 §82-6 (게시판 운영자 의무, 신고-삭제 SLA)
  - §108 (여론조사 결과 공표 금지 — 이미 코드 차단 적용, ELECTION_DAY 환경변수로 조절)
  - §59 (사전선거운동 — 지지율 투표/팩트체크 verdict 적법성)
  - 약관·처리방침 본문 (legal-pages.ts 템플릿 보강)
- [ ] **저작권**
  - RSS 본문 스크래핑 + AI 분석 → 인용 범위 재검토, 가능하면 제목+1문장+원문 링크로 축소
  - 정치인 사진: 네이버 직접 프록시 대신 국회 공식 / Wikimedia CC 출처로 우선 전환
- [ ] **앱마켓 정책** — Apple/Google Play 정치 카테고리 심사 자료 준비

## 2. DB 마이그레이션 적용

이번 PR에서 `shared/schema.ts`에 다음을 추가했다. 적용은 사용자가 수동으로 한다.

- `users`: `phone_hash`, `birth_year`, `real_name_provider`, `tos_accepted_at`, `privacy_accepted_at`, `deleted_at`, 인덱스 `users_phone_hash_uniq`
- `community_posts`: `hidden_at`, `deleted_at`, 인덱스 4종
- `community_comments`: `hidden_at`, `deleted_at`, 인덱스 2종
- `assembly_votes`: 인덱스 2종

```bash
# 1. 백업 먼저
pg_dump $DATABASE_URL > backup-$(date +%F).sql

# 2. 마이그레이션 생성 + 검토
npm run db:generate
# migrations/000X_*.sql 파일을 직접 열어 destructive 변경이 없는지 확인

# 3. 적용
npm run db:migrate
```

기존 행의 `phone_hash`는 NULL이다. 운영 후 1회 백필 스크립트 필요:

```sql
-- script/backfill-phone-hash.ts 따로 작성 — node crypto.createHmac으로 평문 phone → hash
```

## 3. 환경변수 점검

`.env.production.example`을 보고 운영 PaaS에 등록한다. 필수:

- `DATABASE_URL`, `SESSION_SECRET`(32+), `ALLOWED_ORIGIN`, `PHONE_PEPPER`
- `ADMIN_USER_IDS` — 반드시 채울 것. 비어있으면 모든 `/api/admin/*`, `/api/sync/*`가 403 (fail-closed로 변경됨)
- `ENABLE_DEV_TESTER` — 프로덕션에서는 `0` 또는 미설정
- `ELECTION_DAY=2026-06-03` — 여론조사 블랙아웃 기간 계산용

선택:

- `SENTRY_DSN` + `npm i @sentry/node` 후 자동 활성화
- `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_API_SECRET` — 어댑터 연동 후

## 4. 코드 변경 요약 (P0~P3)

### P0 — 보안 차단
- 백도어 `tester/test1234` → `!isProduction && ENABLE_DEV_TESTER=1`일 때만 동작
- `requireAdmin` fail-closed: `ADMIN_USER_IDS`가 비어있으면 거부
- `app.set("trust proxy", 1)` — rate limit이 실제 클라이언트 IP 사용
- `/api/health` 별도 엔드포인트 (Railway healthcheck 분리)
- `SESSION_SECRET` 32자 미만이면 부팅 거부
- 로그아웃 시 `kvg.sid` 쿠키 명시 제거

### P1 — 위협 표면 축소
- `multer` `fileFilter` 추가 (이미지만), `originalname` 확장자 신뢰 제거, 5MB 한도
- 사진 프록시 SSRF allowlist (4개 호스트만 허용, 사설망/메타데이터 IP 차단)
- 서버 측 `sanitizeHtml` / `sanitizeText` 적용 — 게시글/댓글 저장 시 1차 정화
- 응답 본문 로깅 제거 (프로덕션)
- CSP HTTP 호스트 제거, font/style/iframe 등 directive 정비, `upgrade-insecure-requests`
- `verificationCodes`/`searchHistory`/탈퇴 회원 cleanup cron (매일 03:30 KST)
- DB 스키마: `phone_hash` HMAC, `birth_year`, 동의 시점, 모더레이션 컬럼, 인덱스/FK 보강
- 회원가입 비번 정책 10자 + 영문/숫자, 14세 미만 차단, 약관/처리방침 동의 필수
- 회원 탈퇴 `DELETE /api/auth/me` (즉시 비식별화 + 30일 후 완전 삭제)
- "실명인증" 자체 입력 차단 → PASS/NICE/KMC 어댑터로만 가능 (현재 501)
- 여론조사 결과 / 지지율 표시 §108 블랙아웃 (`ELECTION_DAY` 환경변수 기반)
- 약관/처리방침 정적 라우트 `/legal/terms`, `/legal/privacy`, 마이페이지에 노출 + 탈퇴 버튼

### P2 — 운영 인프라
- `server/utils/monitoring.ts` — Sentry lazy require, `SENTRY_DSN` 설정 시 자동 활성화
- 글로벌 에러 핸들러에서 500 메시지를 외부에 노출하지 않음
- 클라이언트 `React.lazy` + `Suspense` 도입 — 라우트별 chunk 분리
- `aws-sdk` v2 의존성 제거 (~35MB)
- `.github/workflows/ci.yml` — typecheck/test/build/audit/시크릿 의심 파일 감지
- `vitest` + `server/__tests__/{sanitize,election-blackout}.test.ts`
- `npm run db:generate`, `db:migrate` 스크립트 추가

### P3 — 사용자 경험
- OG/Twitter Card 메타 보강, `theme-color`, `canonical`, `noscript`, skip-link 추가
- `HomeWithRedirect`의 `setTimeout` → `useEffect`

## 5. 출시 전 최종 점검

- [ ] `npm run check` (사전 존재 에러 별도 정리)
- [ ] `npm test` 통과
- [ ] `npm run build` 통과 후 `dist/public` 번들 크기 확인 (route-level chunk 분리 확인)
- [ ] 스테이징 환경에서 회원가입/탈퇴/약관 라우트/헬스체크 수동 점검
- [ ] `ELECTION_DAY` 설정 후 블랙아웃 기간 동안 `/api/polls`, `/api/election/support-rates/*`가 451을 반환하는지 확인
- [ ] 변호사 자문 사인오프

---

## 6. Render 배포 + 이유.com 도메인 연결

### 6.1 사전 정보
- 서비스명: `iyu-web` (render.yaml 기준)
- Region: Singapore (한국에서 latency 가장 낮음)
- Plan: Starter ($7/mo) — `server/scheduler.ts` cron 때문에 free 플랜은 부적합 (15분 idle → sleep)
- 도메인: 이유.com → Punycode `xn--2r5b1f.com` (`node -e "console.log(new URL('https://이유.com').hostname)"` 로 확인 완료)

### 6.2 Render 서비스 생성 (Blueprint 방식)

1. **레포 푸시** — `render.yaml`이 main 브랜치에 있어야 함
2. **Dashboard → New + → Blueprint** → GitHub 레포 선택 → Apply
3. Render가 `iyu-web` 웹 서비스 + `iyu-db` Postgres를 자동 생성. 빌드 약 5분.

### 6.3 환경변수 입력 (Render Dashboard → iyu-web → Environment)

`render.yaml`에서 `sync: false`로 표시된 항목은 자동 주입되지 않으므로 수동 입력:

- [ ] `GEMINI_API_KEY` — Google AI Studio
- [ ] `OPEN_ASSEMBLY_API_KEY` — 열린국회정보 포털
- [ ] `KAKAO_REST_API_KEY` — Kakao Developers 콘솔 → 내 애플리케이션 → 앱 키 → REST API 키
- [ ] `KAKAO_CLIENT_SECRET` — Kakao Developers에서 활성화한 경우만
- [ ] `ADMIN_USER_IDS` — 본인 user.id (DB에서 확인). 비우면 모든 admin/sync API가 차단됨 (fail-closed)
- [ ] `SMS_PROVIDER` — 본인확인 SMS 어댑터를 붙일 때까지는 비워둠 → `/api/auth/send-sms`가 prod에서 503

자동 주입되는 항목 (확인만):
- `DATABASE_URL` (fromDatabase 매핑)
- `SESSION_SECRET`, `PHONE_PEPPER` (generateValue)
- `NODE_ENV=production`, `ALLOWED_ORIGIN`, `KAKAO_REDIRECT_URI`

⚠ `PHONE_PEPPER`는 한 번 정해지면 절대 바꾸지 말 것. 바꾸면 기존 `phoneHash` 전부 무효화돼 동일 전화번호 중복 가입 검사 깨짐.

### 6.4 DB 마이그레이션 첫 1회

Render가 만든 빈 Postgres에 스키마 푸시:

```bash
# 로컬에서 Render Postgres URL을 .env에 임시로 넣고
DATABASE_URL="<Render의 External Database URL>" npm run db:push
```

또는 Render Shell 탭에서 직접 `npx drizzle-kit push` 실행. 이후 운영 중 스키마 변경 시마다 같은 절차.

### 6.5 커스텀 도메인 추가

1. **Render Dashboard → iyu-web → Settings → Custom Domains**
2. `이유.com` 입력 → Add. Render는 자동으로 Punycode `xn--2r5b1f.com`로 등록.
3. `www.이유.com` 도 같은 방법으로 추가.

Render가 표시하는 DNS 레코드:
- **Apex (이유.com)**: A 레코드 (Render IP — Dashboard에 표시되는 값 그대로) 또는 ALIAS/ANAME → `iyu-web.onrender.com`
- **www**: CNAME → `iyu-web.onrender.com`

### 6.6 DNS 설정 (도메인 등록기관에서)

이유.com은 IDN이므로 등록기관마다 입력 방식이 다름:

- **Cloudflare** 권장 — IDN을 한글 그대로 입력 가능, apex CNAME(flattening)도 지원해서 ALIAS 없이도 `iyu-web.onrender.com`으로 가리킬 수 있음
- **가비아/후이즈 등 국내 등록기관** — apex는 A 레코드, www는 CNAME 입력. Punycode `xn--2r5b1f.com` 표기로 보일 수 있음
- TTL은 300~3600 권장

DNS 전파 후 Render Dashboard에서 도메인 상태가 `Verified` + `Certificate Issued`로 바뀌면 완료. Let's Encrypt 자동 발급, 약 5~30분.

### 6.7 Kakao OAuth redirect URI 등록

[Kakao Developers](https://developers.kakao.com/) → 내 애플리케이션 → 카카오 로그인 → Redirect URI 등록:

```
https://이유.com/api/auth/kakao/callback
https://www.이유.com/api/auth/kakao/callback
```

Kakao는 IDN도 그대로 등록 가능. 등록 안 하면 OAuth 콜백 시 `KOE006` 에러.

### 6.8 배포 후 헬스체크

```bash
curl -fsS https://이유.com/api/health         # {"status":"ok"} 응답 기대
curl -I  https://이유.com                      # HTTP/2 200 + Set-Cookie Secure 확인
```

도메인 인증 전까지는 `https://iyu-web.onrender.com`이 살아있음. 그쪽에서 먼저 e2e 점검 가능.

### 6.9 코드/Kakao 콘솔이 모르는 한국 IDN 흔한 함정

- **Render의 ALLOWED_ORIGIN 비교는 문자열 그대로** — 브라우저가 IDN 도메인에 접근 시 `Origin` 헤더에 어떤 폼이 들어갈지가 브라우저 구현에 따라 다름. `render.yaml`의 `ALLOWED_ORIGIN`은 한글 + Punycode 두 폼을 모두 등록해 둠.
- **이메일·문자 발송 시 from-domain** — `이유.com` 그대로 못 쓰는 경우 있음. SPF/DKIM은 Punycode `xn--2r5b1f.com`으로 설정.
- **Kakao 콘솔 사이트 도메인** — `이유.com` 입력 가능하지만, 일부 외부 SDK는 Punycode를 요구함. 둘 다 등록해 두면 안전.
