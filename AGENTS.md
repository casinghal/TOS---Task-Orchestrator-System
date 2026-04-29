# AGENTS.md

## 1) Project Overview
Task Orchestration System (TOS) for CA/CPA firms. Current app supports multi-firm workspace behavior, task/client/team operations, admin controls, and tenant/domain validation paths.

## 2) Tech Stack
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma ORM
- SQLite (local datasource in Prisma)
- Netlify config present (`netlify.toml`)

## 3) Folder Structure
- `src/app/` - UI pages and API routes (App Router)
  - `src/app/page.tsx` - primary application surface
  - `src/app/api/**/route.ts` - server endpoints
- `src/lib/` - shared types, seed/demo data, guards, helpers
- `prisma/` - Prisma schema
- `public/` - static assets
- `supabase/` - Supabase-related project artifacts
- root configs: `package.json`, `next.config.ts`, `netlify.toml`, `.env.example`

## 4) Coding Conventions
- Use TypeScript strictly; prefer explicit types for API payloads/results.
- Keep changes ASCII unless file already requires otherwise.
- Follow existing React functional component style.
- Reuse shared utilities from `src/lib/` instead of duplicating logic.
- Keep UI copy concise and action-oriented.

## 5) Rules for Making Changes
- Make minimal, targeted edits only.
- Do not rewrite full files unless explicitly requested.
- Modify only modules directly related to the task.
- Preserve current behavior outside requested scope.
- Avoid refactors that are not necessary for the requested change.

## 6) Run / Build / Validate
- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Prisma validate: `npm run db:validate`
- Prisma generate: `npm run db:generate` or `npx prisma generate`
- Prisma push: `npm run db:push`
- Combined release check (if used): `npm run uat:check`

## 7) Do Not Modify Without Explicit Instruction
- `prisma/schema.prisma` data model contracts (tenant/auth/billing-impacting changes)
- Auth and tenant guard behavior in API routes
- Deployment config (`netlify.toml`, env expectations)
- Production-facing domain/access rules

## 8) Preferred Behavior
- Always make minimal changes.
- Never rewrite full files unnecessarily.
- Only modify relevant modules.
- Keep output concise.
