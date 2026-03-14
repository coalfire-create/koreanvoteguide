# 이유있는 투표 (Vote With Reason)

## Overview
A civic transparency web app helping Korean citizens make informed voting decisions by tracking politicians' legislative records and public activities. All UI text is in Korean.

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI + Framer Motion
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL (Drizzle ORM)
- **Scheduler**: node-cron (hourly data fetch from 열린국회정보 API)
- **HTTP Client**: axios (for API calls)
- **Routing**: wouter (frontend), Express (backend API)
- **Data**: Real API data with mock fallback

## Project Structure
```
client/src/
├── App.tsx                    # Main app with bottom nav + routing (no auth gate)
├── components/
│   ├── bottom-nav.tsx         # Bottom navigation bar (3 tabs: 홈, 커뮤니티, 더보기)
│   ├── last-updated.tsx       # "마지막 업데이트" timestamp component
│   ├── splash-screen.tsx      # Animated splash screen (Framer Motion)
│   └── ui/                    # Shadcn components
├── lib/
│   ├── api-data.ts            # API data hooks with mock fallback
│   ├── auth.tsx               # Auth context provider (login/register/logout)
│   ├── mock-data.ts           # Fallback mock data + utility functions
│   ├── queryClient.ts         # TanStack Query setup
│   └── utils.ts
├── pages/
│   ├── auth.tsx               # Login + Registration page with phone verification
│   ├── home.tsx               # Landing page with hero + features
│   ├── members.tsx            # Assembly members list with search
│   ├── member-detail.tsx      # Member detail (votes, activities, score)
│   ├── candidates.tsx         # Candidates with tabs (presidential/local)
│   ├── bill-search.tsx        # Bill search with vote breakdown
│   ├── evaluation.tsx         # Objective scoring dashboard
│   ├── more.tsx               # 더보기 page with card menu links
│   ├── community.tsx          # Community post list (requires auth)
│   ├── community-detail.tsx   # Post detail with reactions, comments, reports
│   ├── community-write.tsx    # Write new post (requires auth)
│   └── not-found.tsx          # 404 page (Korean)
shared/
└── schema.ts                  # Drizzle schema + TypeScript interfaces
server/
├── db.ts                      # PostgreSQL connection pool
├── scheduler.ts               # Cron job: fetches Assembly API data hourly
├── routes.ts                  # API routes (auth + data + community + status)
└── storage.ts                 # Database storage interface
```

## Key Features
1. **회원가입/로그인** - Registration with phone verification, session-based login
2. **국회의원** - Assembly member profiles with voting records, activities, objective scores
3. **후보자** - Candidate profiles with promises, timelines, star ratings
4. **법안 검색** - Bill search with per-member vote breakdown
5. **객관적 평가** - Data-driven scoring: attendance (30%) + voting participation (40%) + bill proposals (30%)
6. **커뮤니티** - Anonymous community with posts, comments, agree/disagree polls, like/dislike, reports
7. **Splash Screen** - Cinematic animated intro with particle effects
8. **Data Scheduler** - Hourly cron job fetching from 열린국회정보 API

## Navigation
- Bottom navigation bar with 3 tabs: 홈, 커뮤니티, 더보기
- Top header with logo + login/logout button + hamburger menu (≡)
- Hamburger menu opens Sheet (slide-in drawer from right) with: 국회의원, 후보자, 법안 검색, 객관적 평가
- 더보기 page: Card-based menu linking to same 4 pages
- Login page at /login route (not auth-gated)
- All main pages accessible without login; community requires auth
- Home page: minimalist Google-style with centered logo + search bar (no hero, no cards)

## Community System
- **Auth gating**: Community access requires login; redirects to login page with message
- **Anonymous posting**: All authors shown as "익명의 유권자"
- **Random nicknames**: Server generates nicknames like "정의로운 올빼미 #302" per user session
- **Privacy**: API strips userId from all responses; isAuthor computed server-side
- **Two-dimensional reactions**: Stance (찬성/반대) and Sentiment (좋아요/싫어요) are independent
- **Agree/disagree poll**: Progress bar showing percentage with total vote count
- **Comments**: Author badge ("글쓴이") for post author's comments
- **Reports**: Dropdown with 5 report reasons (허위 정보, 욕설/비방, 스팸/광고, 혐오 표현, 기타)
- **FAB**: Floating write button at bottom-right

