# 안티그래비티 — 이유있는 투표 앱

한국 유권자를 위한 정치 정보 & 커뮤니티 앱.
국회의원 행보 추적 / 법안 표결 / 정치 뉴스 / 커뮤니티 토론을 하나의 피드로 제공한다.

---

## 커맨드

```bash
# 개발 서버 실행 (포트 3000)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm run start

# 타입 체크
npm run check

# DB 스키마 반영 (마이그레이션 없이 push)
npm run db:push
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18, TypeScript, Vite |
| 라우팅 (클라이언트) | Wouter |
| 서버 | Express 5, Node.js |
| DB | PostgreSQL + Drizzle ORM |
| 상태 관리 | TanStack React Query |
| UI | Tailwind CSS v3 + shadcn/ui (Radix UI) |
| 애니메이션 | Framer Motion |
| AI | Google Gemini (`@ai-sdk/google`, `gemini-2.0-flash`) |
| 인증 | Passport.js (local strategy) + express-session |
| 세션 저장소 | connect-pg-simple (PostgreSQL) |
| 외부 API | 열린국회정보 공공 API, 한국 언론사 RSS 12개 |

---

## 디렉토리 구조

```
/
├── client/src/
│   ├── pages/          # 페이지 컴포넌트 (라우트 1:1 대응)
│   ├── components/     # 공통 컴포넌트
│   │   └── ui/         # shadcn/ui 컴포넌트 (수정 금지)
│   ├── hooks/          # 커스텀 훅
│   └── lib/
│       ├── auth.tsx    # AuthContext — useAuth() 훅
│       ├── queryClient.ts  # apiRequest() 유틸 + QueryClient 설정
│       ├── mock-data.ts    # 개발용 목 데이터
│       └── api-data.ts     # API 타입 정의
│
├── server/
│   ├── index.ts        # 앱 진입점 (helmet, CORS, session, 포트)
│   ├── routes.ts       # 모든 API 라우트 (매우 큰 파일, 섹션 주석으로 구분됨)
│   ├── storage.ts      # DB 조작 추상화 레이어
│   ├── scheduler.ts    # cron 작업 + 국회 API 데이터 수집
│   ├── api-sync.ts     # 국회 API 동기화 함수 (의원/법안/표결)
│   ├── stance.ts       # 의원 정치 성향 점수 계산
│   ├── db.ts           # Drizzle DB 연결 (pool + db 익스포트)
│   └── api/
│       └── news-analyzer.ts  # 뉴스 스크래핑 + Gemini AI 분석
│
└── shared/
    └── schema.ts       # Drizzle 테이블 스키마 + Zod 유효성 검사 스키마
                        # 클라이언트/서버 양쪽에서 import해서 씀
```

---

## 환경변수 (.env)

```
DATABASE_URL=           # PostgreSQL 연결 문자열 (필수)
GEMINI_API_KEY=         # Google Gemini AI API 키 (뉴스 분석용)
OPEN_ASSEMBLY_API_KEY=  # 열린국회정보 공공 API 키 (의원/법안/표결)
PORT=3000               # 서버 포트 (기본 3000)
ALLOWED_ORIGIN=         # 프로덕션 CORS 허용 오리진
```

---

## 주요 API 라우트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/members` | 국회의원 목록 |
| GET | `/api/members/:id` | 의원 상세 + 표결/활동 |
| GET | `/api/bills` | 법안 검색 |
| GET | `/api/news` | 뉴스 목록 (RSS, 15분 캐시) |
| POST | `/api/news/analyze` | 기사 AI 분석 (Gemini) |
| GET | `/api/community/posts` | 커뮤니티 게시글 목록 |
| POST | `/api/community/posts` | 게시글 작성 (인증 필요) |
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 로그인 사용자 |

---

## 페이지 라우트

