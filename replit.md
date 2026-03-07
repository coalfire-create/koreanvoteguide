# 이유있는 투표 (Vote With Reason)

## Overview
A civic transparency web app helping Korean citizens make informed voting decisions by tracking politicians' legislative records and public activities. All UI text is in Korean.

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI + Framer Motion
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL (Drizzle ORM)
- **Routing**: wouter (frontend), Express (backend API)
- **Data**: Mock data in `client/src/lib/mock-data.ts` (structured for easy API replacement)

## Project Structure
```
client/src/
├── App.tsx                    # Main app with auth gate + sidebar + routing
├── components/
│   ├── app-sidebar.tsx        # Navigation sidebar with user info + logout
│   ├── splash-screen.tsx      # Animated splash screen (Framer Motion)
│   └── ui/                    # Shadcn components
├── lib/
│   ├── auth.tsx               # Auth context provider (login/register/logout)
│   ├── mock-data.ts           # Korean mock data (6 members, 3 candidates, 12 bills)
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
├── routes.ts                  # API routes (auth + candidate rating)
└── storage.ts                 # Database storage interface
```

## Key Features
1. **회원가입/로그인** - Registration with phone verification, session-based login
2. **국회의원** - Assembly member profiles with voting records, activities, objective scores
3. **후보자** - Candidate profiles with promises, timelines, star ratings
4. **법안 검색** - Bill search with per-member vote breakdown
5. **객관적 평가** - Data-driven scoring: attendance (30%) + voting participation (40%) + bill proposals (30%)
6. **Splash Screen** - Cinematic animated intro with particle effects

## Auth System
- PostgreSQL-backed user accounts with hashed passwords (scrypt)
- Phone verification with 6-digit codes (demo mode: code displayed on screen)
- Session management via connect-pg-simple
- Protected routes: must login to access main app

## Database Tables
- `users` - id, username, password (hashed), name, phone, phone_verified, created_at
- `verification_codes` - id, phone, code, expires_at, used, created_at
- `session` - auto-managed by connect-pg-simple

## API Endpoints
- `POST /api/auth/send-code` - Send phone verification code
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/candidates/rate` - Rate candidate (requires auth)

## Scoring Formula
`Total = (attendance% × 0.3) + (voting participation% × 0.4) + (min(100, proposals × 5) × 0.3)`

## Running
`npm run dev` starts both Express backend and Vite frontend
