# 안티그래비티 — 이유있는 투표 앱

한국 유권자용 정치 정보 & 커뮤니티 앱. 국회의원 행보·법안 표결·정치 뉴스·커뮤니티를 하나의 피드로 제공. **현재 2026 지방선거 모드 활성화** (`isElectionMode() = true`).

---

## 커맨드

```bash
npm run dev        # 개발 서버 (포트 3000)
npm run build      # 프로덕션 빌드
npm run check      # 타입 체크 (수정 후 항상 실행)
npm run db:push    # DB 스키마 반영 (마이그레이션 없음, 스키마 변경 시 필수)
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| FE | React 18 + TypeScript + Vite |
| 라우팅 | Wouter (`Link`, `useLocation` — react-router 사용 금지) |
| 서버 | Express 5 + Node.js |
| DB | PostgreSQL + Drizzle ORM |
| 상태 | TanStack React Query + `apiRequest()` (`lib/queryClient.ts`) |
| UI | Tailwind CSS v3 + shadcn/ui Radix (`components/ui/` 수정 금지) |
| 애니메이션 | Framer Motion |
| AI | Gemini 2.0 Flash (`@ai-sdk/google`) |
| 인증 | Passport.js local + express-session → connect-pg-simple |
| 외부 API | 열린국회정보 공공 API, RSS 12개 언론사 |

---

## 디렉토리

```
client/src/
  pages/            # 라우트 1:1 대응 페이지
  components/       # 공통 컴포넌트
    ui/             # shadcn/ui (수정 금지)
  hooks/            # 커스텀 훅
  lib/
    auth.tsx        # AuthContext / useAuth()
    queryClient.ts  # apiRequest() + QueryClient
    mock-data.ts    # 개발용 목 데이터 (candidates, assemblyMembers, bills)
    election-config.ts  # 선거 모드 설정 + 지역 코드 + 선거 종류
    useFavorites.ts # 즐겨찾기 훅

server/
  routes.ts         # 모든 API 라우트 (1200줄+, 섹션 주석으로 구분)
  storage.ts        # DB 조작 추상화 (직접 db.쿼리보다 우선)
  scheduler.ts      # cron + 국회 API 수집
  api-sync.ts       # syncLegislators / syncBills / syncVotes
  stance.ts         # 의원 정치 성향 점수
  db.ts             # Drizzle 연결
  api/news-analyzer.ts  # RSS 스크래핑 + Gemini 분석

shared/
  schema.ts         # Drizzle 스키마 + Zod 타입 (클라/서버 공용)
```

---

## 페이지 라우트

| 경로 | 파일 | 설명 |
|------|------|------|
| `/` | `election-home.tsx` | 선거 모드 홈 (지역별 후보·의원) |
| `/candidates` | `candidates.tsx` | 후보자 목록 |
| `/candidates/:id` | `candidate-detail.tsx` | 후보 상세 (공약·이력·뉴스) |
| `/members` | `members.tsx` | 국회의원 목록 |
| `/members/:id` | `member-detail.tsx` | 의원 상세 |
| `/bills` | `bill-search.tsx` | 법안 검색 |
| `/news` | `news.tsx` | 정치 뉴스 |
| `/community` | `community.tsx` | 커뮤니티 |
| `/community/:id` | `community-detail.tsx` | 게시글 상세 |
| `/evaluation` | `evaluation.tsx` | 의원 평가 |
| `/onboarding` | `onboarding.tsx` | 지역 설정 (선거 모드 첫 진입) |
| `/login` | `auth.tsx` | 로그인/회원가입 |

> 선거 모드: `lib/election-config.ts`의 `isElectionMode()`. 지역은 `localStorage("userRegions")` 배열.

---

## 주요 API

```
GET  /api/members               국회의원 목록
GET  /api/members/:id           의원 상세 + 표결/활동
GET  /api/bills                 법안 검색
GET  /api/news                  뉴스 목록 (15분 캐시)
POST /api/news/analyze          Gemini 기사 분석
GET  /api/election/candidates   선거 후보 목록 (?regionCode=&electionType=)
GET  /api/community/posts       커뮤니티 게시글
POST /api/community/posts       게시글 작성 (인증 필요)
POST /api/auth/register|login|logout
GET  /api/auth/me
```

---

## 국회 공공 API 엔드포인트

```
베이스: https://open.assembly.go.kr/portal/openapi
nwvrqwxyaytdsfvhu  의원 정보
nojepdqqaweusdfbi  표결 정보
nzmimeepazxkubdpn  법안 정보
nekcaihpamofqktdn  출석 정보
```

---

## 캐시 (인메모리)

```
newsCache              15분 TTL
billVotesCache         12시간 TTL
legislatorHistoryCache 6시간 TTL
legislatorVotesIndex   Map (의원 → 표결 역인덱스)
```

---

## 환경변수

```
DATABASE_URL=          # 필수
GEMINI_API_KEY=
OPEN_ASSEMBLY_API_KEY=
PORT=3000
ALLOWED_ORIGIN=        # 프로덕션 CORS
```

---

## 코딩 규칙 & 주의사항

- **타입**: `any` 금지. 공용 타입은 `shared/schema.ts`에 정의.
- **API 호출**: 클라이언트는 반드시 `apiRequest()` 사용.
- **DB**: `storage.ts` 함수 우선, 직접 `db.` 쿼리 지양.
- **스타일**: Tailwind 유틸리티만. 인라인은 동적 값(clamp, hsl)만 허용.
- **인증**: 보호 라우트는 `requireAuth` 미들웨어.
- Rate limit: auth 15분/20회, SMS 1분/3회, 일반 1분/120회.
- `routes.ts` 수정 시 섹션 주석 `// ===== ... =====` 으로 위치 먼저 파악.
- DB 스키마 변경 → `npm run db:push` 필수.
- CSP(프로덕션): 외부 이미지는 `open.assembly.go.kr`만 허용.
- 후보 상세 페이지(`candidate-detail.tsx`): mock-data에 없는 후보는 `sessionStorage`로 데이터 전달 (`saveCandidateToSession` 함수 사용).