| 경로 | 파일 | 설명 |
|------|------|------|
| `/` | `home.tsx` | 홈 |
| `/members` | `members.tsx` | 국회의원 목록 |
| `/members/:id` | `member-detail.tsx` | 의원 상세 |
| `/candidates` | `candidates.tsx` | 후보자 정보 |
| `/bills` | `bill-search.tsx` | 법안 검색 |
| `/evaluation` | `evaluation.tsx` | 의원 평가 |
| `/community` | `community.tsx` | 커뮤니티 |
| `/news` | `news.tsx` | 정치 뉴스 |
| `/login` | `auth.tsx` | 로그인/회원가입 |
| `/more` | `more.tsx` | 더보기 |

---

## 국회 공공 API

`server/scheduler.ts`에서 cron으로 자동 수집.
`server/api-sync.ts`에 syncLegislators / syncBills / syncVotes 함수.

```
API 베이스: https://open.assembly.go.kr/portal/openapi
의원 정보:  nwvrqwxyaytdsfvhu
표결 정보:  nojepdqqaweusdfbi
법안 정보:  nzmimeepazxkubdpn
출석 정보:  nekcaihpamofqktdn
```

---

## 뉴스 시스템

- RSS 파싱: 연합뉴스, KBS, MBC, SBS, JTBC, YTN, 한겨레, 경향, 조선, 중앙, 동아, 뉴스1 (12개)
- 15분마다 자동 갱신, 인메모리 캐시(`newsCache`)
- 기사 클릭 시 `POST /api/news/analyze`로 Gemini 분석 요청
- **스크래핑 실패해도** 클라이언트에서 보낸 `title`+`source`로 폴백 분석됨

---

## 캐싱 구조 (인메모리)

```
newsCache              — 뉴스 목록 (15분 TTL)
billVotesCache         — 법안별 의원 표결 (12시간 TTL)
legislatorHistoryCache — 의원별 표결 이력 (6시간 TTL)
legislatorVotesIndex   — 의원 → 표결 역인덱스 (Map)
```

---

## 인증 & 세션

- Passport.js local strategy (username/password)
- 세션: PostgreSQL에 저장 (connect-pg-simple)
- 인증 필요 라우트: `requireAuth` 미들웨어 사용
- 회원가입 시 휴대폰 인증 필요 (verificationCodes 테이블)

---

## 코딩 컨벤션

- **타입**: `any` 사용 금지. 모든 타입은 `shared/schema.ts` 또는 명시적 interface로.
- **API 호출**: 클라이언트에서 반드시 `apiRequest()` (`lib/queryClient.ts`) 사용.
- **DB 조작**: 직접 `db.` 쿼리보다 `storage.ts` 함수를 우선 사용.
- **UI 컴포넌트**: `components/ui/` 내 파일은 직접 수정 금지. shadcn 규칙 따름.
- **스타일**: Tailwind 유틸리티 클래스만 사용. 인라인 스타일은 동적 값(clamp, hsl 등)만 허용.
- **라우팅**: 클라이언트는 `wouter`의 `Link`, `useLocation` 사용. `react-router` 사용 금지.
- **공유 타입**: 클라이언트-서버 공용 타입은 반드시 `shared/schema.ts`에 정의.

---

## 주의사항

- `server/routes.ts`는 1200줄 이상의 대형 파일. 섹션 주석(`// ===== ... =====`)으로 구분됨. 수정 시 해당 섹션 찾아서 작업.
- DB 스키마 변경 시 `npm run db:push` 실행 필요 (자동 마이그레이션 없음).
- Rate limit: auth 엔드포인트 15분/20회, SMS 발송 1분/3회, 일반 API 1분/120회.
- 프로덕션에서는 CSP 헤더가 활성화되어 외부 이미지는 `open.assembly.go.kr`만 허용됨.
- 스플래시 화면: `client/src/components/splash-screen.tsx` — 앱 기본 파란색(`hsl(230,100%,64%)`) 배경.
