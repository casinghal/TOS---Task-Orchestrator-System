# CURRENT_STATUS.md - PracticeIQ

Last updated: 2026-04-30 (post cloud-Codex reconciliation, D-2026-04-30-15)
Update rule: edit after every milestone, audit, or stage shift.

## Repo Health

- Branch: `main` (in sync with `origin/main`)
- Latest commit: `eaac64f` (`Add migration handover docs for cloud co-work`)
- Live URL: `https://practice-iq.netlify.app/` (Netlify auto-deploys from GitHub `main`)
- Build: `npm run uat:check` passing per Pankaj's local verification (note: origin renamed `release:check` to `uat:check`)
- Five Netlify env vars set: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Supabase project: provisioned in Mumbai (`ap-south-1`); first migration `20260429185225_init_postgres` applied

## Current Stage

**Phase 1 - Prototype hardening.** Section 14 status (post-cloud-Codex divergence reconciliation, D-2026-04-30-15):

- Step 1 (Foundation cutover): **DONE**. `next.config.ts` flipped off static export, `netlify.toml` updated, `.env.example` documents the env-var contract, four memory files at app root.
- Step 2 (Postgres + Prisma wiring): **PARTIALLY DONE**. Origin shipped Postgres provider + first migration + `src/lib/prisma.ts`. Pending: `AllowedFirmDomain` (origin used `Firm.emailDomain` single-string instead per D-2026-04-30-15), `UserNotificationPreference`, `NotificationLog`, `NotificationChannel` and `NotificationType` enums.
- Step 3 (API layer scaffold): **PARTIALLY DONE**. Origin shipped 5 API routes under `src/app/api/firms/` and `src/app/api/tenant/validate/`. Pending: `clients/`, `tasks/`, `team/`, `activity/`, `modules/` route groups.
- Step 4 (Supabase Auth + tenant-guard + RBAC): **PARTIALLY DONE**. Origin shipped `src/lib/tenant-guard.ts` (53 lines, email / domain validation). Pending: full Supabase Auth replacing the hardcoded SHA-256 password digest, codified permission matrix per Section 10, allowed-domain enforcement.
- Step 5 (Persistence cutover): **NOT STARTED**. UI still uses localStorage; API routes exist but UI does not consume them yet.

## What Is Working

- Live URL serves PracticeIQ branding consistently.
- Login flow with role-aware access (Platform Owner + firm-domain users).
- Role-based dashboards (Platform Owner / Firm Admin / Partner / others) and section visibility.
- Task lifecycle Open → In Progress → Pending Client / Internal → Under Review → Closed.
- Multi-assignee, mandatory reviewer, reviewer-closes-not-assignee enforcement at UI level.
- Progress notes with author and timestamp, closure remarks.
- Assignment-level and client-level rollups.
- Project Review view with sequencing / reassignment controls.
- Team access management (add user, role update, deactivate / reactivate, password reset).
- Admin module controls and activity monitor.
- **Firm Setup section** (active firm profile + add additional firms, Platform Owner gated).
- localStorage persistence for the UI workspace state.
- Netlify Next.js Runtime active; `.next/` published; `@netlify/plugin-nextjs` auto-detected; security headers preserved.
- Five Netlify env vars configured.
- Supabase project provisioned in Mumbai with first migration applied.
- `npm run lint`, `npm run db:validate`, `npm run uat:check` all passing.

## What Is Partially Built

- API layer - 5 firm / tenant routes exist; clients / tasks / team / activity / modules route groups not yet.
- Auth - `tenant-guard.ts` (email / domain validation) exists; Supabase Auth not yet replacing hardcoded password digest.
- RBAC - role-based UI visibility implemented; centralized permission map per Section 10 not yet codified.
- Email reminder structure - referenced in UI, not sending.
- Notification preferences / log architecture - entities and enums not yet in schema (D-2026-04-30-10 work pending).

## What Is Missing

