# CURRENT_STATUS.md - PracticeIQ

Last updated: 2026-05-05 (post Section 14 Step 3C closure, C-2026-05-03-01; Pre-3D Product Architecture & SaaS Guardrail Scan adoption, C-2026-05-03-02; Governance File Maintenance & Independent Review Protocol adoption, C-2026-05-03-03; Cost Discipline at Stage 0 adoption, C-2026-05-03-04; External Threat Security & Platform Hardening Guardrails adoption, C-2026-05-03-05; Section 14 Step 3D-1 push and deploy, C-2026-05-04-01; post-3D-1 deployment sync, C-2026-05-04-02; Section 14 Step 3D-2 push and deploy, C-2026-05-04-03; post-3D-2 deployment sync, C-2026-05-04-04; Section 14 Step 3D-3 push and deploy, C-2026-05-04-05; post-3D-3 deployment sync, C-2026-05-04-06; Step 3 checkpoint audit + governance touchup, C-2026-05-04-07; and pre-3E permissions matrix touchup, C-2026-05-05-01)
Update rule: edit after every milestone, audit, or stage shift.

## Repo Health

- Branch: `main` (in sync with `origin/main`)
- Latest verified runtime/code commit: `8bcf4d1` (`Section 14 Step 3D-3: Add tasks lifecycle actions (close + reopen + cancel)`)
- Section 14 Step 3D-3 pushed, deployed, and Netlify-verified live on 2026-05-04: `GET /api/tasks`, `GET /api/tasks/[id]`, and `GET /api/activity` all return 401 with `{"ok":false,"message":"Authentication required."}`, confirming the locked-by-default contract holds end-to-end across the Tasks and Activity route groups. New lifecycle endpoints `/api/tasks/[id]/close`, `/api/tasks/[id]/reopen`, and `/api/tasks/[id]/cancel` are registered in the build route table per the Netlify deploy of `8bcf4d1`. With 3D-3 in place, full Section 14 Step 3D (Tasks route group) is complete; pending route groups are `team/` (3E) and `modules/` (3F) only.
- Live URL: `https://practice-iq.netlify.app/` (Netlify auto-deploys from GitHub `main`)
- Build: `npm run uat:check` passing per Pankaj's local verification (note: origin renamed `release:check` to `uat:check`)
- Five Netlify env vars set: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Supabase project: provisioned in Mumbai (`ap-south-1`); first migration `20260429185225_init_postgres` applied
- **Stage gate**: Founder-led POC (Stage 0). Pre-real-client-data checklist not yet started. See MASTER_PROJECT.md Section 22 and D-2026-05-03-01.
- **Pre-3D guardrail scan adopted**: Section 14 Step 3D plan must consume MASTER_PROJECT.md Section 23 (TaskStatus / Priority canonical sets, transition matrix, reopen / cancel / closure rules, inactive user / client handling, cross-firm ID validation, audit event taxonomy, plan-tier feature codes, entitlement helper shape, Writing Assist deferred guardrails) as implementation constraints. See D-2026-05-03-02 and AGENTS.md G7.
- **Governance protocol active**: Pre-commit five-file consistency check applies from C-2026-05-03-03 forward. Independent ChatGPT review is a named control input at major Section 14 transitions. See MASTER_PROJECT.md Section 24 and AGENTS.md G8.
- **Cost discipline at Stage 0 active**: every recommendation that touches tooling, infrastructure, or spend uses the four-row template (Free / Paid / Recommendation / Trigger) per AGENTS G9. Detailed principle at MASTER_PROJECT.md Section 22.9. See D-2026-05-03-04.
- **Security guardrails active**: Section 14 Step 3D and onward route planning consumes MASTER_PROJECT.md Section 25 (route-construction checklist, task-route specifics, Step 4 requirements, RLS / DB requirements, platform hardening, monitoring, future module security, G9 cost-discipline matrix, CA / CPA client-trust lens, Platform Ownership Register status, consumption rule) alongside Section 23. AGENTS G7 effective scope is extended to include Section 25 by D-2026-05-03-05; no new G10 added. See D-2026-05-03-05.
- **Step 3D-1 pushed, deployed, and Netlify-verified**: Tasks foundation + read/create routes live on `https://practice-iq.netlify.app` since 2026-05-04 (commit `8754760`). `/api/tasks` and `/api/tasks/[id]` return 401 locked-by-default with the standard `{"ok":false,"message":"Authentication required."}` envelope. Decisions A through F locked at D-2026-05-04-01; Decisions G / H / I consumed from Section 25. See C-2026-05-04-01 for the implementation wave and C-2026-05-04-02 for this post-deployment doc-sync. 3D-2 (Tasks mutations) and 3D-3 (Tasks lifecycle actions) remain pending.
- **Step 3D-2 pushed, deployed, and Netlify-verified**: Tasks mutations live on `https://practice-iq.netlify.app` since 2026-05-04 (commit `13d8b4f`). PATCH `/api/tasks/[id]` (corrected permission flow with TASK_VIEW first-gate + operation classifier dispatching to TASK_EDIT or TASK_MOVE_TO_REVIEW per D-2026-05-04-02), POST `/api/tasks/[id]/notes` (status-less progress note), and PATCH `/api/tasks/[id]/assignees` (set-semantics add/remove with route-layer ARTICLE_STAFF rejection per Section 23.5). `/api/tasks` and `/api/tasks/[id]` still return 401 locked-by-default with the standard `{"ok":false,"message":"Authentication required."}` envelope; the new `/notes` and `/assignees` endpoints are registered in the build route table (POST and PATCH respectively; GET on either returns 405 Method Not Allowed which itself proves route registration). Decisions J1 / K1 / L1 locked at D-2026-05-04-02. No changes to `src/lib/permissions.ts` or `src/lib/task-constants.ts`. See C-2026-05-04-03 for the implementation wave and C-2026-05-04-04 for the post-deployment doc-sync. 3D-3 status now pushed, deployed, and Netlify-verified (see next bullet).
- **Step 3D-3 pushed, deployed, and Netlify-verified**: Tasks lifecycle actions live on `https://practice-iq.netlify.app` since 2026-05-04 (commit `8bcf4d1`). POST `/api/tasks/[id]/close`, POST `/api/tasks/[id]/reopen`, and POST `/api/tasks/[id]/cancel` registered in the build route table per the Netlify deploy of `8bcf4d1`. `/api/tasks`, `/api/tasks/[id]`, and `/api/activity` all still return 401 locked-by-default with the standard `{"ok":false,"message":"Authentication required."}` envelope; the new lifecycle endpoints accept POST only (GET on any of them returns 405 Method Not Allowed which itself proves route registration). Two new permission action codes added in 3D-3: `Action.TASK_REOPEN` and `Action.TASK_CANCEL`. Implements Decision M = M1 (visibility-then-permission for ARTICLE_STAFF on lifecycle endpoints) and the reopen field-clear correction (closure fields cleared on reopen — `closedAt`, `closedById`, `closureRemarks` all set to null) locked at D-2026-05-04-03. Also updated MASTER Section 23.6 `TASK_CLOSE` audit-metadata row to `{ noteId }` reference per Decision I alignment. Files shipped: `src/lib/permissions.ts` (REWRITE — added `Action.TASK_REOPEN`, `Action.TASK_CANCEL` + base array additions for FIRM_ADMIN / PARTNER + 2 context-aware rules in `hasPermission()`), `src/app/api/tasks/[id]/close/route.ts` (NEW), `src/app/api/tasks/[id]/reopen/route.ts` (NEW), `src/app/api/tasks/[id]/cancel/route.ts` (NEW). No `src/lib/task-constants.ts` change. With 3D-3 done, full Section 14 Step 3D (Tasks route group) is complete; pending route groups become `team/` (3E) and `modules/` (3F) only. See C-2026-05-04-05 for the implementation wave and C-2026-05-04-06 for this post-deployment doc-sync.
- **Step 3 checkpoint audit completed (post-3D close, pre-3E)**: Result **YELLOW** with five low-severity findings; zero critical issues, zero security defects, zero runtime risk. Audit run on committed state at runtime/code SHA `8bcf4d1` and doc-sync HEAD `6f8710e`. Findings: F1 (clients routes 3B lack `.strict()` on body schemas — governance-compliant per "from 3D onward" wording but pattern-divergent), F2 (clients routes 3B lack cross-firm `console.warn` per Section 25.4 #15 — same status as F1), F3 (Section 23.3 reopen prose did not mention `closureRemarks` clearing), F4 (Section 25.5 conflated edit/close permission requirements), F5 (Section 23.3 cancel wording said "any non-terminal state" but implemented behaviour rejects `CLOSED`). **F3, F4, F5 fixed in this touchup wave (C-2026-05-04-07)** — MASTER Section 23.3 reopen + cancel blocks and Section 25.5 permission wording rewritten to match approved code behaviour locked at D-2026-05-04-02 and D-2026-05-04-03. **F1 / F2 deferred** to Step 4 Auth hardening (which touches every route anyway) or a separate small clients-route cleanup wave. No code change in this touchup; code is the approved behaviour, docs are aligning to it. Section 14 Step 3D remains closed; 3E remains pending. See C-2026-05-04-07.
- **Pre-3E permissions matrix touchup drafted locally**: One-line code change to `src/lib/permissions.ts` adding `Action.TEAM_VIEW` to the FIRM_ADMIN base permission array (Path-1 selected: ship as a separate tiny pre-3E-1 commit rather than bundling into 3E-1 implementation). Discovered during the 3E-1 plan re-read on 2026-05-05; FIRM_ADMIN previously had `TEAM_MANAGE` but not `TEAM_VIEW` in the base array. The Step 3 checkpoint audit did not catch this because no current route consumes `TEAM_VIEW`. The matrix change is dormant until Step 4 wires real sessions AND 3E-1 routes ship; locked-by-default 401 contract is unaffected. **3E-1 decisions A1 / B1 / C1 / D1 / E1 approved**: A1 (ARTICLE_STAFF can see full firm team list including email), B1 (default-hide inactive members; `?status=active|inactive|all` filter), C1 (`q` search is name-only for 3E-1), D1 (create `src/lib/team-constants.ts` during 3E-1 implementation), E1 (this matrix touchup; Path-1). **3E-1 implementation has NOT started**: no `src/app/api/team/route.ts`, no `src/app/api/team/[id]/route.ts`, no `src/lib/team-constants.ts`. Only the permissions-matrix one-line fix and three governance-doc edits in this wave. See C-2026-05-05-01 and D-2026-05-05-01. Latest verified runtime/code commit (line above) NOT advanced — stays at `8bcf4d1` until this touchup commit pushes and Netlify verifies.

## Current Stage

**Phase 1 - Prototype hardening.** Section 14 status (post-cloud-Codex divergence reconciliation, D-2026-04-30-15):

- Step 1 (Foundation cutover): **DONE**. `next.config.ts` flipped off static export, `netlify.toml` updated, `.env.example` documents the env-var contract, four memory files at app root.
- Step 2 (Postgres + Prisma wiring): **PARTIALLY DONE**. Origin shipped Postgres provider + first migration + `src/lib/prisma.ts`. Pending: `AllowedFirmDomain` (origin used `Firm.emailDomain` single-string instead per D-2026-04-30-15), `UserNotificationPreference`, `NotificationLog`, `NotificationChannel` and `NotificationType` enums.
- Step 3 (API layer scaffold): **PARTIALLY DONE**. Sub-steps 3A (commit `093a816`), 3B (commit `d1fad2f`), 3C (commit `7e62c99`), 3D-1 (Tasks foundation + read/create routes, C-2026-05-04-01, commit `8754760`), 3D-2 (Tasks mutations: PATCH + notes + assignees, C-2026-05-04-03 / D-2026-05-04-02, commit `13d8b4f`), and 3D-3 (Tasks lifecycle actions: close + reopen + cancel, C-2026-05-04-05 / D-2026-05-04-03, commit `8bcf4d1`) **DONE** — pushed, deployed, and Netlify-verified. Full Section 14 Step 3D (Tasks route group) is now complete. Origin's 5 firm / tenant routes still present, untouched. Pending: 3E team, 3F modules.
- Step 4 (Supabase Auth + tenant-guard + RBAC): **PARTIALLY DONE**. Origin shipped `src/lib/tenant-guard.ts` (53 lines, email / domain validation). Step 3A added the codified permission matrix at `src/lib/permissions.ts` (Section 10); 3C extended it with `Action.ACTIVITY_VIEW`. Pending: full Supabase Auth replacing the hardcoded SHA-256 password digest, hardening of origin's existing 5 routes, allowed-domain enforcement at the API layer.
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
- **Section 10 permission matrix codified** at `src/lib/permissions.ts` (PlatformRole / FirmRole / Action constants including `ACTIVITY_VIEW`, `hasPermission`, `requirePermission`, UI label maps, role normalizers).
- **API helper foundation** at `src/lib/api-helpers.ts` (response envelopes, locked-by-default `requireAuth`, Zod-backed `parseJson`, deferred no-op `writeActivityLog`).
- **Clients API** at `/api/clients` (GET list paginated + POST create) and `/api/clients/[id]` (GET one + PATCH update with soft-delete via `status: "INACTIVE"`). Tenant-isolated by `firmId`; cross-firm hits return 404; auth-gated and locked-by-default until Step 4.
- **Activity API** at `/api/activity` (GET list paginated + filtered by `entityType` / `action` / `from` / `to`). Tenant-isolated by `firmId`; ARTICLE_STAFF server-scoped to own actor; PLATFORM_OWNER without firm context returns 400; auth-gated and locked-by-default until Step 4. Returns empty results until Step 4 lights up `writeActivityLog()`.

## What Is Partially Built

- API layer - 5 firm / tenant routes exist (origin); clients route group landed in 3B; activity read route landed in 3C; tasks / team / modules route groups not yet.
- Auth - `tenant-guard.ts` (email / domain validation) and `permissions.ts` (Section 10 matrix) exist; Supabase Auth not yet replacing hardcoded password digest; `requireSession()` is a deliberate stub returning null until Step 4.
- RBAC - role-based UI visibility implemented; permission matrix codified at API layer (3A) and consumed by clients (3B) and activity (3C) routes; origin's 5 routes not yet on the matrix (deferred to Step 4 per Decision 5).
- Email reminder structure - referenced in UI, not sending.
- Notification preferences / log architecture - entities and enums not yet in schema (D-2026-04-30-10 work pending).
- Audit trail - `ActivityLog` table exists; read route is live (3C) but `writeActivityLog()` is still a documented no-op until Step 4 supplies a real `actorId` (D-2026-04-30-15 Decision 4); reads will return empty results until then.

## What Is Missing

- `tasks/`, `team/`, `modules/` API route groups.
- Supabase Auth replacing hardcoded SHA-256 password digest.
- Hardening of origin's existing 5 routes (deferred to Step 4 per D-2026-04-30-15 Decision 5).
- `AllowedFirmDomain` table (origin used single `Firm.emailDomain` instead; revisit when multi-domain support is needed).
- `UserNotificationPreference`, `NotificationLog` tables and `NotificationChannel` / `NotificationType` enums.
- `ActivityLog` writes (no-op stub in place; lights up in Step 4).
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
6. Compliance posture open (DPDP Act applicability, audit retention period, RLS configuration). Tracked under the Pilot-to-SaaS Scaling Guardrails framework (MASTER_PROJECT.md Section 22, pre-real-client-data checklist 22.5).
7. New 3B and 3C routes are correctly locked-by-default (401 until Step 4) - this is the safety contract, not a defect. Confirm Step 4 lights them up before any UI consumes them.

## Deployment Readiness

- Single-tenant prototype build: live, stable, Postgres-backed (via origin's first migration), serving from dynamic Next.js Runtime.
- Multi-firm GA: not ready. Blocked on full Step 4 (Auth + RBAC) and Step 5 (Persistence cutover) plus the Product Experience Review (Section 20.7).
- Production data safety: improved over earlier (Postgres exists), but hardcoded admin creds, RLS not configured, no audit log writes yet. Do not put real client confidential data into the platform yet.

## Next 5 to 10 Priority Tasks

In execution order, gated by Plan → Approval → Execution → Test → Log:

1. **Section 14 Step 3D - Tasks routes** - the largest route group (CRUD + status moves + notes + assignees). Plan-first; this one will be split across multiple commits.
2. **Section 14 Step 3E - Team routes** - membership add / role-change / deactivate; reuses `permissions.ts` `TEAM_MANAGE` / `TEAM_VIEW`.
3. **Section 14 Step 3F - Modules routes** - flag toggling per firm; PLATFORM_OWNER only.
4. **Section 14 Step 4 - Supabase Auth + RBAC hardening** - replace hardcoded login with Supabase Auth, wire `requireSession()` to real session, harden origin's existing 5 routes onto `requireAuth`, light up `writeActivityLog()` and the Step 3 routes (clients + activity).
5. **Decide on `Firm.emailDomain` vs `AllowedFirmDomain`** - confirm origin's single-string approach is acceptable or schedule the multi-domain extension (D-2026-04-30-15).
6. **Decide on `release-data-guard.mjs` removal** - origin deleted; do we reinstate (with our regex + ignored-files setup) or accept origin's removal?
7. **Continue Section 14 Step 2** - add `UserNotificationPreference`, `NotificationLog` entities and `NotificationChannel` / `NotificationType` enums to the schema (D-2026-04-30-10), or defer to Phase 2.
8. **Begin Section 14 Step 5** - migrate UI from localStorage to API; one-time browser-side export endpoint; activate `ActivityLog` writes.
9. **Split `src/app/page.tsx` into modules** (`NEXT_TASKS.md` item 4; regression-risk reduction before broader UI changes).

## Validation Checklist (operational, before commit)

- Login page has no visible owner credential hint text.
- Branding shows `PracticeIQ` consistently in tab title, header, sidebar.
- Role-specific sections are hidden / shown correctly per profile.
- Firm Setup tab visible only to Platform Owner.
- `npm run uat:check` passes (lint + db:validate + build).
