# PROJECT_CONTEXT.md

## Product
**PracticeIQ** - multi-firm task orchestration platform for CA/CPA practices.

## Goal
Provide a brutally simple day-1 workflow (task/assignment/client control), with deeper SaaS capabilities already scaffolded and activated progressively by admin/owner controls.

## Current Architecture Snapshot
- Frontend: Next.js App Router, single main surface in `src/app/page.tsx`
- APIs: Firm onboarding and tenant/access endpoints in `src/app/api/**`
- Data model: Prisma schema in `prisma/schema.prisma` (PostgreSQL datasource)
- Deploy: Netlify linked to GitHub `main`
- DB target: Supabase Postgres via `DATABASE_URL` + `DIRECT_URL`

## Implemented Functional Modules
- Login with role-aware access logic (Platform Owner + firm-domain users)
- Role-based dashboards (Platform Owner / Firm Admin / Partner / others)
- Task lifecycle with review/closure flow
- Assignment-level and client-level rollups
- Project Review view with sequencing/reassignment controls
- Team access management (add user, role update, deactivate/reactivate, password reset)
- Admin module controls and activity monitor
- Firm Setup section (active firm profile + add additional firms)

## UI/Brand State
- Product name standardized to **PracticeIQ** in user-facing UI
- Login screen: deep grey theme + Montserrat
- In-app UI: Poppins
- Legacy TAMS/TKG references removed from active UI copy and headers

## Known Risks / Constraints
- Main UI is concentrated in `src/app/page.tsx` (large file; future modular split recommended)
- Local workspace state currently persisted in localStorage for the main UI state
- API + Prisma model is ahead of full backend integration in some UX paths (hybrid state)

## Latest Verified Build/Release Baseline
- Git branch: `main`
- Latest commit at handoff: `932b72c`
- `npm run build`: passing
- Netlify: Git-linked deployment path active

## Migration Intent (Codex -> Claude/Co-work)
This repo now contains the latest operational context and next-task roadmap so cloud co-work can continue without re-discovery.