## Scheduler System
- **Cron**: Runs every hour (0 * * * *) via node-cron
- **APIs**: 4 endpoints from open.assembly.go.kr (members, votes, bills, attendance)
- **Storage**: JSONB cache in `assembly_data_cache` PostgreSQL table
- **Fallback**: If API data unavailable, serves mock data from client-side
- **Error Handling**: Consecutive failure tracking (3+ failures = admin alert log)
- **Rate Limiting**: 500ms delay between API calls
- **Manual Refresh**: POST /api/refresh (requires auth)

## Auth System
- PostgreSQL-backed user accounts with hashed passwords (scrypt)
- Phone verification with 6-digit codes (demo mode: code displayed on screen)
- Session management via connect-pg-simple
- App browsable without login; community features require auth

## Database Tables
- `users` - id, username, password (hashed), name, phone, phone_verified, created_at
- `verification_codes` - id, phone, code, expires_at, used, created_at
- `assembly_data_cache` - key (text PK), data (jsonb), updated_at (JSONB cache for raw API data)
- `scheduler_status` - id, last_run, success, error_message, consecutive_failures
- `legislators` - mona_cd (PK), name, party, district, photo_url, committee, elected_term, synced_at
- `assembly_bills` - bill_id (PK), bill_no, bill_name, proposer, propose_date, result, committee, yes_count, no_count, abstain_count, econ_score (REAL nullable), social_score (REAL nullable), env_score (REAL nullable), synced_at
- `assembly_votes` - id (PK UUID), bill_id (FK), legislator_id (FK), legislator_name, party, vote_result, synced_at; unique on (bill_id, legislator_id)
- `community_posts` - id, user_id, title, content, anon_nickname, likes, dislikes, agree_count, disagree_count, created_at
- `community_comments` - id, post_id, user_id, content, anon_nickname, created_at
- `community_reactions` - id, post_id, user_id, type, dimension (sentiment|stance), created_at
- `community_reports` - id, post_id, comment_id, user_id, reason, created_at
- `session` - auto-managed by connect-pg-simple

## Data Sync (api-sync.ts)
- `server/api-sync.ts` - 열린국회정보 API → structured tables sync utility
- `syncLegislators()` - 국회의원 296명 upsert (mona_cd 기준)
- `syncBills()` - 법안 100건 upsert (bill_id 기준)
- `syncVotes()` - 표결 기록 upsert (bill_id + legislator_id unique 기준)
- `syncAll()` - 위 3개 순차 실행
- API key: OPEN_ASSEMBLY_API_KEY 또는 ASSEMBLY_API_KEY (fallback)

## API Endpoints
- `POST /api/auth/send-code` - Send phone verification code
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/candidates/rate` - Rate candidate (requires auth)
- `GET /api/status` - Scheduler status
- `GET /api/members` - Cached assembly members
- `GET /api/bills` - Cached bills
- `GET /api/votes/:id` - Member vote records
- `GET /api/attendance` - Attendance data
- `POST /api/refresh` - Manual data refresh (requires auth)
- `POST /api/sync` - Full sync: legislators + bills + votes (requires auth)
- `POST /api/sync/legislators` - Sync legislators only (requires auth)
- `POST /api/sync/bills` - Sync bills only (requires auth)
- `POST /api/sync/votes` - Sync votes only (requires auth)
- `GET /api/db/legislators` - Query structured legislators table
- `GET /api/db/bills` - Query structured bills table
- `GET /api/db/bills/:billId/votes` - Get all votes for a specific bill
- `GET /api/db/legislators/:id/votes` - Get all votes by a specific legislator
- `GET /api/db/legislators/:id/stance` - Calculate ideology stance scores (econ/social/env) from bill votes
- `GET /api/community/posts` - List posts (sanitized, no userId)
- `GET /api/community/posts/:id` - Post detail with comments + reactions
- `POST /api/community/posts` - Create post (requires auth)
- `POST /api/community/posts/:id/comments` - Add comment (requires auth)
- `POST /api/community/posts/:id/react` - React to post (requires auth)
- `POST /api/community/report` - Report post/comment (requires auth)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret
- `ASSEMBLY_API_KEY` - 열린국회정보 API key

## Scoring Formula
`Total = (attendance% × 0.3) + (voting participation% × 0.4) + (min(100, proposals × 5) × 0.3)`

## Running
`npm run dev` starts both Express backend and Vite frontend
