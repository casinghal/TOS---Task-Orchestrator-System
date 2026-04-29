# AGENTS.md

## 1) Project Overview
PracticeIQ is a SaaS-ready task orchestration platform for CA/CPA firms. Current live app includes role-based dashboards, assignment/project review, team access management, and firm setup/onboarding basics.

## 2) Tech Stack (detected)
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma ORM
- PostgreSQL datasource (Supabase-ready) via `DATABASE_URL`
- Netlify deployment via `netlify.toml`

## 3) Folder Structure
- `src/app/page.tsx`: main application UI (primary surface)
- `src/app/api/**/route.ts`: tenant/firm/member/access APIs
- `src/lib/workspace-data.ts`: seed workspace state and shared types
- `src/lib/tenant-guard.ts`: email/domain validation rules
- `prisma/schema.prisma`: data model and datasource
- `supabase/`: SQL and Supabase artifacts
- root: `netlify.toml`, `next.config.ts`, `.env.example`, docs

## 4) Coding Conventions
- Keep edits minimal and localized.
- Follow existing functional React + TypeScript style.
- Reuse existing helper/types in `src/lib`.
- Maintain tooltip/guidance-first UX style already in UI.
- Use concise, user-facing copy.

## 5) Rules for Making Changes
- No full rewrites unless explicitly requested.
- Do not refactor unrelated modules.
- Preserve role-based visibility and access gates.
- Keep migration-safe changes (avoid breaking persisted local state unexpectedly).

## 6) Run / Build / Validate
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Prisma validate: `npm run db:validate`
- Prisma generate: `npx prisma generate`
- Prisma push/migrate as needed with env set (`DATABASE_URL`, `DIRECT_URL`)

## 7) Areas Not To Modify Without Explicit Instruction
- `prisma/schema.prisma` relation contracts and auth-linked entities
- Platform owner login behavior and role logic
- Netlify deployment config (`netlify.toml`, `next.config.ts`)
- API contract shape under `src/app/api/**`

## 8) Preferred Behavior
- Always make minimal changes.
- Never rewrite full files unnecessarily.
- Only modify relevant modules.
- Keep output concise and operational.

