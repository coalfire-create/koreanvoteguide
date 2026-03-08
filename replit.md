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
├── App.tsx                    # Main app with auth gate + sidebar + routing
├── components/
│   ├── app-sidebar.tsx        # Navigation sidebar with user info + logout
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
│   └── not-found.tsx          # 404 page (Korean)
shared/
└── schema.ts                  # Drizzle schema + TypeScript interfaces
server/
├── db.ts                      # PostgreSQL connection pool
├── scheduler.ts               # Cron job: fetches Assembly API data hourly
├── routes.ts                  # API routes (auth + data + status + refresh)
└── storage.ts                 # Database storage interface
```

## Key Features
1. **회원가입/로그인** - Registration with phone verification, session-based login
2. **국회의원** - Assembly member profiles with voting records, activities, objective scores
3. **후보자** - Candidate profiles with promises, timelines, star ratings
4. **법안 검색** - Bill search with per-member vote breakdown
5. **객관적 평가** - Data-driven scoring: attendance (30%) + voting participation (40%) + bill proposals (30%)
6. **Splash Screen** - Cinematic animated intro with particle effects
7. **Data Scheduler** - Hourly cron job fetching from 열린국회정보 API

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
- Protected routes: must login to access main app

## Database Tables
- `users` - id, username, password (hashed), name, phone, phone_verified, created_at
- `verification_codes` - id, phone, code, expires_at, used, created_at
- `assembly_data_cache` - key (text PK), data (jsonb), updated_at
- `scheduler_status` - id, last_run, success, error_message, consecutive_failures
- `session` - auto-managed by connect-pg-simple

## API Endpoints
- `POST /api/auth/send-code` - Send phone verification code
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/candidates/rate` - Rate candidate (requires auth)
- `GET /api/status` - Scheduler status (last run, success, failures)
- `GET /api/members` - Cached assembly members
- `GET /api/bills` - Cached bills
- `GET /api/votes/:id` - Member vote records
- `GET /api/attendance` - Attendance data
- `POST /api/refresh` - Manual data refresh (requires auth)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret
- `ASSEMBLY_API_KEY` - 열린국회정보 API key

## Scoring Formula
`Total = (attendance% × 0.3) + (voting participation% × 0.4) + (min(100, proposals × 5) × 0.3)`

## Running
`npm run dev` starts both Express backend and Vite frontend