- `clients/`, `tasks/`, `team/`, `activity/`, `modules/` API route groups.
- Supabase Auth replacing hardcoded SHA-256 password digest.
- `AllowedFirmDomain` table (origin used single `Firm.emailDomain` instead; revisit when multi-domain support is needed).
- `UserNotificationPreference`, `NotificationLog` tables and `NotificationChannel` / `NotificationType` enums.
- `ActivityLog` writes (table exists in schema; no writes yet).
- Email reminders sending (architecture only, no scheduler / template pipeline).
- Test suite (no smoke tests, no integration tests).
- Backup / monitoring beyond Supabase defaults.

## Known Technical Risks

(See MASTER_PROJECT.md Section 16 for full text.)

1. Static-export trap - **RESOLVED 2026-04-30** (Section 14 Step 1 close).
2. Single-file `src/app/page.tsx` carries large amount of UI, state, and logic. Modular split planned (`NEXT_TASKS.md` item 4).
3. localStorage is the prototype's only persistence layer for UI workspace state; data is browser-local until Section 14 Step 5.
4. Origin's `Firm.emailDomain` (single-string) instead of D-2026-04-30-10's planned `AllowedFirmDomain` table - acceptable for current single-firm prototype; revisit when commercial activation requires multi-domain firms.
5. Hardcoded Platform Owner SHA-256 password digest still ships in the client bundle. Removed in Section 14 Step 4 when Supabase Auth lands.
6. Compliance posture open (DPDP Act applicability, audit retention period, RLS configuration).

## Deployment Readiness

- Single-tenant prototype build: live, stable, Postgres-backed (via origin's first migration), serving from dynamic Next.js Runtime.
- Multi-firm GA: not ready. Blocked on full Step 4 (Auth + RBAC) and Step 5 (Persistence cutover) plus the Product Experience Review (Section 20.7).
- Production data safety: improved over earlier (Postgres exists), but hardcoded admin creds, RLS not configured, no audit log writes yet. Do not put real client confidential data into the platform yet.

## Next 5 to 10 Priority Tasks

In execution order, gated by Plan → Approval → Execution → Test → Log:

1. **Decide on `Firm.emailDomain` vs `AllowedFirmDomain`** - confirm origin's single-string approach is acceptable or schedule the multi-domain extension. Documented in D-2026-04-30-15.
2. **Decide on `release-data-guard.mjs` removal** - origin deleted; do we reinstate (with our regex + ignored-files setup) or accept origin's removal?
3. **Continue Section 14 Step 2** - add `UserNotificationPreference`, `NotificationLog` entities and `NotificationChannel` / `NotificationType` enums to the schema (D-2026-04-30-10), or defer to Phase 2.
4. **Continue Section 14 Step 3** - add remaining API route groups (`clients/`, `tasks/`, `team/`, `activity/`, `modules/`) following the standard handler pattern.
5. **Continue Section 14 Step 4** - replace hardcoded login with Supabase Auth, codify Section 10 permission matrix, enforce firm-domain rule via `tenant-guard.ts`.
6. **Begin Section 14 Step 5** - migrate UI from localStorage to API; one-time browser-side export endpoint; activate `ActivityLog` writes.
7. **Split `src/app/page.tsx` into modules** (`NEXT_TASKS.md` item 4; regression-risk reduction before broader UI changes).
8. Open: confirm pricing values per D-2026-04-30-06 plan tier feature contents.
9. Open: compliance decisions (DPDP Act applicability, audit retention period, RLS posture).
10. Open: build smoke test baseline (`NEXT_TASKS.md` item 9).

## Validation Checklist (operational, before commit)

- Login page has no visible owner credential hint text.
- Branding shows `PracticeIQ` consistently in tab title, header, sidebar.
- Role-specific sections are hidden / shown correctly per profile.
- Firm Setup tab visible only to Platform Owner.
- `npm run uat:check` passes (lint + db:validate + build).
