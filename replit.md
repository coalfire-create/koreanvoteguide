# 이유있는 투표 (Vote With Reason)

## Overview
A civic transparency web app helping Korean citizens make informed voting decisions by tracking politicians' legislative records and public activities. All UI text is in Korean.

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend**: Express.js (minimal API)
- **Routing**: wouter (frontend), Express (backend API)
- **Data**: Mock data in `client/src/lib/mock-data.ts` (structured for easy API replacement)

## Project Structure
```
client/src/
├── App.tsx                    # Main app with sidebar + routing
├── components/
│   ├── app-sidebar.tsx        # Navigation sidebar (Korean)
│   └── ui/                    # Shadcn components
├── lib/
│   ├── mock-data.ts           # Korean mock data (6 members, 3 candidates, 12 bills)
│   ├── queryClient.ts         # TanStack Query setup
│   └── utils.ts
├── pages/
│   ├── home.tsx               # Landing page with hero + features
│   ├── members.tsx            # Assembly members list with search
│   ├── member-detail.tsx      # Member detail (votes, activities, score)
│   ├── candidates.tsx         # Candidates with tabs (presidential/local)
│   ├── bill-search.tsx        # Bill search with vote breakdown
│   ├── evaluation.tsx         # Objective scoring dashboard
│   └── not-found.tsx          # 404 page (Korean)
shared/
└── schema.ts                  # TypeScript interfaces
server/
├── routes.ts                  # API routes (candidate rating)
└── storage.ts                 # Storage interface (minimal)
```

## Key Features
1. **국회의원** - Assembly member profiles with voting records, activities, objective scores
2. **후보자** - Candidate profiles with promises, timelines, star ratings
3. **법안 검색** - Bill search with per-member vote breakdown
4. **객관적 평가** - Data-driven scoring: attendance (30%) + voting participation (40%) + bill proposals (30%)

## Scoring Formula
`Total = (attendance% × 0.3) + (voting participation% × 0.4) + (min(100, proposals × 5) × 0.3)`

## Color Scheme
- Primary: Deep blue (hue 217)
- Accent: Emerald green for positive votes
- Red for negative votes
- Gray for absent

## Running
`npm run dev` starts both Express backend and Vite frontend
