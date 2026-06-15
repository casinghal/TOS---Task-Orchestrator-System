# MASTER_PROJECT.md - PracticeIQ

## 0. Identity & Document Control

| | |
|---|---|
| Product name | PracticeIQ |
| Internal codename (Phase-0 era) | TOS (Task Orchestration System) |
| Owner | Pankaj Singhal, Avantage Partners |
| App location | `02_App/tos-app/` |
| Live URL | `https://practice-iq.netlify.app` (single-tenant prototype) |
| Document version | v2.2 |
| Last meaningful update | 2026-05-03 (post External Threat Security & Platform Hardening Guardrails, D-2026-05-03-05) |

Update rule: edit only on architectural, product, or strategic change. Operational status lives in `CURRENT_STATUS.md`. Decisions in `DECISION_LOG.md`. Implementation history in `CHANGE_LOG.md`.

## 1. Product Definition

PracticeIQ is a SaaS practice and task management platform for Chartered Accountant firms. It turns scattered work tracking into a disciplined, review-driven system: every task has a client, a reviewer, and a closure path. Phase 1 ships a brutally simple "My Tasks" workspace; the SaaS scaffolding for billing, modules, and multi-firm operations is built behind the scenes.

## 2. Target Users

Five roles, hierarchy from platform-wide to task-level:

- **Platform Owner** - owns the SaaS, controls firms, plans, modules, exports, and security.
- **Firm Admin** - runs one firm: team, clients, tasks, firm reports, allowed settings.
- **Partner** - supervises work, creates tasks, reviews and closes.
- **Manager** - creates and assigns tasks, executes, reviews where needed.
- **Article / Staff** - works on assigned tasks, posts progress notes, moves work to Under Review.

## 3. Core Problem

CA firms cannot answer simple operational questions fast: what is pending, who owns it, which client, what is due or overdue, what is stuck (with the client or internally), what is under review, what closed and by whom. PracticeIQ makes those answers reachable in one screen.

## 4. SaaS Positioning

Principle: **Build C, show A**. Architecture is full-SaaS multi-tenant from day one (firms, plans, module flags, subscriptions, activity log, allowed-firm-domains, notification preferences). The visible product is a single firm's task workspace. Hidden modules activate on Platform Owner toggle, not by code change.

Modules currently scaffolded but hidden from normal users (per D-2026-04-30-14):

- Client Portal
- Document Upload
- WhatsApp Reminders
- AI Assignment Builder (and other Section 19 capabilities)
- Advanced Reports
- Billing / Subscription
- Email Integration

These appear only in a controlled "Plan & Modules" / "Upgrade Features" / "Subscription Settings" surface visible to Platform Owner and Firm Admin. They never appear as locked or disabled-state buttons scattered across operational screens (per Section 21.3 monetization discipline).

## 5. Revenue Model

**Hybrid pricing**: per-firm base fee that includes N seats, per-user fee above the cap.

- Plan tiers: Free Trial → Starter → Professional → Enterprise.
- Billing portal stays hidden until Platform Owner activates it (per `09_PAYWALL`).
- Currency: INR for Indian firms; multi-currency deferred to Phase 4+ (CPA expansion).

### Plan tier feature contents (locked per D-2026-04-30-14; pricing values TBC)

| Plan | Included features |
|---|---|
| **Starter** | Tasks; Clients; Team; Basic reports |
| **Professional** | Starter + Recurring workflows; Client Request Reminder Engine (Section 21.1); Advanced reports; Email reminders |
| **Enterprise** | Professional + Client Portal (Section 21.2 pre-conditions all met); Document Upload; WhatsApp reminders; AI-assisted assignment builder (Section 19); Capacity intelligence (Section 19); Audit log search; Advanced admin controls |

Feature access is enforced by **plan + module flag + firm-level activation + Platform Owner override**. Premium features surface only in a clean upgrade / plan area, never scattered across operational screens (Section 21.3).

To be confirmed (not blocking): base fee per tier, value of N, per-user rate above cap, annual discount, free-trial duration.

## 6. Target Market

Phase 1 to 3: **Indian CA firms**, mid-sized (5 to 50 staff) is the sweet spot. Geographic, regulatory, and language defaults are India (PAN, GSTIN, IST, INR).

Phase 4+: architecture stays CPA-ready (multi-tenant, locale-flexible, tax-ID polymorphism is a known schema lift) so US and Canada CPA firms can be onboarded without re-platforming.

## 7. Current Architecture

**Frontend**: Next.js 16.2.4 + React 19 + Tailwind 4. Single-file `src/app/page.tsx` carries the main UI surface (modular split planned per `NEXT_TASKS.md` item 4). State managed via `useState`; persistence via `localStorage` for the UI workspace state. Login screen uses Montserrat + deep-grey theme; in-app uses Poppins. Role-based dashboards (Platform Owner / Firm Admin / Partner / others), assignment / project review, team access management, and Firm Setup section all implemented.

**Backend**: Next.js dynamic runtime active on Netlify (Section 14 Step 1 close, 2026-04-30). Five origin API routes under `src/app/api/` (firms/, firms/[firmId]/, firms/[firmId]/access/, firms/[firmId]/members/, tenant/validate/) shipped by cloud Codex on `origin/main`. `src/lib/tenant-guard.ts` (53 lines) handles email / domain validation. `src/lib/prisma.ts` (15 lines) is the Prisma client singleton. Clients routes (`clients/`, `clients/[id]`) shipped in Step 3B (commit `d1fad2f`). Activity read route (`activity/`) shipped in Step 3C (commit `7e62c99`). Remaining API route groups (`tasks/`, `team/`, `modules/`) arrive in Step 3 continuation. Full Supabase Auth replacing the hardcoded SHA-256 password digest arrives in Step 4.

**Database**: Prisma schema at `prisma/schema.prisma`, provider `postgresql`. First migration `prisma/migrations/20260429185225_init_postgres/migration.sql` (294 lines) applied to a Supabase Postgres project provisioned in Mumbai (`ap-south-1`). Schema retains multi-tenant `firmId` on every firm-scoped entity. Origin uses `Firm.emailDomain` (single string) for the firm-domain rule; D-2026-04-30-10's planned `AllowedFirmDomain` table is deferred (D-2026-04-30-15). `UserNotificationPreference`, `NotificationLog`, and the `NotificationChannel` / `NotificationType` enums are NOT yet in the schema; pending. `supabase/schema.sql` is now a historical reference; Prisma migrations are the source of truth.

**Hosting**: Netlify Next.js Runtime, `@netlify/plugin-nextjs` auto-detected, publishes `.next/`. Live at `https://practice-iq.netlify.app/` (Netlify auto-deploys from GitHub `main`). Five env vars set on Netlify: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 8. Tech Stack

| Layer | Current | Target (locked) |
|---|---|---|
| Framework | Next.js 16.2.4, React 19, TypeScript 5 | same |
| Styling | Tailwind 4 + PostCSS | same |
| Build target | Dynamic Next.js runtime with serverless functions | same |
| ORM | Prisma 6.19 (postgresql) | same |
| Database | Supabase Postgres (Mumbai `ap-south-1`); first migration `20260429185225_init_postgres` applied | same |
| Auth | Hardcoded SHA-256 hash in client bundle | Supabase Auth |
| Hosting | Netlify with Next.js Runtime publishing `.next/`; `@netlify/plugin-nextjs` auto-detected | same |
| Icons / UI | lucide-react | same |
| Email | not wired | provider TBC (Resend / SES candidate) |

## 9. Core Modules

**Active in Phase 1** (visible to firm users): Tasks, Clients, Team, Reports, Admin, Email reminder structure (sending depends on configuration).

**Scaffolded but hidden** (Platform Owner activates): Billing portal, WhatsApp reminders, AI assistant, Workflow templates, Integrations.

Module flags live in the `ModuleFlag` and `FirmModuleAccess` tables. Toggling a flag changes visibility, not code.

## 10. User Roles & Permission Matrix

| Action | Platform Owner | Firm Admin | Partner | Manager | Staff |
|---|---|---|---|---|---|
| Create task | n/a | yes | yes | yes | no |
| Edit task fields | n/a | yes | creator / reviewer | creator / reviewer | no |
| Add progress note | n/a | yes | yes | yes | yes |
| Move to Under Review | n/a | yes | yes | yes | yes (own tasks) |
| Close task (final) | n/a | yes | reviewer only | reviewer only | no |
| Manage clients | n/a | yes | yes | yes | view |
| Manage team | n/a | yes | view | view | view |
| View reports | n/a | yes | yes | yes | own |
| Manage modules | yes | no | no | no | no |
| Cross-firm impersonate | yes (audited) | no | no | no | no |

Reviewer is mandatory on every task. Reviewer closes; assignee cannot self-close.

## 11. Key Workflows

**Task lifecycle**: Open → In Progress → Pending Client / Pending Internal → Under Review → Closed. Status moves are notes-attached. Closure requires `closureRemarks` and `closedById`.

**Client-master rule**: a client must exist before a task can be created against it. Client master is minimal (name required; PAN, GSTIN, email, mobile optional).

**Review and closure rule**: assignee finishes work and moves to Under Review. The pre-selected reviewer (mandatory at task creation) verifies and closes with closure remarks. Assignees cannot close their own tasks.

**Progress notes**: every status change or update can carry a short note with author and timestamp. Audit-grade history without forcing structure.

## 12. Data Model Summary

Tenant boundary: every firm-scoped entity carries `firmId`.

| Entity | Key relationships |
|---|---|
| `Firm` | has many `FirmMember`, `Client`, `Task`, `ActivityLog`; one `FirmSubscription`; many `FirmModuleAccess`; many `AllowedFirmDomain` (planned) |
| `PlatformUser` | many `FirmMember` (one user can join multiple firms); creator / reviewer / closer of `Task`; author of `TaskNote` |
| `FirmMember` | links `Firm` to `PlatformUser` with `firmRole` |
| `Client` | belongs to `Firm`; has many `Task` |
| `Task` | belongs to `Firm` and `Client`; mandatory `reviewerId`; many `TaskAssignee`; many `TaskNote` |
| `TaskAssignee` | links `Task` to `PlatformUser` (multi-assignee) |
| `TaskNote` | belongs to `Task`; carries `oldStatus`, `newStatus`, author, timestamp |
| `ActivityLog` | firm-scoped audit trail (currently unwritten) |
| `Plan`, `FirmSubscription` | billing readiness |
| `ModuleFlag`, `FirmModuleAccess` | feature gating |

**Origin's actual implementation (post 2026-04-30 reconciliation, D-2026-04-30-15)**:

Cloud Codex shipped a simpler firm-domain model: a single `emailDomain   String?` field directly on the `Firm` model. The `AllowedFirmDomain` table planned per D-2026-04-30-10 is therefore not in the live schema. Acceptable for the current single-firm prototype; revisit when commercial activation requires firms with multiple domains. The notification entities and enums below remain as planned and are NOT yet in the schema; they remain Phase-2 work.

**Planned for Phase 2 / 4** (per D-2026-04-30-10; not yet shipped):

- `AllowedFirmDomain` - one or more email domains permitted per `Firm`. Firm Admin invites users only within these domains; Platform Owner can grant exceptions. Origin's current `Firm.emailDomain` single-string can be migrated to this table when needed.
- `UserNotificationPreference` - per-user opt-in / opt-out per `NotificationChannel` and `NotificationType`. Firm-level defaults override-able by user.
- `NotificationLog` - audit trail of every notification sent (channel, type, recipient, payload reference, timestamp, status).

Enums planned:

- `NotificationChannel`: EMAIL, WHATSAPP, IN_APP.
- `NotificationType`: DUE_REMINDER, OVERDUE_ALERT, DAILY_SUMMARY, REVIEW_PENDING, ACTION_REQUIRED, CLOSURE_CONFIRMATION.

Schema is in `prisma/schema.prisma`. Postgres migration plan is in Section 14.

## 13. Authentication & RBAC Strategy

Identity model has two tiers (per D-2026-04-30-10).

**Platform Owner identity**: a dedicated SaaS root account (`admin@practiceiq.app`), never a personal email. Personal emails are permitted as recovery / backup only.

**Firm identities**: each firm owns one or more allowed email domains via `AllowedFirmDomain`. Firm Admin invites users only within the firm's allowed domains; Platform Owner can grant cross-domain exceptions. Firm users sign in with their own firm-domain emails - never with a shared `@practiceiq.app` address.

Identity provider: **Supabase Auth** (email + password to start; magic-link / SSO / Google / Microsoft Phase 2+).

Authorization: every API route runs through `src/lib/tenant-guard.ts`, which resolves the Supabase session to `(userId, firmId, firmRole, platformRole)` and rejects cross-tenant or under-privileged calls. The permission matrix in Section 10 is codified as a single permission map consumed by the guard. UI-level role gating is convenience only; the API is the boundary.

The current single-tenant prototype's hardcoded password digest in the seed is removed in Step 4 of the backend strategy and replaced with Supabase Auth.

Notification governance is part of identity: each user carries a `UserNotificationPreference` row controlling which channels (EMAIL, WHATSAPP, IN_APP) and types (DUE_REMINDER, OVERDUE_ALERT, etc.) they receive. Firm-level defaults are settable by Firm Admin; Platform Owner controls global defaults and channel availability.

## 14. Backend Strategy

Locked five-step plan. Each step gated by approval. Status as of 2026-04-30 reconciliation (D-2026-04-30-15):

1. **Foundation cutover** - **DONE**. `next.config.ts` flipped off static export; `netlify.toml` updated for the Next.js Runtime; `MASTER_PROJECT.md`, `CURRENT_STATUS.md`, `DECISION_LOG.md`, `CHANGE_LOG.md` exist at app root; `.env.example` documents the env-var contract. Live URL serves dynamic runtime with zero-downtime requirement met.
2. **Postgres + Prisma wiring** - **PARTIALLY DONE**. Cloud Codex shipped: provider switched from `sqlite` to `postgresql`; first migration `prisma/migrations/20260429185225_init_postgres/migration.sql` applied to Supabase Mumbai; `src/lib/prisma.ts` singleton in place. Pending: `AllowedFirmDomain` table (origin used single `Firm.emailDomain` instead per D-2026-04-30-15), `UserNotificationPreference`, `NotificationLog`, `NotificationChannel` and `NotificationType` enums. `supabase/schema.sql` is now a historical reference.
3. **API layer scaffold** - **DONE**. Cloud Codex shipped 5 origin API routes: `src/app/api/firms/`, `src/app/api/firms/[firmId]/`, `src/app/api/firms/[firmId]/access/`, `src/app/api/firms/[firmId]/members/`, `src/app/api/tenant/validate/`. Sub-step 3A (permissions map + API helper foundation, commit `093a816`), 3B (clients routes + soft-delete, commit `d1fad2f`), 3C (activity read route, commit `7e62c99`), 3D-1 (Tasks foundation + read/create routes, C-2026-05-04-01 / D-2026-05-04-01, commit `8754760`), 3D-2 (Tasks mutations: PATCH + notes + assignees, C-2026-05-04-03 / D-2026-05-04-02, commit `13d8b4f`), 3D-3 (Tasks lifecycle actions: close + reopen + cancel, C-2026-05-04-05 / D-2026-05-04-03, commit `8bcf4d1`), 3E-1 (Team foundation + read routes: `GET /api/team`, `GET /api/team/[id]` plus `src/lib/team-constants.ts`; decisions A1/B1/C1/D1/E1; C-2026-05-05-02 / D-2026-05-05-02, commit `caafcd2`), 3E-2A (Team add/update routes: POST `/api/team` + PATCH `/api/team/[id]`; team-constants extended with `MAX_TEAM_NAME_LENGTH` + `PLACEHOLDER_PASSWORD_HASH_PREFIX` + `generatePlaceholderPasswordHash()`; decisions A1/A-CORRECTION/D1/F1-role/G1-role/I1/I1-NORMALIZE/J1/K1/3E-2-O1/D-3E-DUPLICATE-422; C-2026-05-05-05 / D-2026-05-05-05, commit `f94027d`), and 3E-2B (Team deactivate/reactivate routes: POST `/api/team/[id]/deactivate` + POST `/api/team/[id]/reactivate`; team-constants extended with `MAX_TEAM_NOTE_LENGTH = 4000`; decisions F1-deactivate/G1-deactivate/H1/3E-2-M1/3E-2-N1/3E-2B-P; C-2026-05-05-07 / D-2026-05-05-06, commit `c5535f3`) **DONE** — pushed, deployed, and Netlify-verified. Full Section 14 Step 3D (Tasks route group) and full Step 3E (Team route group: 3E-1 read + 3E-2A add/update + 3E-2B deactivate/reactivate) are now complete; the Team backend route surface is feature-complete from a route-surface perspective. **Sub-step 3F (Modules route group): DONE** — pushed, deployed, and Netlify-verified at commit `b555eab` per C-2026-05-06-13 (D1/D2 locked at D-2026-05-06-03). Routes shipped: `GET /api/modules` (`Action.MODULES_VIEW` — all firm roles + PLATFORM_OWNER; returns merged 8-entry `ModuleFlag` catalog with per-firm `FirmModuleAccess` override; cross-firm via `?impersonateFirmId` for PLATFORM_OWNER), `PATCH /api/modules/[key]` (`Action.MODULES_MANAGE` — PLATFORM_OWNER only per D2; validates key against `isKnownModuleKey()` → 404 if unknown or unseeded; upserts `FirmModuleAccess`; emits `MODULE_ACCESS_CHANGE` audit row fail-open; Zod `.strict()` body `{ isEnabled: boolean }`). New files: `src/app/api/modules/route.ts`, `src/app/api/modules/[key]/route.ts`, `src/lib/module-constants.ts` (exports `MODULE_CATALOG` with 8 canonical entries and `isKnownModuleKey()`). ModuleFlag catalog seeded with 8 rows (deterministic string IDs; no `createdAt`/`updatedAt` on `ModuleFlag`). Focused authenticated UAT completed 2026-05-23: 65/66 direct pass (T6-5 null-body 400-vs-422 accepted as fail-closed behaviour); audit verified (`MODULE_ACCESS_CHANGE` + `CROSS_FIRM_IMPERSONATE` rows confirmed); cleanup complete; all 5 UAT3F Supabase Auth users deleted. **Full Section 14 Step 3 (API layer scaffold) is now DONE** — all sub-steps 3A, 3B, 3C, 3D (Tasks), 3E (Team), and 3F (Modules) complete. Step 5 (Persistence cutover) is the next locked step per D-2026-05-06-01.
4. **Supabase Auth + tenant-guard + RBAC** - **PARTIALLY DONE; APPROVED AS NEXT CONTROLLED STEP per D-2026-05-06-01 (Section 14 reorder); Step 4A architecture confirmed per D-2026-05-06-02; Step 4B-1 pushed, deployed, and Netlify-verified at commit `eb6dbc9` (deploy `69fb36e36770d40008a61aed`) per C-2026-05-06-04; Step 4B-2 pushed, deployed, and Netlify-verified at commit `0c47cd7` (deploy `69fb413880ff1f00084be0e4`) per C-2026-05-06-05; 4C role + firm-context resolution folded into 4B-2 per Decision 4A-D1; Step 4D pushed, deployed, and Netlify-verified at commit `1b88f80` (deploy `69fb7d0071078d0008593e00`) per C-2026-05-06-06 with F1/F2 deferred clients-route cleanup folded into the same wave; Step 4E pushed, deployed, and Netlify-verified at commit `92a73f2` (deploy `69fb82120740f20008ad9cfe`) per C-2026-05-06-07 — real fail-open `writeActivityLog()` shipped with audit pipeline now operational across 13 mutation call sites; Step 4E-FU firm-route audit call-site follow-on pushed, deployed, and Netlify-verified at commit `662126d` (deploy `69fb87f7e56dae000824ee16`) per C-2026-05-06-08 — `POST /api/firms` and `PATCH /api/firms/[firmId]` now emit `FIRM_CREATE` and `FIRM_UPDATE` ActivityLog rows; Step 4E and its firm-route audit follow-on are now closed; audit pipeline now covers 15 mutation actions; Step 4F-1 (audited cross-firm helper + collection-route integration) pushed, deployed, and Netlify-verified at commit `92282d2` (deploy `69fb8f1b8259600008f7ce88`) per C-2026-05-06-09 — NEW `src/lib/cross-firm.ts` exporting `resolveCrossFirmContext()` with explicit `?impersonateFirmId` opt-in, fail-closed inline CROSS_FIRM_IMPERSONATE audit row, separate `effectiveFirmId` (no `session.firmId` mutation), PLATFORM_OWNER-only cross-firm; integrated into 5 collection / firm-URL routes (`clients`, `tasks`, `team`, `activity`, `firms/[firmId]`); existing `Action.CROSS_FIRM_IMPERSONATE` consumed without permission-matrix change; Step 4F-2 (entity-route cross-firm integration) pushed, deployed, and Netlify-verified at commit `213a24e` (deploy `69fb96a4c5c83b0008a48350`) per C-2026-05-06-10 — 10 entity routes (`clients/[id]`, `team/[id]` × 3 lifecycle, `tasks/[id]` × 6 lifecycle including notes/assignees) now consume `resolveCrossFirmContext()`; ARTICLE_STAFF self-scope and route-layer 403 bypassed only under `isImpersonation === true` (D2 decision); same-firm role behaviour preserved exactly; cross-firm reviewer/assignee membership lookups + last-active-FIRM_ADMIN counts rebound to `effectiveFirmId`; routine post-mutation audit `firmId` follows `effectiveFirmId` while `actorId` remains the impersonator's `session.userId`. Audited PLATFORM_OWNER cross-firm impersonation is now wired across the entire firm-scoped route surface (5 collection / firm-URL routes from 4F-1 + 10 entity routes from 4F-2 = 15 total). Step 4G (Auth UAT and tenant leakage testing) is the next controlled implementation sub-wave**. Cloud Codex shipped `src/lib/tenant-guard.ts` (53 lines, email / domain validation utility — NOT a session resolver). Step 3A added the codified Section 10 permission matrix at `src/lib/permissions.ts` (extended in 3C with `Action.ACTIVITY_VIEW` and at C-2026-05-05-01 with FIRM_ADMIN base array now containing `Action.TEAM_VIEW`). Step 4A locked the auth architecture (15 decisions): Supabase Auth via `@supabase/ssr` server-managed cookie session; in-route `requireAuth(...)` for all RBAC; `requireSession()` resolution lives inside `src/lib/api-helpers.ts`; Supabase user → `PlatformUser` mapping by normalized email; firm context resolved server-side via active `FirmMember` lookup; PLATFORM_OWNER without firm context by default with audited impersonation deferred to Step 4F; inactive-user behaviour cascades to 401; multi-firm membership deferred to Stage 1 (Stage 0 fails closed on multi-active-FirmMember); five origin firms/tenant routes hardened in Step 4D; ActivityLog real writes enabled in Step 4E; `SUPABASE_SERVICE_ROLE_KEY` strictly server-only and NOT used for ordinary session resolution. Step 4B-1 (`eb6dbc9` / C-2026-05-06-03 implementation + C-2026-05-06-04 post-deploy sync) added `@supabase/ssr` `^0.5.0` (resolved 0.5.2) and `@supabase/supabase-js` `^2.45.0` (resolved 2.105.3) to `package.json` and created the dormant server-only helper `src/lib/supabase-server.ts` exporting `createSupabaseServerClient()`. Step 4B-2 (`0c47cd7` / C-2026-05-06-05 post-deploy sync) implemented real `requireSession()` in `src/lib/api-helpers.ts` (single-file edit, 95 insertions / 10 deletions): resolves authenticated Supabase user via `supabase.auth.getUser()` (validates JWT against Supabase server, never `getSession()`), normalizes email (`trim().toLowerCase()`), maps to `PlatformUser` by unique email, fails closed on absent / inactive, narrows `platformRole` and `firmRole` via the existing `normalizePlatformRole()` / `normalizeFirmRole()` helpers, resolves the unique active `FirmMember` server-side, and returns a fully populated `SessionUser`. Stage 0 fail-closed rules in force: zero active `FirmMember` returns null for ALL users including `PLATFORM_OWNER` (per the 2026-05-06 PLATFORM_OWNER edit approving option (b); no all-firm escape; impersonation is Step 4F); multiple active `FirmMember` rows returns null (Stage 0 multi-firm rule applies to every user); unknown stored role values return null. 4C is folded into 4B-2 per Decision 4A-D1 because the algorithm is one continuous lookup chain. Externally observable behaviour at Stage 0 is identical to pre-4B-2 because no Supabase users are seeded yet and no signup/signin UI is deployed; the 200 / 403 / 422 / 404 paths activate only once a real Supabase user exists in the project AND is mapped to an active PlatformUser AND has exactly one active FirmMember. Step 4D (`1b88f80` / C-2026-05-06-06 post-deploy sync) hardened the 5 origin firms/tenant routes and shipped F1/F2 deferred clients-route cleanup in a single 8-file commit (192 insertions / 141 deletions): `POST /api/firms` is auth-gated to PLATFORM_OWNER only via inline `session.platformRole` check (no new `Action.FIRM_CREATE`); `PATCH /api/firms/[firmId]` is auth-gated via the new `Action.FIRM_UPDATE` (added to FIRM_ADMIN base array; PLATFORM_OWNER short-circuit preserved); cross-firm hits on `PATCH /api/firms/[firmId]` return 404 with `console.warn` per Section 25.4 #15 (no all-firm escape; cross-firm impersonation remains Step 4F scope); `POST /api/firms/[firmId]/access` and `POST /api/firms/[firmId]/members` deprecated to 410 Gone (the latter pointing to canonical `POST /api/team`); `/api/tenant/validate` annotated as intentionally public (no behaviour change); F1/F2 clients-route cleanup landed (`.strict()` on create + update schemas; cross-firm `console.warn` on existing 404 branches in `GET` and `PATCH /api/clients/[id]`). Mandatory pre-coding grep on 2026-05-06 confirmed zero UI/source callers for the deprecated routes. No schema/migration/package/env/config/Netlify/Supabase change in 4D. Step 4E (`92a73f2` / C-2026-05-06-07 post-deploy sync) replaced the no-op body of `writeActivityLog()` in `src/lib/api-helpers.ts` with a real `prisma.activityLog.create({ data: {...} })` write wrapped in fail-open try/catch (1 file; 57 insertions / 14 deletions). Missing `DATABASE_URL` returns early without throwing; on caught error a structured `console.error` records action / entityType / entityId / firmId / actorId / error message; raw `metadataJson` is deliberately omitted from the error log to avoid surfacing free-text fields (e.g., team deactivate/reactivate `reason`) into Netlify logs on failure. Helper signature unchanged. No new imports (`prisma` already imported since 4B-2). 13 existing mutation call sites (2 clients in 3B; 7 tasks in 3D; 4 team in 3E) now write `ActivityLog` rows on successful audited mutations. Externally observable behaviour at Stage 0 is unchanged because the 200 / audit-write path requires an authenticated Supabase session (no users seeded; no login UI). Step 4E-FU (`662126d` / C-2026-05-06-08 post-deploy sync) closed the firm-route audit-trail gap by adding `writeActivityLog` call sites to the success paths of `POST /api/firms` (`FIRM_CREATE`; metadataJson omitted; entityId points at the new Firm) and `PATCH /api/firms/[firmId]` (`FIRM_UPDATE`; metadataJson lists field names `["name","city","status","emailDomain"]` only — no values). Single-purpose 2-file workpack (32 insertions / 2 deletions); no `src/lib/api-helpers.ts` change; no new permission action; no auth/RBAC behaviour change; no schema/migration/package/env/config/Netlify/Supabase change. Audit pipeline now covers **15 mutation actions** (13 from 4E + `FIRM_CREATE` + `FIRM_UPDATE` from 4E-FU). With 4E and 4E-FU closed, pending implementation sub-waves: 4F (audited PLATFORM_OWNER cross-firm impersonation flow per Section 25.6 — next controlled step), 4G (Auth UAT and tenant leakage testing). With 4A architecture, 4B-1 packages and helper, 4B-2 real `requireSession()` (folding 4C), 4D firms/tenant hardening + F1/F2 cleanup, 4E real audit writes, and 4E-FU firm-route audit emit all live and verified, Step 4G (Auth UAT and tenant leakage testing) is now **completed** per C-2026-05-06-11 — authenticated UAT against the live Netlify deployment passed effectively 96/96 (92/96 on the main automated run; T1-12 and T3-6 reclassified PASS because `POST /api/tasks/[id]/notes` correctly returns 201 Created; T1-13 and T6-9 firm-PATCH retried 2/2 with full `name`+`city`+`plan` bodies). Validated surfaces: Supabase Auth sign-in; real SSR cookie-backed sessions against live Netlify routes; same-firm access; unauthorized / locked-by-default access; tenant-leakage isolation; PLATFORM_OWNER cross-firm impersonation across all 15 firm-scoped routes (4F-1 + 4F-2); fail-closed session edge cases (inactive PlatformUser/FirmMember, zero-FirmMember, multi-FirmMember, unmapped Auth user → 401); ActivityLog audit verification (T10); deprecated routes 410; public tenant validation 200. Zero backend/source defects; no code change required; runtime/code SHA unchanged at `213a24e`. The T9 collection/entity ARTICLE_STAFF impersonation asymmetry is accepted as deliberate Stage 0 behaviour per D-2026-05-07-02. PG-5 UAT data cleanup is now complete per C-2026-05-06-12 — Part B targeted DELETEs ran in the Supabase SQL Editor, Part C verification returned all UAT counts = 0 across all 10 tables, and all 11 UAT Supabase Auth users were manually deleted from the Dashboard. The UAT fixtures and Auth users were removed only AFTER the Step 4G evidence was committed (PG-6, repo HEAD `ebc0f1a`). With Step 4G and PG-5 both complete, **Step 4 (Auth/RBAC + security spine) is now fully closed**. Step 3F (Modules) has also since completed (commit `b555eab`, C-2026-05-06-13). **Step 5 (Persistence cutover) is the next locked step per D-2026-05-06-01.**5. **Persistence cutover** - **IN PROGRESS (decomposed into 5A + 5B)**.
   - **5A (browser auth/session foundation): DONE** — commit `ea2866d`; Netlify production deploy `6a12cfe42598f50008ada2c8` reached state `ready`/published (1 serverless function + 1 edge function = the new `src/middleware.ts`). Shipped real browser sign-in (`supabase.auth.signInWithPassword`), sign-out, session restore, and `@supabase/ssr` middleware session-cookie refresh. New files `src/lib/supabase-browser.ts` + `src/middleware.ts`; contained `src/app/page.tsx` edits (real login, session restore, `signOut` logout, `SessionLoading` anti-flash gate, dead mock-crypto helpers removed). No new dependency; no Step 4 / RBAC / schema change; route-layer `requireAuth()` remains the authority (middleware is cookie-refresh only, no redirect logic). `npm run uat:check` passed (after a middleware `CookieOptions` typing fix). Browser/API UAT passed (login, reload session persistence, logout, invalid-credential fail-safe; signed-in `GET /api/team` → 200, signed-out → 401); production signed-out `/api/team` smoke returned 401-not-500; UAT test data (one Auth user + labelled `uat5a_*` rows) created then fully cleaned. No data moved off localStorage in 5A (auth/session enablement only). Closed per C-2026-05-24-01.
   - **5B (persistence / data cutover): IN PROGRESS**. Plan locked (decisions A/A/A; ChatGPT §24.6 review gate returned Go for 5B-0 only). **5B-0 (data-access layer + export bridge): DONE** — commit `1bbe34a`; Netlify production deploy `6a12e0d64cf2e700082b05fd` reached state `ready`/published; signed-out `/api/team` still 401 (no regression). NEW `src/lib/api-client.ts` (thin typed client with 401/403/422/404/503/500 status semantics, `apiGet`/`apiPost`/`apiPatch`, provisional DTOs, per-domain wrappers; NOT wired into the UI; no-API actions — task resequencing, member password reset, firm directory — deliberately not exposed). `src/app/page.tsx` gains a PracticeIQ-only JSON export bridge (workspace structures + `app`/`exportVersion`/`exportedAt` metadata; no full-localStorage scan; no Supabase/auth/session keys) on a Header button. No route/schema/DB/Auth change. Closed per C-2026-05-24-02. **Internal access baseline created** (Firm `firm_primary` + PlatformUser `pu_owner` + FirmMember `fm_owner` + matching Supabase Auth user, temporary Gmail identity as runtime debt; production signed-in `/api/team` 200 proof confirmed). **5B-1 (clients read cutover): DONE** — commit `922968c`; Netlify deploy `6a12f6e2fd384c000811285c` `ready`/published; the UI clients list now reads from `GET /api/clients` (read-only; client writes deferred to 5B-2); `clientsApi.list()` corrected to the `{ items, pagination }` shape; controlled 401/403/503/500 states with no localStorage fallback; clients removed from localStorage hydration + persist (pre-cutover cache preserved as backup); signed-out `/api/clients` 401 verified. Closed per C-2026-05-24-03. **5B-2 (clients write/create cutover): DONE** — commit `53df712` (message `Cut over client create path`); Netlify production deploy `6a132d34051d560008dc3bc2` `ready`/published; client CREATE now writes via `POST /api/clients` then refetch (no optimistic UI); `ClientModal` carries a client-side invalid-email guard (`"Invalid email address."`) mirroring the server `CreateClientSchema`; `CLIENT_WRITES_ENABLED` flipped true; CREATE only — client edit/soft-delete deferred (no edit/delete UI; `PATCH /api/clients/[id]` unused; no DELETE route by design); 1 file (`src/app/page.tsx`), 98 insertions / 26 deletions; `uat:check` + browser UAT + production smoke (signed-out `/api/clients` 401) all green; labelled UAT test client `ZZ_TEST_5B2_CLIENT_DELETE_AFTER_UAT` cleaned via phased targeted SQL (baseline `firm_primary` untouched). Closed per C-2026-05-24-04. **5B-3a-pre (/api/me current-user identity route): DONE** — commit `04b5610`; NEW `src/app/api/me/route.ts` (GET, `requireSession()`-based, read-only, returns `{ userId, firmMemberId, name, firmRole, platformRole, firmId }`); additive api-client `meApi`. Server-authoritative current-user role source because `GET /api/team` excludes platformRole. Deployed `6a1345b98c9b870008f5daa6` and verified (signed-out 401, signed-in 200 minimal shape; production cookieless signed-out 401). Closed per C-2026-05-24-05. **5B-3a (team read cutover + /api/me identity rebind): DONE** — commit `fa76718` (subject `Section 14 Step 5B-3a: team READ cutover + /api/me identity (C-2026-05-28-01)`; pushed `0c2f31e..fa76718 main -> main`); 2 files (`src/app/page.tsx`, `src/lib/api-client.ts`), +211 / -43 CRLF-normalised. The UI team list now reads from `GET /api/team?status=all&page=1&pageSize=200` (consuming the `{ items, pagination }` shape); the current user is resolved from `GET /api/me` (server-authoritative `platformRole` + `firmRole`); seed-team and email-match identity inference are removed; no localStorage fallback for team. `TEAM_WRITES_ENABLED = false` keeps team writes UI-disabled — the write cutover is 5B-3b. Validation: Windows `npm run uat:check` passed; targeted local UAT 10/10 green against an isolated CDP-9224 Chrome via DevTools console blocks — `GET /api/me` 200 with wrapped `{ ok, data }` and exactly the six approved identity fields (`userId, firmMemberId, name, firmRole, platformRole, firmId`), no forbidden private / auth fields; `GET /api/team` 200 with wrapped `{ ok, data }` and `{ items, pagination }` shape; all team write controls disabled (Header Add User disabled visually with click no-op, row-level role `<select>` / Reset password / Deactivate-Reactivate disabled, no team write modal opens); role-gated nav correct (FIRM_ADMIN sees Admin; PLATFORM_OWNER sees Firm Setup); no blocking console errors. **Production smoke at `fa76718`**: root 200; signed-out `/api/me` 401 `Authentication required`; signed-out `/api/team` 401 `Authentication required`. UAT test-rule clarification recorded as D-2026-05-29-01 (no-email rule scoped to `/api/me`; `/api/team` may include team member email as an approved Team / Admin display field). Closed per C-2026-05-29-01. **5B-3b (team write cutover: add user / role change / deactivate / reactivate): DONE** — commit `f1f8fcf` (subject `Section 14 Step 5B-3b: team write cutover`; pushed `3ed646a..f1f8fcf main -> main`); 2 files (`src/app/page.tsx`, `src/lib/api-client.ts`). `TEAM_WRITES_ENABLED` flipped to `true`; Add User writes through `POST /api/team` then refetch; role change through `PATCH /api/team/[id]` with `firmRole` code; Deactivate / Reactivate through `POST /api/team/[id]/deactivate` and `/reactivate` with the server-required `{ reason: string }` body (defaults `"Deactivated via Team UI"` and `"Reactivated via Team UI"` at the call sites). Reset password remains UI-disabled behind a separate `TEAM_PASSWORD_RESET_ENABLED = false` flag — explicitly deferred to 5B-3c (no backend route exists yet). Server writes all team `ActivityLog` rows automatically (`TEAM_MEMBER_ADD` / `TEAM_MEMBER_UPDATE` / `TEAM_MEMBER_ROLE_CHANGE` / `TEAM_MEMBER_DEACTIVATE` / `TEAM_MEMBER_REACTIVATE`); client-side `log()` entries for team writes were removed to prevent duplicates. **Mid-wave defect** (committed together with the fix in `f1f8fcf`): the initial cutover sent no JSON body on deactivate / reactivate, returning `400 "Invalid JSON payload."`; the server schemas Zod-require `{ reason: string }` per Decision H1, Section 23.4. Fix: required-arg `reason: string` on both `teamApi` wrappers and default reason strings at the call sites. Validation: Windows `npm run uat:check` green; CDP-9223 post-fix UAT 10/10 green (Deactivate POST 200 with `{"reason":"Deactivated via Team UI"}` + refetch 200; Reactivate POST 200 with `{"reason":"Reactivated via Team UI"}` + refetch 200; reset password disabled with zero-fetch click test; self-controls disabled; `/api/me` six-field contract verified; `/api/team` `{ items, pagination }` verified). **Production smoke at `f1f8fcf`**: root 200; signed-out `/api/me` 401 `Authentication required`; signed-out `/api/team` 401 `Authentication required`. UAT data cleanup completed (`ZZ_TEST_5B3B_MANAGER_A` removed via phased targeted SQL; ActivityLog deleted = 6, FirmMember = 1, PlatformUser = 1; baseline preserved unchanged: `fm_owner` = 1, `pu_owner` = 1, `firm_primary` = 1). No schema / route / Auth / DB change. Closed per C-2026-05-29-02. **5B-3c-1 (team password-reset BACKEND): DONE** — commit `c4713cf` (`Section 14 Step 5B-3c-1: Add team password reset flow`; pushed `42ad1cf..c4713cf main`); NEW `src/app/api/team/[id]/password-reset/route.ts` (Option A `supabase.auth.resetPasswordForEmail`, no service-role, no `auth.admin.*`; guards: self-reset 403 / PLATFORM_OWNER target 403 / inactive 422 / cross-firm 404; PII-safe audit metadata with `targetEmailDomain` only) + NEW `src/app/auth/reset-password/page.tsx` (recovery page via `supabase.auth.updateUser`) + `.env.example` `NEXT_PUBLIC_APP_URL` block; `TEAM_PASSWORD_RESET_ENABLED` stays false (UI gated). Pre-push config: Supabase Auth redirect URLs + Netlify/local `NEXT_PUBLIC_APP_URL`. Production safe smoke green (signed-out `GET /api/team` 401; `GET /api/team/smoke-nonexistent-id/password-reset` 405). Controlled localhost UAT with documented caveat: backend route, authenticated trigger, Supabase reset-email call, ActivityLog audit (retained by default), delayed email delivery after cooldown via a controlled disposable Gmail test account, reset-page access, and PracticeIQ login mapping after a localStorage `emailDomain` workaround were validated; a pure reset-link password-rotation proof was not clean because the Supabase Auth test user was recreated during troubleshooting; test FirmMember / PlatformUser / Auth user cleaned (post-check zero), ActivityLog retained. Closed per C-2026-06-05-01. **5B-3c-2 (Team UI reset-button cutover): code completed, deployed, and verified at `51ad699`** — commit `51ad699` (`Section 14 Step 5B-3c-2: Cut over team password reset UI`); `TEAM_PASSWORD_RESET_ENABLED` enabled; two files (`src/app/page.tsx`, `src/lib/api-client.ts`); Windows `uat:check` passed; supervised localhost UI UAT (DB-only `@example.com` target) — one real click, exactly one POST `{reason:"Password reset via Team UI"}`, 200 `sent:true`, success notice no-echo, no team refetch, one clean retained `TEAM_MEMBER_PASSWORD_RESET` ActivityLog row (PII OK, `targetEmailDomain:"@example.com"`), test member cleaned (baseline intact); production safe smoke 401/405, no production POST run and no production reset email triggered. After this documentation sync, Section 14 Step 5B-3c is fully closed. Closed per C-2026-06-06-01. **5B-STAB (stabilization): read-only verification PASS, zero must-fix; cleared per C-2026-06-06-02** (no runtime change; SHA stays `51ad699`; verified service-role/admin grep comments-only, auth/RBAC/cross-firm/audit wired across all routes, fail-closed session, localStorage boundary clients+team on API, Windows `uat:check` green, SQL baseline 1/1/1 + residue 0, production GET-only smoke 200/200/401/401/401/405; no mutations/test-data/prod-email). Document/defer debt: ActivityLog fail-open, Supabase built-in email, 5B-3c-1 reset-link rotation caveat, localStorage emailDomain login gate, UI platformRole placeholder, non-cutover localStorage domains, RLS/automated-tests/custom-SMTP pre-pilot, sandbox/OneDrive git unreliability. **5B-4a (tasks READ cutover): DONE** — commit `afef3e5` (`Section 14 Step 5B-4a: Cut over task reads`); three files (`src/app/page.tsx`, `src/lib/api-client.ts`, `src/lib/workspace-data.ts`); 137 insertions / 19 deletions; `tasksApi.list()` shape fixed to `{items,pagination}`; faithful DTO→UI mapping (UI `TaskStatus`/priority unions extended with `Cancelled`/`Critical`); tasks read from API, removed from localStorage hydrate/persist, no fallback; `TASK_WRITES_ENABLED=false` (task writes parked for 5B-4b–e); Windows `uat:check` passed; localhost read-only UAT (empty-state, DB `firm_primary` tasks=0: signed-out 401 / signed-in 200 `{items,pagination}` / clean empty UI / Create Task disabled / no localStorage fallback) + production safe smoke (signed-out `/api/tasks` 401, no production mutation) passed. Caveats: per-task controls unverifiable at 0 rows (code-gated, uat:check green); disabled Create Task tooltip cosmetic/deferred. Closed per C-2026-06-06-03. **5B-4b (task CREATE cutover): DONE** — commit `a7c0e94` (`Section 14 Step 5B-4b: Cut over task create`); two files (`src/app/page.tsx`, `src/lib/workspace-data.ts`), 128/44 (`api-client.ts` not modified in this WIP); task create writes via `POST /api/tasks` then refetch `GET /api/tasks` (render from API; no local insert/log/localStorage); task↔user identity reconciliation (UI `TeamMember.userId` added, id stays firmMemberId; task reviewer/assignee payload + comparisons + name resolution use PlatformUser userId; team-management actions stay firmMemberId); `TASK_CREATE_ENABLED=true`, `TASK_WRITES_ENABLED=false` (move/notes/assignees/reviewer/resequence parked); priority Low/Normal/High/Critical→LOW/NORMAL/HIGH/CRITICAL; Windows `uat:check` passed; supervised localhost UAT (one create → one POST 201 with userIds → one refetch → UI render → no localStorage → one clean retained `TASK_CREATE` null-metadata → cleanup by exact id → empty GET restored) + production safe smoke (signed-out `/api/tasks` 401, no production mutation) passed. Closed per C-2026-06-06-04. **5B-4c-1 (task status-move + close cutover): DONE** — commit `3cf5d91` (`Section 14 Step 5B-4c-1: Cut over task lifecycle actions`; pushed `18b547f..3cf5d91 main`); two files (`src/app/page.tsx`, `src/lib/api-client.ts`), 113/27; status transitions via `PATCH /api/tasks/[id]` (with `note`), closure via `POST /api/tasks/[id]/close` (user-entered `closureRemarks`), then refetch `GET /api/tasks` (render from API; no local task mutation/log/localStorage); `TASK_LIFECYCLE_ENABLED=true` (move+close), `TASK_WRITES_ENABLED=false` (notes/assignees/reviewer/resequence parked), reopen/cancel parked for 5B-4c-2; transition-aware workflow-button gating reuses the server matrix (`isAllowedTransition` via `lifecycleCanMoveTo`; Closed/Cancelled terminal), and the task-table reviewer name now uses the userId-based lookup; Windows `uat:check` passed; supervised localhost UAT (D1 OPEN→In Progress PATCH `TASK_STATUS_CHANGE`, D2 In Progress→Under Review PATCH `TASK_STATUS_CHANGE`, D3 Under Review→Closed POST `/close` `TASK_CLOSE`; each one mutation + one refetch; no localStorage task write; cleanup by exact id 0/0/0/0, ActivityLog retained 3, empty GET restored) + production safe smoke (signed-out `/api/tasks` 401, no production mutation) passed. Closed per C-2026-06-07-01. **5B-4c-2 (task reopen + cancel cutover): DONE** — commit `3206dfd` (`Section 14 Step 5B-4c-2: Cut over task reopen and cancel`; pushed `7dd568e..3206dfd main`); two files (`src/app/page.tsx`, `src/lib/api-client.ts`), 76/17; reopen (CLOSED→IN_PROGRESS, clears closedAt/closedById/closureRemarks) via `POST /api/tasks/[id]/reopen` and cancel (non-terminal→CANCELLED terminal) via `POST /api/tasks/[id]/cancel`, both Zod-requiring a non-empty user-entered `{reason}` (api-client wrappers fixed from optional `{note}` to required `{reason}`); dedicated drawer controls with fail-closed server-matrix gating (TASK_REOPEN: PO/FIRM_ADMIN always, PARTNER/MANAGER if reviewer; TASK_CANCEL: PO/FIRM_ADMIN/PARTNER always, MANAGER if creator; ARTICLE_STAFF never; backend final authority) and a contextual reason block (Closed→Reopen, non-terminal→Cancel, Cancelled→hidden); refetch `GET /api/tasks` after success; no local task mutation/log/localStorage; Windows `uat:check` passed; supervised localhost UAT (E1 reopen `TASK_REOPEN`, E2 cancel `TASK_CANCEL`; each one mutation + one refetch; closure fields cleared on reopen; pre-clean TaskNote gate = 2; cleanup 0/0/0/0, ActivityLog retained 2, empty GET restored) + production safe smoke (signed-out `/api/tasks` 401, no production mutation) passed. Task lifecycle-actions cutover (5B-4c) complete; notes/assignees/reviewer/resequence remain parked. Closed per C-2026-06-07-02. **5B-4d-1 (task people updates: assignee + reviewer): DONE** — commit `7314057` (`Section 14 Step 5B-4d-1: Cut over task people updates`; pushed `637b2b4..7314057 main`); two files (`src/app/page.tsx`, `src/lib/api-client.ts`), 74/20; assignee swap via `PATCH /api/tasks/[id]/assignees` set-semantics `{add,remove}` (api-client `setAssignees` fixed from `{assigneeIds}`), reviewer change via `PATCH /api/tasks/[id]` `{reviewerId}`, both refetch `GET /api/tasks` (render from API; no local task mutation/log/localStorage); `TASK_PEOPLE_ENABLED=true`, `TASK_WRITES_ENABLED=false` (notes/resequence parked); single-assignee swap-only UI; fail-closed `canCoordinateTasks` gating (creator roles or Platform Owner, non-terminal status) aligned to the row-select `canCoordinate`; backend TASK_EDIT / ARTICLE_STAFF-403 final authority; Windows `uat:check` passed; supervised localhost UAT (U1 swap A→B `TASK_ASSIGNEE_ADD`+`TASK_ASSIGNEE_REMOVE`, U2 reviewer `TASK_REVIEWER_CHANGE`; each one mutation + one refetch; no localStorage task write; setup/scenario fix used two disposable Managers since the owner-as-assignee is Firm-Admin-filtered; cleanup 0 across the board, ActivityLog retained 3, empty GET restored) + production safe smoke (signed-out `/api/tasks` 401, no production mutation) passed. Closed per C-2026-06-08-01. **5B-4d-2a (task notes-read API): DONE** — commit `1205bd5` (`Section 14 Step 5B-4d-2a: Add task notes read API`; pushed `14dca34..1205bd5 main`); two files (`src/app/api/tasks/[id]/notes/route.ts`, `src/lib/api-client.ts`), 107 insertions; new `GET /api/tasks/[id]/notes` returns `ok({ items })` newest-first (`createdAt desc`, select `{id,taskId,authorId,note,oldStatus,newStatus,createdAt}`), `requireAuth(TASK_VIEW)` + cross-firm 404 + ARTICLE_STAFF creator-or-assignee self-scope mirroring `GET /api/tasks/[id]` (PLATFORM_OWNER impersonation bypass), reads not audited; POST unchanged; list GET unchanged; no schema/migration; added `TaskNoteDTO` + `tasksApi.listNotes(id)`; Windows `uat:check` passed; supervised localhost route UAT (one SQL-inserted note, no POST: signed-out 401, signed-in 200 `{items:[1]}` exact 7 fields oldStatus/newStatus null, GET created no ActivityLog; cleanup 0 across the board, ActivityLog retained 0, empty GET restored) + production safe smoke (signed-out `/api/tasks/<id>/notes` 401, no production mutation) passed. Closed per C-2026-06-08-02. **5B-4d-2b (task notes UI cutover): DONE** — commit `b16f883` (`Section 14 Step 5B-4d-2b: Cut over task notes UI`); one file (`src/app/page.tsx`); the drawer Progress notes section renders notes from `GET /api/tasks/[id]/notes` and adds via `POST /api/tasks/[id]/notes` then refetches (render from API; no local echo / no localStorage); `TASK_NOTES_ENABLED=true` (`TASK_WRITES_ENABLED` stays false - resequence parked); Strict-Mode-safe initial-load effect (cancellation guard) + `refetchNotes` for add-note and lifecycle refresh; note form gated by the flag (matches server `TASK_ADD_NOTE`; terminal notes allowed); newest-first with author/timestamp + optional status-transition line; Windows `uat:check` passed; supervised localhost UAT (D1 empty / D2 SQL note renders from API / D3 one `POST /notes` 201 + one refetch `GET /notes`, rendered from refetch not local echo, one `TASK_NOTE_ADD` / D4 signed-out 401; cleanup 0/0/0/0, ActivityLog retained 1, empty GET restored) + production safe smoke (signed-out `/api/tasks/<id>/notes` 401, no production mutation) passed. **Step 5B-4d (assignees + reviewer + notes) is now fully closed.** Closed per C-2026-06-10-01. **5B-4e (resequence disposition + stabilization): DONE** — commit `22a7bd1` (`Section 14 Step 5B-4e: Remove parked task resequence controls`); one file (`src/app/page.tsx`); Option A disposition (D-2026-06-10-01) removed the dead manual resequence Up/Down controls + the local-only `resequenceTask` handler + the now-unused `TASK_WRITES_ENABLED` flag (its last consumer); `taskSequence()` retained for default ordering (behaviour unchanged - `task.sequence` was never API-set); persisted resequence/order API deferred (no schema/migration/route); `git diff --check` clean; Windows `uat:check` passed; read-only visual smoke (Assignments + Project Review render clean, zero Up/Down controls, no console errors, no mutation; row-level controls not visually checkable at a zero-task firm, accepted on structural scope + green uat:check) + production safe smoke (signed-out `/api/tasks/<id>/notes` 401, no production mutation) passed. **Step 5B-4 fully closed; the task domain UI is fully cut over to the API.** Closed per C-2026-06-10-02. **5B-5a (activity feed READ cutover to server audit log): DONE** — commit `eaa15ac` (`Section 14 Step 5B-5a: Cut over activity feed to server audit log`); Netlify production deploy `6a29961e86e40b000845714f` reached state `ready`/published (1 serverless + 1 edge function; secret scan 0 matches; deploy_time 53s); two files (`src/app/page.tsx`, `src/lib/api-client.ts`); the Activity Monitor now reads `GET /api/activity` (the API is the sole source of truth for activity); `activityApi.list` corrected to the `{ items, pagination }` route envelope; the client-side `log()` helper and all its call sites removed; the local activity feed array removed as source of truth; `activity` removed from the localStorage `practiceiq-live-v1` hydrate path AND the persist payload; Activity Monitor renders server `ActivityLog` rows (action code, entity type, actor name, ISO timestamp; metadata/detail intentionally NOT surfaced in this wave; top 8 rendered for the dashboard panel). No backend route / schema / migration / Auth / env / package change. `git diff --check` clean; Windows `npm run uat:check` passed (after a set-state-in-effect lint fix landed in the wave); signed-in localhost UAT (one `GET /api/activity` 200 with `items` + `pagination`, 15 server `ActivityLog` rows returned, top 8 rendered, action / entityType / actor / timestamp only, no local echo rows, `practiceiq-live-v1` no longer includes `activity`, cookie-omit localhost `GET /api/activity` 401); production signed-out smoke `GET https://practice-iq.netlify.app/api/activity` returned 401 Unauthorized, content-type `application/json`, exact body `{"ok":false,"message":"Authentication required."}` (clean Playwright session, `credentials: 'omit'`; no cookies carried). **Source-of-truth decision (D-2026-06-10-02)**: Activity feed is now the auditable server trail only; local-only actions (anything not yet emitting `writeActivityLog()` from the server route) may stop appearing in the Activity Monitor until those domains cut over (next: 5B-5b modules; then 5B-final localStorage removal). Intentional and accepted at Stage 0 — the transitional gap is bounded by the remaining 5B waves. Closed per C-2026-06-10-03. **5B-5b (modules READ + WRITE cutover to server source of truth): DONE** — commit `ad1d592` (`Section 14 Step 5B-5b: Cut over modules to server source of truth`; full SHA `ad1d5921dea8ee6c8a39f57db90ae1f89d9be04e`); Netlify production deploy `6a2a8cf1d218510008506afb` reached state `ready`/published on `main` (published 2026-06-11T10:25:43Z; deploy_time 51s; 1 serverless + 1 edge function; secret scan 72 files, 0 matches); two files (`src/app/page.tsx` and `src/lib/api-client.ts`; +102 / -25). Module Governance now reads `GET /api/modules` (the API is the sole source of truth for modules): the `initialModuleFlags` seed import was removed, `modules` state initialises empty (no seed, no localStorage fallback) with new `modulesLoading`/`modulesError`/`moduleTogglePending` state, and a `sessionUserId`-gated, Strict-Mode-safe read effect maps each `ModuleDTO` to the existing `ModuleFlag` UI shape (`id: dto.key`, `enabled: dto.isEnabled`). `modules` was removed from the `practiceiq-live-v1` hydrate path AND the persist payload (and persist deps). `toggleModule` was rewritten async — PLATFORM_OWNER only, gated by `MODULE_TOGGLE_ENABLED`, in-flight `moduleTogglePending` guard, writing via `modulesApi.setEnabled` (`PATCH /api/modules/[key]`) then refetching the list and remapping (server source of truth; no optimistic mutation; the server emits the `MODULE_ACCESS_CHANGE` audit row). `AdminView`/`ModuleControlCard` gained loading/error/pending props (loading + error placeholders; toggle disabled while pending), and the Release-Readiness "Reports visibility" tile now keys off `REPORTS_ADVANCED` (was the stale `m_reports` id). `api-client.ts` `modulesApi.list` was corrected to unwrap the `{ items: ModuleDTO[] }` envelope and `ModuleDTO` gained optional `description`/`defaultEnabled` (list-route fields, absent on PATCH). `MODULES_READ_ENABLED = true`, `MODULE_TOGGLE_ENABLED = true`. Validation: `git diff --check` clean; Windows `npm run uat:check` passed. Controlled localhost Gate 3 toggle/revert UAT for `WORKFLOW_TEMPLATES` only (signed-in Platform Owner): baseline zero `FirmModuleAccess` overrides; ON one `PATCH {isEnabled:true}` 200 + one `GET /api/modules` refetch (UI Enabled), OFF one `PATCH {isEnabled:false}` 200 + one refetch (UI Hidden), two `MODULE_ACCESS_CHANGE` rows (true then false, actor `pu_owner`); cleanup deleted the single created `FirmModuleAccess` row (RETURNING one), `firm_primary`+`WORKFLOW_TEMPLATES` overrides back to zero and total `firm_primary` overrides zero, ActivityLog retained the two rows; no `modules` key re-acquired in localStorage; no console errors; no unexpected mutations. Production deploy verified at `ad1d592`; production signed-out smoke `GET https://practice-iq.netlify.app/api/modules` returned 401 with exact body `{"ok":false,"message":"Authentication required."}`. No new decision (no `DECISION_LOG.md` entry). Closed per C-2026-06-11-01. **5B-final-F1 (active firm cutover to server source of truth): DONE** — commit `7db0c84` (`Section 14 Step 5B-final-F1: Cut active firm to server source of truth`; full SHA `7db0c845a228b0d8bb5ce4f39ee1e2a0aa10fa05`); Netlify production deploy `6a2aa18af494c7000853e2be` reached state `ready`/published on `main` (published 2026-06-11T11:53:41Z; deploy_time 54s; 1 serverless + 1 edge function; secret scan 72 files, 0 matches); three files (`src/app/api/me/route.ts`, `src/lib/api-client.ts`, `src/app/page.tsx`). `GET /api/me` was additively extended to return the session's own active-firm display fields `firmName`/`firmStatus`/`firmPlan`/`firmEmailDomain`/`firmCity` (firm read via the existing `Firm -> Plan` relation; same-firm only; no cross-firm lookup; read-only; signed-out 401 and the identity fields unchanged); `MeDTO` extended with the five optional/nullable fields. In `page.tsx` the pre-login client-side email-domain gate `isAllowedLoginEmail(...)` was removed from `login()`, and the orphaned helpers `isAllowedLoginEmail`/`isWorkspaceEmail`/`isPlatformOwnerEmail` plus the `platformOwnerEmail` const were deleted (lint cascade; authority is Supabase Auth + the `/api/me` fail-closed workspace mapping); `firmProfile` initialises to a neutral placeholder (not the demo seed) and is set from `/api/me` in the session-boot effect and `login()`; a neutral `firmLoading` sidebar fallback prevents demo-firm flash; `firm` was removed from the `practiceiq-live-v1` hydrate AND persist (and persist deps). `assignments` and `firms` were not touched (reserved for F2/F3). No schema/migration/env/package/config change (one additive field set on an existing route). Validation: `git diff --check` clean; Windows `npm run uat:check` passed. Localhost F1 UAT: sign-out + clear `practiceiq-live-v1` + sign-in worked; pre-login neutral (no demo firm name/domain); `GET /api/me` 200 with the five firm fields (firmName "PracticeIQ Workspace", firmStatus "ACTIVE", firmPlan null, firmEmailDomain "gmail.com", firmCity "Mumbai"); sidebar Active Firm rendered "PracticeIQ Workspace" / "Active" from `/api/me`; `practiceiq-live-v1` keys `["assignments","firms"]` (firm absent; assignments + firms present); signed-out cookie-omit `GET /api/me` 401; app `/api/` GET-only; no console errors. Production signed-out smoke `GET https://practice-iq.netlify.app/api/me` returned 401 with exact body `{"ok":false,"message":"Authentication required."}`. No new decision (no `DECISION_LOG.md` entry). Closed per C-2026-06-11-02. **5B-final-F2 (firm registry parked + `firms` localStorage cutover): DONE** — commit `2339aaa` (`Section 14 Step 5B-final-F2: Park firm registry local state`); Netlify production published on `main@2339aaa` (push `9f07713..2339aaa`); one file (`src/app/page.tsx`, +29 / -86). The Firm Setup registry is derived from the server-backed active firm (`firmProfile` via `/api/me`): `firmDirectory` replaced with `useMemo(() => [firmProfile], [firmProfile])`; the demo `firm` seed import removed; `firms` removed from the `practiceiq-live-v1` hydrate AND persist (persist payload now just `{ assignments }`, deps `[assignmentList, isHydrated]`); `setFirmDirectory` removed. `FirmSetupView` is read-only single-firm: the editable Active-firm form + "Save Active Firm" replaced with a read-only `<dl>` (new `FirmDetail` helper); the "Add Firm" form + `submitNewFirm`/`submitCurrentFirm` handlers + `canCreateFirm`/`saveCurrentFirm`/`saveFirms` props removed; the registry shows the single derived row with a "Single-firm workspace" label and a parked note. F2 addendum (same commit): intro copy changed to "Review the active firm identity used for this workspace. Multi-firm onboarding is parked for this release."; the Header primary-action button renders null on Firm Setup (removing the inert disabled "Add Firm" affordance). No schema/API route/env/package/config change; no POST/PATCH/DELETE introduced; multi-firm registry parked. Validation: `git diff --check` clean; Windows `npm run uat:check` passed. Localhost F2 UAT: Firm Setup one server-backed row (FIRM NAME "PracticeIQ Workspace", CITY "Mumbai", PLAN "Not set", EMAIL DOMAIN "gmail.com", STATUS "Active"), no Save Active Firm, no in-page or Header Add Firm, parked intro copy; `practiceiq-live-v1` keys `["assignments"]` (no `firm`, no `firms`, no standalone keys; `assignments` retained for F3); app `/api/` GET-only; signed-out cookie-omit `GET /api/me` 401; console clean; the earlier "0/0 modules" was transient and cleared on reload. Production signed-out `GET https://practice-iq.netlify.app/api/me` 401. `assignments` was NOT touched (reserved for F3). No new decision (no `DECISION_LOG.md` entry). Closed per C-2026-06-11-03. **5B-final-F3 (assignments localStorage removal + Assignments/Project Review parked): DONE** — commit `39acf9c` (`Section 14 Step 5B-final-F3: Remove assignments local source of truth`); Netlify production published on `main@39acf9c`; one file (`src/app/page.tsx`, +36 / -54). The final `practiceiq-live-v1` source-of-truth key `assignments` was removed (hydrate + persist); the persist effect was deleted entirely; `isHydrated`/`setIsHydrated` removed; the boot effect now actively `removeItem(workspaceStorageKey)` so existing browsers drop any stale payload (plus the existing legacy-key cleanup). `assignmentList` initialises empty; `seedAssignments` import removed. `ASSIGNMENTS_ENABLED = false`: `canAccessSection` gates `assignments`/`projectReview` off the nav (redirect to Dashboard, blocks render); `AssignmentModal` gated; the vestigial TaskModal "Assignment" select + `assignments` prop removed (task create unaffected - `createTask` has no `assignmentId`); Header "Add Assignment" suppressed; Dashboard "Open Master Review"/"Add Assignment"/Client-Master "Open"/"Assignment Control Board" gated (neutral "Active assignments: 0" KPI + per-client count kept per Decision F3-A); assignment display surfaces hidden in TaskDrawer (subtitle + Info) / Task Queue column / Kanban card; two parked-concept copy strings tidied. No Assignment backend / `/api/assignments` / `Task.assignmentId` added. No schema/API/env/package/config change; no POST/PATCH/DELETE. Validation: `git diff --check` clean; Windows `npm run uat:check` passed. Localhost F3 read-only UAT: `practiceiq-live-v1` ABSENT after reload (no assignments/firm/firms payload or standalone keys); Assignments + Project Review nav absent; no Add Assignment / Open Master Review / Assignment Control Board; Dashboard renders (KPI 0); Task Queue no Assignment column + corrected empty-state; Create Task modal no Assignment field (not submitted); Clients/Team/Reports/Admin/Firm Setup load; app `/api/` GET-only; signed-out cookie-omit `GET /api/me` 401; console clean. Production signed-out `GET https://practice-iq.netlify.app/api/me` 401. No new decision (no `DECISION_LOG.md` entry). Closed per C-2026-06-11-04. **Section 14 Step 5B-final is COMPLETE (F1 + F2 + F3): PracticeIQ holds no localStorage source-of-truth - clients, tasks, team, modules, and activity read from their APIs; the active firm reads from `/api/me`; `practiceiq-live-v1` is actively removed on boot.** **Post-5B-final stabilization (STAB) - first fix DONE**: the read-only stabilization baseline completed; the one credibility must-fix it found (demo-seed first-paint flash) was fixed at commit `5a9194a` (`Section 14 post-5B-final-STAB: Remove demo seed first-paint state`) - `clientList`/`taskList`/`teamList` now initialise empty (no demo seeds; the unused `seedClients`/`seedTasks`/`seedTeam` imports removed), and the Dashboard render is gated behind `clientsLoading || tasksLoading || teamLoading || modulesLoading` (shows "Loading workspace…" until the reads settle, then the real KPIs; hang-safe since all four loading flags clear on both success and `.catch`). One file (`src/app/page.tsx`); no localStorage source-of-truth reintroduced; no schema/API/env/package/config change. Windows `npm run uat:check` passed; read-only localhost confirmed no demo flash + real settled KPIs (1 user / 4/8 modules) + `practiceiq-live-v1` absent + GET-only + clean console; Netlify production published on `main@5a9194a`; production signed-out smoke `/api/{me,clients,team,tasks,activity,modules}` all 401. Runtime/code SHA advances `39acf9c` -> `5a9194a`. Recorded per C-2026-06-11-05. **Controlled-write core-live regression UAT (W1-W5): COMPLETE / documented per C-2026-06-11-06** (runtime/code SHA unchanged at `5a9194a`; prior repo/doc HEAD `afaf2c9`; this is a documentation-only sync). Executed on localhost against `5a9194a` with no source/runtime change; each wave used labelled `ZZ_TEST_STAB_W*` data, verified network (one mutation + the expected refetch per action) + DB + ActivityLog + localStorage + console, then phased FK-safe scoped SQL cleanup restoring the permanent baseline (`firm_primary` Client 0 / Task 0 / FirmMember 1 / PlatformUser 1); `practiceiq-live-v1` source-of-truth absent throughout; no production mutation; no files/git/deploy during the UAT. Results: **W1 client-create PASS**; **W2 task-create PASS** (assignee picker excludes Firm Admin, so a setup Manager is the assignee); **W3A status-moves + cancel PASS** (`TASK_STATUS_CHANGE` x2 + `TASK_CANCEL`, 3 auto notes); **W3B close/reopen PASS** using one APPROVED scoped DB status-seed (single guarded `UPDATE` OPEN->UNDER_REVIEW on the captured test task only, used purely as a test precondition; no fake audit row) then UI Close (`TASK_CLOSE`, closure fields set) + Reopen (`TASK_REOPEN`, closure fields cleared), no `TASK_STATUS_CHANGE` from the seed - assignee-only Move-to-Under-Review NOT covered; **W4A notes-only PASS** (`TASK_NOTE_ADD`) - assignee-swap + reviewer-change BLOCKED/DEFERRED because the active navigable UI does not expose those controls after F3 parked Assignments/Project Review (`ASSIGNMENTS_ENABLED=false`; the `reassignTask`/`updateReviewer` controls render only inside `AssignmentsView`/`ProjectReviewView`); recorded as notes-only PASS, not a full W4 people/notes pass; **W5 team-writes PASS** (role change Manager->Partner `TEAM_MEMBER_ROLE_CHANGE`, password reset `TEAM_MEMBER_PASSWORD_RESET` audit-only/PII-safe, deactivate `TEAM_MEMBER_DEACTIVATE`, reactivate `TEAM_MEMBER_REACTIVATE`; Pankaj/self untouched; first run aborted on an operator-input native-`<select>` overshoot and cleaned to baseline - operator error, not a product defect - rerun passed via deterministic `form_input`). No new decision (the W3B scoped status-seed was an approved test precondition, not a product decision). **Deferred gaps (non-blocking)**: assignee-only Move to Under Review; the assignee-swap + reviewer-change reachable-UI exposure decision (controls only in the parked Assignments/Project Review views - separate plan-first); the temp Gmail firm `emailDomain` must-fix; RLS / security hardening (separate pre-pilot wave). **TAMS firm-identity setup-data correction: DONE / documented per C-2026-06-12-01 - the temp Gmail firm `emailDomain` must-fix is CLOSED** (runtime/code SHA unchanged at `5a9194a`; prior repo/doc HEAD `51bc1e5`; documentation-only sync). The existing single `Firm` row `firm_primary` was converted from the temporary internal Gmail identity to the TAMS pilot identity via one authenticated localhost `PATCH /api/firms/firm_primary` (signed in as Pankaj / `pu_owner`, same-firm, the app's own audited `Action.FIRM_UPDATE` route - NOT a raw DB UPDATE): `name` `PracticeIQ Workspace` -> `TAMS & CO LLP`; `emailDomain` `gmail.com` -> `tams.co.in`; `city` (`Mumbai`), `status` (`ACTIVE`), `planId` (`null`) preserved (the route requires a non-empty `plan` body for validation but does not persist it; `status:"Active"` sent to preserve `ACTIVE`). One real `FIRM_UPDATE` ActivityLog row was emitted by the route (`entityType=FIRM`, `entityId/firmId=firm_primary`, `actorId=pu_owner`, metadata = field names only). No source/runtime/schema/API/env/config change; no second firm (count still 1); no `AllowedFirmDomain`; no auth-architecture change; the existing Gmail Platform Owner / Pankaj control login remains intact (the firm `emailDomain` is a display/identity field, not in the login/session/RBAC/team-create path). `pankaj.singhal@tams.co.in` is NOT created/mapped in this wave (pending follow-up once the mailbox exists; Gmail control user retained as admin). Verified: DB row; `/api/me` + Firm Setup + header/sidebar show `TAMS & CO LLP` / `tams.co.in`; login intact; `practiceiq-live-v1` absent; console clean; signed-out `/api/me` 401. **Final controlled smoke for TAMS pilot-readiness viewing: PASS / documented per C-2026-06-12-02** (runtime/code SHA unchanged at `5a9194a`; prior repo/doc HEAD `bc5d91a`; documentation-only sync). Read-only smoke (read-only SQL SELECTs + signed-in/signed-out `GET` + UI navigation; no POST/PATCH/DELETE; no Supabase mutation; no production calls; no source/runtime change): DB baseline Firm 1 / `firm_primary` `TAMS & CO LLP`/`tams.co.in`/Mumbai/ACTIVE/null / Client 0 / Task 0 / FirmMember 1 / PlatformUser 1 / no live `ZZ_TEST_STAB_*` residue; signed-in `/api/me` + header/sidebar + Firm Setup show the TAMS identity; Dashboard no demo flash; Clients/Tasks/Team/Reports/Modules(8 catalog, 4/8)/Activity read cleanly; signed-out `/api/{me,clients,tasks,team,modules,activity}` all 401; `practiceiq-live-v1` absent; console clean; Activity Monitor shows the intended `FIRM_UPDATE` plus documented historical 5B-UAT audit evidence (log-only, no live data). Minor non-blocking cosmetic polish noted: Admin "Subscription and Controls" highlights Professional "Active" while Firm Setup shows Plan "Not set" / DB `planId` null (display inconsistency; future polish, not a pilot blocker). **Verdict: TAMS pilot-readiness viewing PASS.** **Remaining next gate**: TAMS-domain user mapping once `pankaj.singhal@tams.co.in` exists (Gmail Platform Owner control login retained meanwhile); then the RLS pre-pilot security wave. No new feature work (AI, billing, UI redesign, multi-firm switcher, real Assignment backend) until pilot readiness is declared. RLS remains a separate pre-pilot security wave, not part of Step 5.

## 15. Deployment Setup

**Current** (post Section 14 Step 1 close, 2026-04-30): Netlify Next.js Runtime, build command `npm run build`, publish `.next/`, Node 20. `@netlify/plugin-nextjs` auto-detected. Headers preserved: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Single-tenant prototype.

**Target**: same Netlify project with Next.js Runtime (serverless functions for API routes), Supabase as managed Postgres + Auth. Env vars: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Cutover requirement**: zero downtime on `practice-iq.netlify.app`. Operations safeguard applies. Plain-English impact disclosure required before any infrastructure change.

## 16. Known Risks

1. **Static-export trap** - **RESOLVED 2026-04-30 (Section 14 Step 1 close)**. `output: "export"` removed in Task 1.2 (C-2026-04-30-09); `netlify.toml` updated in Task 1.3 (C-2026-04-30-12); live URL serves dynamic Next.js Runtime. Historical entry retained for audit trail.
2. **Single-file frontend** - 1,129-line `page.tsx` carries all UI, state, and logic. High regression surface for any backend wiring. Modular split planned (`NEXT_TASKS.md` item 4).
3. **localStorage as source of truth** - UI workspace state is browser-local until Section 14 Step 5 cutover. Any browser holding the prototype state could lose it on a key rename without an export bridge.
4. **Prisma provider mismatch** - **RESOLVED 2026-04-29 / 2026-04-30 (Section 14 Step 2)**. Provider switched from `sqlite` to `postgresql`; first migration `20260429185225_init_postgres` applied to Supabase Mumbai. Historical entry retained for audit trail.
5. **Hardcoded Platform Owner credentials** - the SHA-256 password digest in the seed ships to every browser. Must be removed before any external-firm exposure. Removed in Section 14 Step 4 when Supabase Auth lands.
6. **Compliance posture (open)** - DPDP Act applicability, audit log retention period, data residency for Supabase region not yet decided. Tracked under MASTER_PROJECT.md Section 22 Pilot-to-SaaS Scaling Guardrails (pre-real-client-data checklist 22.5).
7. **Schema divergence: `Firm.emailDomain` vs `AllowedFirmDomain`** - origin uses `Firm.emailDomain` (single string) instead of D-2026-04-30-10's planned `AllowedFirmDomain` table (multi-domain per firm). Acceptable for the current single-firm prototype; revisit when commercial activation requires firms with multiple domains. (D-2026-04-30-15.)
8. **ActivityLog writes deferred** - `writeActivityLog()` is a documented no-op until Section 14 Step 4 supplies a real `actorId` (D-2026-04-30-15 Decision 4). Read endpoint is live (3C, C-2026-05-03-01) but returns empty results until then. Audit trail is dark in the interim; 3B / 3C call sites already invoke the helper at the right semantic points so light-up needs no route churn.
9. **Notification entities not in schema** - `UserNotificationPreference`, `NotificationLog` tables and `NotificationChannel` / `NotificationType` enums planned per D-2026-04-30-10; not yet shipped. No reminders or audit-grade notification trail until added (Phase 2 work).
10. **RLS not configured** - row-level security policies not yet defined on tenant-scoped tables. Tenant isolation is enforced today at the route layer only via `requireAuth` + `firmId` filters. RLS adds a defence-in-depth layer; required pre-real-client-data per Section 22.5.
11. **Backup and monitoring beyond defaults** - no PITR, no read replica, no application-level monitoring or alerting beyond Netlify and Supabase free-tier defaults. Acceptable for Stage 0 POC; trigger points for paid plans live in Section 22.4.

## 17. Long-term Roadmap

Five phases, milestone-level, no calendar dates. Calendar timing stays in `CURRENT_STATUS.md`. Three release-readiness gates overlay the phases (per D-2026-04-30-14).

- **Phase 1 - Prototype hardening**: foundation cutover, Postgres + Auth + RBAC + persistence (the five-step backend plan), `ActivityLog` live, hardcoded credentials removed, `AllowedFirmDomain` enforced.
  - **Pre-Beta gate** (within Phase 1 / 2 transition): low-clutter UX principles in force (Section 20); Client Request Reminder Engine prototyped internally (Section 21.1); email reminder architecture in place; plan / module flag structure live.
- **Phase 2 - Multi-firm GA**: **Product Experience Review per Section 20.7 approved as the entry gate to beta**, firm onboarding flow, Platform Owner admin tools live, real reports against Postgres, email reminders sending (daily morning + overdue), `UserNotificationPreference` and `NotificationLog` live, basic monitoring and backups.
- **Phase 3 - Workflow depth**: workflow templates module, recurring tasks, advanced reports, audit log search, data export tools.
  - **Pre-Paid-Launch gate** (within Phase 3 / 4 transition): plan-based feature visibility live; subscription readiness verified; recurring workflows shipped; blocker tracking working; advanced reports complete.
- **Phase 4 - Commercial activation**: billing portal live, plan enforcement, payment provider wired, CPA-ready locale lifts begin (currency, tax-ID polymorphism).
- **Phase 5 - Intelligence and reach**: contextual AI capabilities per Section 19 (assignment-tree builder; capacity-aware assignment recommendation; smart daily execution briefing); WhatsApp reminders module; external integrations (tax portals, accounting software); CPA market launch.
  - **Post-Launch / Premium tier**: Client Portal live (all Section 21.2 security pre-conditions met); Document Upload live; WhatsApp reminders sending; AI assignment builder shipped; Email integration live.

## 18. Document Discipline

- **MASTER_PROJECT.md** (this file) - edit only on architecture, product, or strategic change.
- **CURRENT_STATUS.md** - edit after every milestone, audit, or stage shift. Holds calendar dates, what works, what is blocked.
- **DECISION_LOG.md** - edit on any meaningful product / architecture / database / auth / deployment / pricing decision. One entry per decision.
- **CHANGE_LOG.md** - edit after every implementation. One entry per change with files touched and test status.

Cross-referenced from project instructions. Read these four files at the start of every major task before assuming project state.

## 19. Product Intelligence Strategy

PracticeIQ adds intelligence to the workflow without taking over the workflow. The principles below govern every intelligence feature, present or future. See D-2026-04-30-12 for the locked decision.

### Principles

- **Rules first, AI second.** Templates, deterministic logic, and per-firm preferences come before any model call. AI augments where rules cannot reasonably cover the long tail.
- **Contextual and lightweight.** Intelligence appears in the moment of work, never as a separate "AI panel." No clutter on the main task surface.
- **Human approval is mandatory.** The platform suggests, recommends, and warns. The Partner / Admin / Manager / Article-Staff approves and acts. Auto-execution is never the default.
- **Confidential by design.** Every AI call respects firm tenancy, allowed-domain boundaries, audit logging, and user notification preferences (D-2026-04-30-10).
- **Predictable cost.** AI features are gated by Platform Owner module flags and per-firm usage caps; no runaway spend.

### Roadmap items (Phase 4 and Phase 5; not for current build)

The three capabilities below are documented here so Section 14 backend foundation work (Phase 1) anchors the right hooks. They are NOT built until the foundation is stable and the data model in Section 12 is live in Postgres.

**1. AI-assisted assignment tree builder** (Phase 5)

When a Partner / Admin creates an assignment, the platform suggests a task and subtask tree from a template library plus AI assist. Interactive clarifying questions refine scope before any task is created. Human approval is required before the tree is committed to the workspace. Templates come first; AI fills gaps and adapts wording to firm conventions. Module flag: `AI_ASSISTANT`.

**2. Capacity-aware assignment recommendation** (Phase 5)

While a creator picks an assignee for a task, the system checks the assignee's current open workload, near-term due dates, review backlog, and availability windows. The UI shows a light recommendation or a warning if the assignee is overloaded. Auto-assignment never happens. Module flag: `AI_ASSISTANT` (capacity layer; rules-first, AI second for ambiguity).

**3. Smart daily execution briefing** (Phase 4 to 5)

A daily summary for Partner and Firm Admin covering tasks due today, overdue tasks, tasks under review, tasks blocked on client input, and high-risk items (overdue plus critical priority plus key client). Initially deterministic; AI later for narrative quality and prioritization. Delivery via email or WhatsApp per `UserNotificationPreference` (D-2026-04-30-10). Module flag: combination of `EMAIL_REMINDERS` / `WHATSAPP_REMINDERS` / `AI_ASSISTANT`.

### Build Discipline

- These three capabilities will not be built before Section 14 Steps 1 to 5 are complete.
- Each capability gets its own Plan → Approval → Execution → Test → Log cycle when its turn arrives.
- Templates and rules-based versions ship first; AI is added only when rules clearly fall short and the cost is justified.
- Future intelligence features must conform to the five principles above, or get an explicit exception decision recorded in DECISION_LOG.

## 20. Product Experience & Guided UX Principles

PracticeIQ is a guided execution system for CA / CPA firm operations, not a static task tracker. The principles below govern visual design, role-based experience, workflow flow, input handling, and decision support. They are mandatory by beta release and applicable to every UI feature from this point on. See D-2026-04-30-13 for the locked decision.

### 20.1 Visual Design Direction

- Professional, calm, clean, serious. Suited to CA / CPA firm operations.
- Light, structured, business-grade. Plenty of whitespace, considered typography, restrained colour palette.
- NOT flashy, childish, overloaded, or generic-dashboard-template.

### 20.2 Role-Based User Experience

The platform experience changes by logged-in role. Each user sees only what is relevant to their access and responsibilities. Section 10 governs *what is permitted*; UX surfacing governs *what is shown*. No exposure of irrelevant controls to lower roles.

| Role | Surface principle |
|---|---|
| Platform Owner | Cross-firm controls, firms, plans, modules, audit, security |
| Firm Admin | Firm-wide controls (team, clients, tasks, reports, firm settings); not platform-level |
| Partner | Supervisory view: pipeline, review queue, escalations |
| Manager | Execution view: task creation, assignment, review-where-needed |
| Article / Staff | Workspace view: assigned tasks, progress notes, move-to-review |

### 20.3 Guided Workflow Design

After login, the user should not feel lost. Every screen clearly shows:

- What needs attention.
- What is pending.
- What action is expected.
- What should happen next.

Empty states are guidance opportunities, not blank "welcome" screens.

### 20.4 Progressive Input Capture

The platform avoids asking for too many fields at once. Inputs are captured step by step where possible. Lightweight decision prompts, guided forms, and MCQ-style interactions reduce confusion and increase completion. The Phase-1 task-creation modal pattern (required-first, details-later) is the canonical model.

### 20.5 Interactive Decision Support

For important actions (creating assignments, assigning reviewers, closing tasks, resolving overdue work), the platform assists with contextual prompts. The platform recommends; the user decides. Human approval remains mandatory (consistent with Section 19 principle "human approval is mandatory").

### 20.6 Low-Clutter Interface Rule

- No unnecessary panels, floating widgets, or excessive AI suggestions.
- Intelligence (per Section 19) appears only where it helps the user make a decision or complete a task.
- Interface stays clean and focused.
- **Acceptance test for any new feature**: "Does this help the user complete work faster, or does it add clutter?" If the answer is unclear, the feature does not ship until it is.

### 20.7 Design Review Gate (Mandatory before Beta)

Before beta release, PracticeIQ passes a Product Experience Review covering:

- Visual design quality (calm, professional, business-grade).
- Role-based usability (each role's view is appropriate).
- Ease of navigation (guided, low cognitive load).
- Guided workflow quality (next-action clarity).
- Input burden (progressive capture working).
- Decision support quality (Section 19 and 20.5 honoured).
- Whether a new user can operate without full training.

Performed by Pankaj or designated reviewer. Beta release is blocked until the review is approved and recorded in DECISION_LOG.

### 20.8 Final UX Objective

PracticeIQ should feel like a guided execution system, not a static task tracker.

## 21. Product Strategy & Release-Readiness

Strategic principles governing the order in which features ship, the security and monetization preconditions, and the operational discipline that holds Section 14 (Backend Strategy) intact when commercial pressure builds. See D-2026-04-30-14 for the locked decision.

### 21.1 Client Request Reminder Engine (preferred over early Client Portal)

Before any Client Portal ships, PracticeIQ supports an internal client-request and reminder engine. Firm users can:

- Record documents or information pending from a client.
- Link the pending request to a client and / or a task.
- Assign the internal owner responsible for follow-up.
- Set a due date.
- Trigger email reminders to the client.
- Ask the client to submit documents to a specified firm email ID (out-of-band; no in-app upload yet).
- Track reminder history and the request's status: pending / received / verified.

This avoids early document-storage risk while solving the real operational problem: client-side delays. The engine ships in the Phase-2 / 3 window per the Pre-Paid-Launch gate (Section 17).

### 21.2 Client Portal Security Pre-Conditions (locked)

The Client Portal and any in-app document upload are a future premium-tier module, not a default capability. Before enabling client document upload, the platform must define and approve all of the following:

1. Where documents will be stored (provider, region, bucket structure).
2. Access control and role-based permissions on every document.
3. Encryption at rest and in transit.
4. Audit logs for upload, view, download, and delete events.
5. Retention and deletion policy (per firm and per regulator).
6. Data residency considerations (especially for Indian firms).
7. Backup and restore process with tested recovery time.
8. Malware / file scanning approach.
9. Client consent and terms-of-use language.
10. Admin controls for portal access (firm-side and platform-side).
11. Firm-level enable / disable settings.

**Rule**: Client document upload does not ship until every pre-condition above is approved and recorded in DECISION_LOG.

### 21.3 Monetization Discipline

PracticeIQ supports plan-based feature gating (Section 5) and module flags (Section 9). Heavier-use clients can be served by upgrading their plan or activating a paid module. Four standing don'ts:

- Do not allow commercial pressure to break the locked Section 14 backend execution sequence.
- Do not activate Client Portal or Document Upload before Section 21.2 pre-conditions are met.
- Do not clutter operational screens with locked or disabled "premium" buttons. Premium features surface only in the controlled Plan & Modules / Upgrade Features area.
- Do not override Platform Owner module-flag governance for revenue convenience.

Premium feature visibility lives in one place; the operational workspace stays focused on getting work done.

## 22. Pilot-to-SaaS Scaling Guardrails

Lightweight governance framework for the founder-led POC stage. Designed to protect future scalability, client-data safety, platform continuity, and migration flexibility without creating bureaucracy too early. See D-2026-05-03-01 for the locked decision. Does NOT reorder, weaken, or override Section 14 (Backend Strategy).

### 22.1 Stage definition

PracticeIQ progresses through three named stages. The current stage is recorded in `CURRENT_STATUS.md` Repo Health.

| Stage | Definition |
|-------|------------|
| **Stage 0 - Founder-led POC** | Non-technical founder + AI-assisted development. No real client data. Locked-by-default APIs. localStorage UI. Personal accounts on GitHub / Netlify / Supabase. |
| **Stage 0.5 - Controlled beta candidate** | Eligible to invite friendly pilots. Section 14 Steps 4 (Auth) and 5 (Persistence) complete. Real auth, real persistence, ActivityLog writes live. Privacy Policy published. |
| **Stage 1+ - Commercial SaaS** | First paying firm signed. Company-owned core accounts. Legal terms, DPA, cancellation, and data-export paths in place. |

Stage promotion is gated on the relevant checklist (22.5, 22.6). No promotion happens by accident.

### 22.2 Stage 0 acceptable

- Personal ownership of GitHub (`casinghal`), Netlify, Supabase
- Single-developer commits with founder supervision
- Free-tier Supabase, Netlify, no PITR, no read replica
- localStorage as UI persistence (until Section 14 Step 5)
- Manual customer support (no ticketing, no formal SLA)
- One Supabase project, one Netlify site, one DB
- No SOC2 / ISO27001 documentation
- Test data, fixture data, anonymised data only

### 22.3 Stage 0 not acceptable

- Real firm operational usage before Section 14 Steps 4 and 5 complete
- Production database reset
- `prisma migrate reset` against production
- Destructive schema or database changes without explicit founder approval
- Document upload before Section 21.2 pre-conditions are approved
- Use of highly sensitive client files (PAN, Aadhaar, bank statements, KYC, signed agreements, financial returns) in early pilot
- Production data exports without explicit founder approval
- Sharing GitHub / Netlify / Supabase access with anyone other than founder before Stage 1
- Real bulk emails or outreach using the platform's domain or sender identity
- Public marketing or launch announcements before Stage 0.5
- Connecting PracticeIQ to Avantage live financial systems (QBO / Sage / Tally) at any stage
- Mixing client data across firms (cross-tenant contamination)

### 22.4 Stage gates and trigger points

| Trigger | Fires at | Why |
|---------|----------|-----|
| Company-owned GitHub org | First paying firm | Personal account = single point of failure for IP / access |
| Company-owned Netlify | 3 active firms | Team access + production SLA risk |
| Company-owned Supabase project | First paying firm | Data ownership + billing isolation |
| Company-owned custom domain | Pre Stage-0.5 | Brand identity for pilot URLs |
| Company-owned billing account | First paying firm | Revenue and tax compliance |
| Paid Supabase Pro plan | First paying firm OR > 500MB DB | PITR availability, free-tier limits |
| Paid Netlify Pro plan | 3 active firms OR > 100GB bandwidth | Deploy concurrency, team access, SLA |
| Backup + PITR | First paying firm | Operational hygiene |
| Basic support process (email + response window) | First friendly pilot | Founder must commit publicly |
| Legal terms (T&C + Privacy Policy) | First friendly pilot (even free) | Liability cap, IP, data handling |
| DPA template | First paying firm | Required by client compliance teams |
| Data retention / export / cancellation / deletion policy | First paying firm | Right to be forgotten + offboarding |
| E&O / professional liability insurance | 5 paying firms | Risk transfer once revenue justifies premium |
| DPDP Act formal compliance posture | First friendly pilot if Indian; otherwise Stage 1 | Indian data protection statute |

### 22.5 Pre-real-client-data checklist

Must all pass before any non-test client data enters PracticeIQ:

- Section 14 Step 4 Supabase Auth landed (hardcoded SHA-256 digest gone)
- Section 14 Step 5 Persistence cutover landed (localStorage no longer source of truth)
- `writeActivityLog()` live and writing to `ActivityLog`
- RLS policies configured on every tenant-scoped table
- Daily Supabase backup confirmed working
- At least one successful full restore drill
- HTTPS enforcement confirmed
- Privacy Policy published on the live URL
- DPDP Act applicability assessed
- Audit log retention period decided and documented
- Founder operational availability documented (response window, escalation path)
- First friendly firm signed a short pilot acceptance letter (non-binding)

### 22.6 Pre-paid-client checklist

Pre-real-client-data checklist passed AND:

- T&C published and accepted at signup
- DPA template ready (even single-page)
- Pricing locked
- Subscription billing owner identified (founder or company)
- Refund policy decided
- Cancellation path documented and tested
- Data export endpoint operational (downloadable bundle, structured)
- Data deletion path documented and tested (right to be forgotten)
- Support email + response SLA published
- Status URL or status page for outages
- Company-owned GitHub org evaluated
- Company-owned Supabase project evaluated
- Company-owned billing account live
- DPDP Act compliance posture documented
- E&O insurance quoted (purchase deferred to 5 paying firms trigger)
- First paying firm signed full T&C + DPA

### 22.7 Platform Ownership Register

A short companion document captures account ownership facts: account holder, login email, recovery method, billing owner, emergency access. Template fields: GitHub, Netlify, Supabase, Domain / DNS, Email sender, Billing / subscription owner, Emergency access owner. Population deferred per D-2026-05-03-01 (Option A); the register is named here and lives in a separate file once populated. Location to be decided when populated.

### 22.8 Section 14 non-impact

This section does NOT reorder, weaken, delay, or override Section 14. The locked execution sequence remains: Step 3D Tasks → 3E Team → 3F Modules → Step 4 Auth + RBAC → Step 5 Persistence cutover. Stage 0.5 (Friendly Pilot) is technically blocked until Steps 4 and 5 complete; this section names that block in writing instead of leaving it implicit. Governance lives alongside execution, not in front of it.

### 22.9 Cost discipline at Stage 0

PracticeIQ is a founder-led POC. Capital and time both flow at Stage 0. Until Stage 1+ revenue justifies it, every recommendation prefers free, built-in, open-source, or existing-stack options before any paid spend. Trigger points for paid plans live in 22.4; this subsection governs how recommendations are framed and chosen day-to-day.

**Order of preference for any new capability:**

1. **Existing stack** - is the capability already available in Netlify, Supabase, GitHub, Prisma, Next.js, or one of the Tier 1 governance files? If yes, use it.
2. **Free / built-in tier** - does Netlify free, Supabase free, GitHub free, or another provider's free tier cover the need? If yes, use it.
3. **Open-source self-hosted** - is there a mature open-source tool that runs inside the existing stack with no incremental hosting cost? If yes, evaluate and use.
4. **Paid tier with clear justification** - only when free / built-in / open-source genuinely does not cover the need.

**Every paid recommendation must answer four questions in writing:**

1. **Why is free / built-in / open-source not enough?** (Specific gap in the free option.)
2. **When does paid become necessary?** (Stage gate or usage trigger - e.g., Stage 0.5 friendly pilot, first paying firm, 3 active firms, 5 paying firms, or a specific volume / quota threshold.)
3. **What is the trigger?** (Concrete, observable event that flips the recommendation from "defer" to "buy".)
4. **What is the rollback / downgrade path?** (How to leave the paid plan if the trigger reverses.)

**Acceptable reasons for a paid recommendation at Stage 0** (otherwise defer):

- **Security**: a paid feature closes a real security gap that free / built-in / open-source cannot
- **Data safety**: backup / restore / audit obligations that free options cannot meet for the data sensitivity in question
- **Reliability**: the free tier's uptime or rate limits would cause real user impact
- **Unavoidable API cost**: the feature itself requires paying a provider (e.g., AI text refinement, transactional email at scale, WhatsApp Business API, payment gateway)
- **Client / revenue trigger**: a paying firm has explicitly required the capability as a condition of paying
- **Future scalability**: the upgrade path needs to be in place before a known short-term scale event (e.g., friendly pilot inviting N firms within Y weeks)

**Categories where existing stack is the default starting point:**

| Need | Default starting point |
|------|------------------------|
| Hosting / build / SSL / security headers | Netlify free + `netlify.toml` |
| Database / auth / storage / RLS / manual backups | Supabase free |
| Source control / branch protection / Dependabot / Actions free minutes | GitHub free |
| ORM / migrations / validation | Prisma + Zod |
| Server functions / API routes | Next.js dynamic runtime |
| Project memory / governance / decision history / change history / agent rules | The five Tier 1 governance file pack at `02_App/tos-app/` |
| Documentation / runbooks / incident log / status notes | Markdown in repo |
| Monitoring / failed-auth signals (Stage 0) | Supabase default logs + Netlify function logs + `console.warn` server-side |

**Categories where paid spend is acceptable when the trigger fires:**

| Need | Free / built-in path | Paid path (named example only) | Trigger to upgrade |
|------|----------------------|--------------------------------|--------------------|
| Database backup / PITR | Manual `pg_dump` to free object storage | Supabase Pro PITR (or equivalent) | First paying firm per 22.4 (consider pulling earlier if pilot data sensitivity warrants) |
| Transactional email | Provider free tier with low daily cap | Provider paid tier (Resend / SES / similar) | First friendly pilot (so reminders actually send) |
| AI text refinement | None - inherently paid API | Anthropic / OpenAI / similar | When `WRITING_ASSIST` ships per Section 23.9 |
| WhatsApp messaging | None - inherently paid (BSP fees) | WhatsApp Business API via a Business Solution Provider | When `WHATSAPP_REMINDERS` ships (Phase 5) |
| Payment processing | None - inherently paid | Razorpay / Stripe / similar | First paying firm |
| Application monitoring beyond Supabase / Netlify defaults | Console logs + manual review | Sentry / similar | 3 active firms OR first reported user-facing incident |

Vendor prices, free-tier limits, and plan limits are NOT hardcoded in this section. The agent verifies current pricing and limits from official vendor sources at the time of recommendation and surfaces them in chat for the specific decision; the documented rule stays principle-based. Named vendors above are examples only, not locked vendor decisions.

**Cost discipline interacts with three other governance items:**

- **Section 22.4 stage gates** specify *when* paid plans become acceptable for PracticeIQ's own infrastructure. 22.9 specifies *how* every recommendation is framed in the meantime.
- **Section 23.7 plan-tier feature codes** specify *which* features sit behind paid tiers in PracticeIQ's own commercial model. 22.9 governs which paid tools PracticeIQ itself buys to build the platform.
- **Section 24.4 synchronization rules** require any new agent behaviour rule to live in `AGENTS.md`. The cost-discipline behaviour rule lives at AGENTS G9.

This subsection does NOT change Section 14 sequence, does NOT block any current work, and does NOT mandate retrospective re-justification of already-approved tooling. It applies forward from the commit that adopts it.

## 23. Pre-Build Architecture Locks for Section 14 Step 3D

Architecture and SaaS guardrails locked before Section 14 Step 3D Tasks routes are implemented. Section 14 sequence is preserved; this section is consumed by the 3D plan as implementation constraints. See D-2026-05-03-02 for the locked decision. Does NOT reorder or weaken Section 14.

### 23.1 Task status and priority canonical sets

`TaskStatus` (canonical, no other values permitted at the route layer):

- `OPEN`
- `IN_PROGRESS`
- `PENDING_CLIENT`
- `PENDING_INTERNAL`
- `UNDER_REVIEW`
- `CLOSED`
- `CANCELLED`

`Priority` (canonical):

- `LOW`
- `NORMAL` (default)
- `HIGH`
- `CRITICAL`

These constants live in a single source of truth (`src/lib/task-constants.ts`, to be created during the 3D wave). Schema columns (`Task.status`, `Task.priority`) remain `String` in Prisma; the route layer enforces the allowed values via Zod. No schema migration required for 3D.

Reopen is **not** a persistent status. It is an action / event (see 23.3 and the audit taxonomy in 23.6). The status set above is final and complete.

### 23.2 Task lifecycle transitions matrix

Allowed next states from each current state. Any other transition returns 422 from 3D PATCH.

| From | Allowed next states |
|------|---------------------|
| `OPEN` | `IN_PROGRESS`, `PENDING_INTERNAL`, `PENDING_CLIENT`, `CANCELLED` |
| `IN_PROGRESS` | `PENDING_INTERNAL`, `PENDING_CLIENT`, `UNDER_REVIEW`, `CANCELLED` |
| `PENDING_CLIENT` | `IN_PROGRESS`, `UNDER_REVIEW`, `CANCELLED` |
| `PENDING_INTERNAL` | `IN_PROGRESS`, `UNDER_REVIEW`, `CANCELLED` |
| `UNDER_REVIEW` | `IN_PROGRESS` (revision back), `CLOSED`, `CANCELLED` |
| `CLOSED` | `IN_PROGRESS` only via approved reopen action (see 23.3) |
| `CANCELLED` | terminal — no transitions out |

The transition map is stored as `TASK_STATUS_TRANSITIONS` in `src/lib/task-constants.ts`. Routes do not encode allowed-next state inline.

### 23.3 Reopen, cancel, and closure rules

**Closure (`UNDER_REVIEW → CLOSED`)**:

- Only the task's mandatory reviewer (or `FIRM_ADMIN`) may move to `CLOSED`. Assignees cannot self-close (Section 10 + `permissions.ts`).
- `closureRemarks` must be non-empty and trimmed at the route layer.
- `closedAt` set to now; `closedById` set to actor.
- A `TaskNote` row is written with `oldStatus = UNDER_REVIEW`, `newStatus = CLOSED`, body mirroring `closureRemarks`.

**Reopen (`CLOSED → IN_PROGRESS`)**:

- Reopen is an **action**, not a persistent status. It is the only way to leave `CLOSED`, and it routes through the dedicated `POST /api/tasks/[id]/reopen` endpoint (3D-3). PATCH `/api/tasks/[id]` cannot reopen a closed task; it returns 422 with a redirect to the reopen endpoint.
- Default destination state is `IN_PROGRESS`. No other reopen target supported.
- Allowed actors: `FIRM_ADMIN`, or the original reviewer of the task.
- A reason (free text, non-empty, trimmed) is required and recorded as a `TaskNote` with `oldStatus = CLOSED`, `newStatus = IN_PROGRESS`, body = the reopen reason.
- All three current-state closure fields on `Task` are cleared on reopen: `closedAt`, `closedById`, AND `closureRemarks` are set to null (per the field-clear correction at D-2026-05-04-03). This preserves the schema invariant "closure fields populated iff status is `CLOSED`".
- Historical closure rationale is NOT lost on reopen. It remains preserved through (a) the original `TaskNote` row created at close time with `oldStatus = UNDER_REVIEW`, `newStatus = CLOSED`, body mirroring the original `closureRemarks`; and (b) the `TASK_CLOSE` ActivityLog entry's `{ noteId }` reference (when Step 4 lights up writes). `Task.closureRemarks` is a current-state column only, not the audit anchor; the durable record lives on the firm-scoped `TaskNote` row.
- ActivityLog action emitted (when Step 4 lights up writes): `TASK_REOPEN` with `{ noteId }` metadata pointing to the reopen-event `TaskNote`.

**Cancel (`<active state> → CANCELLED`, terminal)**:

- Allowed actors: `FIRM_ADMIN`, `PARTNER`, or the task creator (subject to the role restriction below).
- Allowed only from active / non-closed states: `OPEN`, `IN_PROGRESS`, `PENDING_CLIENT`, `PENDING_INTERNAL`, `UNDER_REVIEW`.
- `CLOSED` tasks cannot be cancelled directly via the cancel endpoint. The cancel endpoint returns 422 with a redirect message ("Reopen first if needed"). If cancellation is required after closure, the task must be reopened first (which returns it to `IN_PROGRESS` per the reopen rules above) and then cancelled. This avoids a synthetic `CLOSED → CANCELLED` direct transition that would bypass the reopen audit event and the closure-field-clear invariant.
- Already-`CANCELLED` tasks cannot be cancelled again. The cancel endpoint returns 422.
- A reason (free text, non-empty, trimmed) is required and recorded as a `TaskNote` with `oldStatus = <current>`, `newStatus = CANCELLED`, body = the cancel reason.
- `CANCELLED` is terminal; cannot be reopened. To resume work, a new task must be created.
- Role restriction (per Section 23.5): `ARTICLE_STAFF` cannot cancel a task even when they are the creator. Creator-based cancel applies only to `MANAGER` (with `isCreator` context); `FIRM_ADMIN` and `PARTNER` always.
- ActivityLog action emitted (when Step 4 lights up writes): `TASK_CANCEL` with `{ noteId }` metadata pointing to the cancel-event `TaskNote`.

### 23.4 Inactive user and inactive client handling

**Inactive user** (deactivated via Step 3E or future team route):

- New task POST refuses an `assigneeId` or `reviewerId` that resolves to an inactive `FirmMember`.
- Existing task assignments survive — no orphaning, no automatic reassignment.
- Existing reviewer assignments survive — closure path remains via `FIRM_ADMIN` reopen + reassign if the original reviewer cannot act.
- ActivityLog action when toggled (Step 3E): `TEAM_MEMBER_DEACTIVATE` / `TEAM_MEMBER_REACTIVATE`.

**Inactive client** (soft-deleted via 3B PATCH `status: "INACTIVE"`):

- New task POST refuses a `clientId` that resolves to an `INACTIVE` client (returns 422 with explicit message).
- Existing tasks against the now-inactive client survive and remain editable. Reports filter them out by default but can include them when explicitly requested.

### 23.5 Other task rules consumed by 3D

- **Mandatory client**: schema enforces (`Task.clientId` non-nullable). Route validates client exists, belongs to caller's firm, and is `ACTIVE`.
- **Mandatory reviewer**: schema enforces (`Task.reviewerId` non-nullable). Route validates reviewer is an active `FirmMember` of caller's firm.
- **Cross-firm ID validation**: every `clientId`, `reviewerId`, `assigneeId` referenced in POST or PATCH must resolve to a record with `firmId == session.firmId`. Mismatch returns 404 (does not leak existence). This is the single most important tenant-isolation invariant in 3D.
- **Multi-assignee**: at least one assignee required at POST. Add / remove operations are set semantics (not replace-all). Assignee mutation goes through a dedicated endpoint (3D sub-route, e.g., `PATCH /api/tasks/[id]/assignees`).
- **Reassignment authority**: `FIRM_ADMIN` always; `PARTNER` and `MANAGER` only when caller is task creator or current reviewer; `ARTICLE_STAFF` cannot reassign.
- **Due date**: `Task.dueDate` is mandatory and must be a valid ISO 8601 datetime. **Past due dates are permitted** because firms enter backlog tasks at onboarding and during ad-hoc cleanup. Past-due tasks surface as overdue in reports; the route does not reject them.
- **Progress note minimum**: 1 character (trimmed); maximum 4000 characters. Required when status moves to `PENDING_CLIENT`, `PENDING_INTERNAL`, `UNDER_REVIEW`, or `CANCELLED`. Required on reopen (the reopen reason). Optional on `OPEN → IN_PROGRESS` and on field-only PATCH (no status change).
- **Closure remarks**: non-empty, trimmed, required at transition to `CLOSED`. Stored on `Task.closureRemarks` and mirrored as the body of the auto-created `TaskNote`.

### 23.6 Audit event taxonomy for Task entity

Canonical `action` strings called from 3D route code via the deferred `writeActivityLog()` helper. Writes remain a no-op until Step 4 supplies a real `actorId`; the action strings lock now so the audit trail is consistent from day one when writes light up.

| Event | Action string | Metadata (`metadataJson`) |
|-------|---------------|---------------------------|
| Task created | `TASK_CREATE` | none |
| Task field edited (non-status) | `TASK_UPDATE` | changed field names |
| Task status moved | `TASK_STATUS_CHANGE` | `oldStatus`, `newStatus` |
| Note added (no status change) | `TASK_NOTE_ADD` | none |
| Assignees added | `TASK_ASSIGNEE_ADD` | added `userId`s |
| Assignees removed | `TASK_ASSIGNEE_REMOVE` | removed `userId`s |
| Reviewer changed | `TASK_REVIEWER_CHANGE` | `oldReviewerId`, `newReviewerId` |
| Task closed | `TASK_CLOSE` | `{ noteId }` reference to auto-created TaskNote (closureRemarks is current-state only on Task; cleared by reopen per D-2026-05-04-03) |
| Task reopened | `TASK_REOPEN` | reason (note ID reference) |
| Task cancelled | `TASK_CANCEL` | reason (note ID reference) |

ActivityLog writes for non-Task entities (Team, Module, Plan, Auth, Cross-firm, Data) follow the same lock pattern; the full taxonomy is recorded in the Pre-3D scan (D-2026-05-03-02 Impact section).

### 23.7 Plan-tier feature codes (canonical)

Locked feature / module code set used by the future `requireEntitlement` helper (23.8) and by the Platform Owner Plan & Modules surface. Pricing values remain TBC per Section 5.

| Code | Tier required | Module flag? | Notes |
|------|---------------|--------------|-------|
| `TASK_CORE` | Starter+ | no | Always-on for paying firms |
| `CLIENT_CORE` | Starter+ | no | Always-on for paying firms |
| `TEAM_CORE` | Starter+ | no | Always-on for paying firms |
| `BASIC_REPORTS` | Starter+ | no | |
| `RECURRING_TASKS` | Professional+ | yes | Phase 2/3 |
| `CLIENT_REQUEST_ENGINE` | Professional+ | yes | Section 21.1 |
| `ADVANCED_REPORTS` | Professional+ | yes | Phase 3 |
| `EMAIL_REMINDERS` | Professional+ | yes | Phase 2 |
| `WRITING_ASSIST` | Professional+ | yes | Section 23.9; deferred |
| `CLIENT_PORTAL` | Enterprise | yes | Section 21.2 pre-conditions all met |
| `DOCUMENT_UPLOAD` | Enterprise | yes | Section 21.2 |
| `WHATSAPP_REMINDERS` | Enterprise | yes | Phase 5 |
| `AI_ASSIGNMENT_BUILDER` | Enterprise | yes | Section 19 item 1 |
| `CAPACITY_INTELLIGENCE` | Enterprise | yes | Section 19 item 2 |
| `AUDIT_LOG_SEARCH` | Enterprise | yes | |
| `ADVANCED_ADMIN_CONTROLS` | Enterprise | yes | |

Beta / pilot firms are NOT a hardcoded code branch. They are subscribed to a `Plan` row (`BETA` or equivalent) with `FirmModuleAccess` rows enabling whatever modules the pilot needs. The `requireEntitlement` resolver (23.8) treats them as ordinary firms.

### 23.8 Entitlement helper shape (future-only)

The shape below is locked so future routes consume a stable signature. **The helper itself is NOT built during 3D.** 3D core CRUD does not call it. The first route to import `requireEntitlement` is whichever ships the first paywall-gated feature (likely `RECURRING_TASKS` in Phase 2/3).

```ts
// src/lib/entitlements.ts (FUTURE — not built in 3D)
export type EntitlementResult =
  | { ok: true }
  | { ok: false; status: 402 | 403; message: string };

export async function requireEntitlement(
  firmId: string,
  featureCode: string,
): Promise<EntitlementResult>;
```

Resolution order (when implemented):

1. Active `FirmSubscription` (status in `TRIAL`, `ACTIVE`, `GRACE`).
2. Subscription's plan tier ≥ feature's required tier (per 23.7).
3. For module-flag-gated features, `FirmModuleAccess.isEnabled = true`.
4. Returns `{ok: false, status: 402}` for plan-tier failures; `{ok: false, status: 403}` for module disabled; `{ok: true}` otherwise.

UI hiding alone is never sufficient — every paywall-relevant route MUST call `requireEntitlement` server-side once it is built. Operational screens carry no premium clutter (Section 21.3); locked features live only in the Plan & Modules surface.

Payment gateway integration and billing automation remain deferred to Phase 4 (Section 17).

### 23.9 Writing Assist - deferred capability concept

A future lightweight feature that helps users improve wording in task title, task description, progress notes, review comments, blocker notes, client request text, and closure remarks - without changing meaning or intent.

**Feature code**: `WRITING_ASSIST` (locked in 23.7). Recommended tier: Professional+. Beta firms may receive it through plan / module access later.

**Fits Section 19 Product Intelligence Strategy** (rules first, contextual, human approval mandatory, confidential by design, predictable cost).

**Locked guardrails (for the future implementation)**:

- Available to all firm roles where text boxes exist (`FIRM_ADMIN`, `PARTNER`, `MANAGER`, `ARTICLE_STAFF`).
- User approval is mandatory on every suggestion. **Never auto-replace user text** under any condition. Original user text is the canonical value until the user explicitly clicks Accept.
- **No document or file processing** — text refinement only on user-typed strings within PracticeIQ text fields.
- Controlled exclusively by entitlement / module flag (`requireEntitlement(firmId, "WRITING_ASSIST")`). Module-flag default = OFF.
- **Per-firm and per-user daily usage caps required before any implementation** (cap values configurable on `Plan` row when implemented). Cap exceeded returns 429 with a friendly daily-limit message.
- Data safety: PII scrub before send; no client-name embedding in prompts; provider must not use requests for training; per-firm opt-in setting; audit log every call.
- UI placement: small inline action ("Improve wording") next to qualifying textareas; never a separate AI panel; honours Section 20.6 low-clutter rule; disabled when module flag is off.
- Field design: no schema change required for forward-compatibility. Existing `String` columns (`Task.title`, `Task.description`, `Task.closureRemarks`, `TaskNote.note`) accommodate refinement on user accept.

**Not implemented during 3D.** No AI calls, no provider selection, no PII scrub layer, no UI affordance — none of these ship in 3D. This subsection locks only the concept, the feature code, and the guardrails.

### 23.10 Section 14 non-impact

This section does NOT reorder, weaken, delay, or override Section 14. The locked execution sequence remains: Step 3D Tasks → 3E Team → 3F Modules → Step 4 Auth + RBAC → Step 5 Persistence cutover. No schema change is introduced. All 23.1-23.9 locks operate at the route layer (Zod validation, transition map, ID-belongs-to-firm checks) using one new constants file (`src/lib/task-constants.ts`) that the 3D wave will create. Future entity route groups (3E Team, 3F Modules) consume this section's pattern per AGENTS.md G7.

## 24. Governance File Maintenance & Independent Review Protocol

Standing protocol for maintaining the Tier 1 governance files consistently and for using independent ChatGPT review as a control input at named milestones. Adopted per D-2026-05-03-03. Does NOT reorder Section 14.

### 24.1 Tier 1 governance files (always-reviewed control pack)

The five files below are the Tier 1 governance control pack. The agent reads all five at the start of every commit-grade wave and treats them as the canonical project memory.

| File | Path |
|------|------|
| `MASTER_PROJECT.md` | `02_App/tos-app/MASTER_PROJECT.md` |
| `CURRENT_STATUS.md` | `02_App/tos-app/CURRENT_STATUS.md` |
| `DECISION_LOG.md` | `02_App/tos-app/DECISION_LOG.md` |
| `CHANGE_LOG.md` | `02_App/tos-app/CHANGE_LOG.md` |
| `AGENTS.md` | `02_App/tos-app/AGENTS.md` |

### 24.2 Tier 2 review files (reviewed when relevant)

| File | When to review |
|------|----------------|
| `prisma/schema.prisma` | Schema decisions, migration waves, entity additions |
| `src/lib/permissions.ts` | New action codes, role changes, RBAC matrix updates |
| `src/lib/api-helpers.ts` | Changes to `requireAuth`, `requireSession`, response envelope, `writeActivityLog` |
| `src/lib/task-constants.ts` *(once created in 3D)* | Task status, priority, transition matrix changes |
| `src/lib/entitlements.ts` *(once created)* | Feature codes, plan-tier resolution, paywall behaviour |
| `.env.example` | Env-var contract changes |
| `netlify.toml` | Build, headers, plugin, redirect changes |
| `NEXT_TASKS.md` | Current task queue, modular split plan |
| `PROJECT_CONTEXT.md` | Origin handover context |

### 24.3 Role of each Tier 1 file

| File | Canonical role | Edit trigger |
|------|----------------|--------------|
| `MASTER_PROJECT.md` | Stable strategy, architecture, product guardrails, roadmap, canonical product decisions. Slow-moving by design. | Architectural, product, or strategic change. Section 14 step status shifts. New canonical sections. |
| `CURRENT_STATUS.md` | Current operational truth: latest verified runtime/code commit, what works, what is partially built, what is missing, known risks, deployment readiness, next 5-10 priorities. Fast-moving by design. | Every milestone, audit, stage shift, route completion, deployment verification, risk change, current-state change. |
| `DECISION_LOG.md` | Why meaningful decisions were made, alternatives rejected, impact. Append-only. | Any meaningful product / architecture / database / auth / deployment / pricing / governance decision. One entry per decision. |
| `CHANGE_LOG.md` | What changed, files changed, reason, testing required, status. Append-only. | Every implementation wave, including documentation-only waves. One entry per commit-grade unit of work. |
| `AGENTS.md` | How Claude / agents must behave. The operating manual for the AI side of the team. | Any new rule that must apply to future agent behaviour. Working rules live in Section 9 as G1, G2, ... |

### 24.4 Mandatory synchronization rules

1. Any new MASTER governance section needs a paired `DECISION_LOG.md` entry.
2. Any implementation or documentation wave needs a paired `CHANGE_LOG.md` entry.
3. Any milestone, stage shift, route completion, deployment status, or current-state change needs a `CURRENT_STATUS.md` update.
4. Any new agent behaviour rule goes into `AGENTS.md` Section 9 as the next G-rule (G8, G9, ...).
5. Any Section 14 status shift must be reflected in **both** the `CURRENT_STATUS.md` Current Stage block AND the `MASTER_PROJECT.md` Section 14 step text. Updating only one creates drift.
6. Current implementation and target architecture must be clearly labelled if they differ. `MASTER_PROJECT.md` Section 8 uses two columns ("Current" and "Target"). Section 14 step text always names the present state explicitly. Aspirational text must not masquerade as current.
7. Do not leave stale route-status, tech-stack, auth, schema, or risk language in `MASTER_PROJECT.md` after progress has occurred.
8. Documentation-only commits must not advance the "Latest verified runtime/code commit" line in `CURRENT_STATUS.md` Repo Health. That line names the SHA of the last commit that actually changed runtime; documentation commits do not rotate it.

### 24.5 Pre-commit five-file consistency check

**The Tier 1 consistency check applies before every commit-grade wave, whether code or documentation. It does not apply to every minor chat response or exploratory discussion. It applies when Claude is preparing changes that may be staged, committed, pushed, or used as the basis for a major Section 14 step.**

When triggered, Claude runs the 11 checks below and emits a short structured report (~10 lines) before the "ready to stage" message. Result is reported as **GREEN** (all 11 pass), **YELLOW** (one or more checks have informational findings that do not block commit), or **RED** (one or more checks fail and commit is blocked until resolved). On RED, the agent surfaces the failure with an MCQ before staging.

| # | Check | What it catches |
|---|-------|-----------------|
| C1 | MASTER vs CURRENT_STATUS consistency | Section 14 step status, route group status, tech stack state, risk list - all match across files |
| C2 | DECISION_LOG entry exists for any meaningful decision in this wave | New MASTER sections / governance changes shipped without recorded "why" |
| C3 | CHANGE_LOG entry exists for the wave AND accurately lists every file in the staging set | Implementation without documentation; documentation lying about what changed |
| C4 | AGENTS.md updated if future agent behaviour changes | New working rules invented in chat but not recorded for future agents |
| C5 | No stale commit references | Old SHAs that no longer match HEAD; references to commits since reverted |
| C6 | No stale route-status language | "Pending" routes that have shipped; "DONE" routes that haven't |
| C7 | No stale tech-stack state | sqlite-when-Postgres, static-when-dynamic, etc. |
| C8 | No unlogged decisions | New rules / canonical sections without DECISION_LOG paired entry |
| C9 | No undocumented implementation waves | Code or doc changes without CHANGE_LOG paired entry |
| C10 | No conflict between Section 14 and CURRENT_STATUS | Step status, sub-step completion, pending route groups all reconciled |
| C11 | No contradiction between target architecture and current implementation | Target column matches current column where convergence has happened |

### 24.6 Independent ChatGPT review gate

ChatGPT (or any other independent LLM Pankaj uses for second-opinion review) is treated as a **control input**, not an approval. Pankaj invokes the gate manually at the named milestones below.

| Trigger | Why |
|---------|-----|
| Before major Section 14 steps (3D, 3E, 3F, Step 4, Step 5) | Each step is a structural commitment; an independent read catches blind spots Claude carries from the same conversation |
| Before Step 4 Auth / RBAC | Auth / RBAC changes affect every route; second-opinion check is cheap insurance |
| Before Step 5 Persistence cutover | One-way migration risk; second-opinion sees the cutover plan against doc state |
| After meaningful commits on `main` | Periodic governance audit; catches drift early |
| Before friendly pilot / beta promotion (Stage 0.5) | Section 22.5 pre-real-client-data checklist deserves independent verification |
| Before paid-client onboarding (Stage 1+) | Section 22.6 pre-paid-client checklist deserves independent verification |
| When Claude proposes to change MASTER, AGENTS, schema, auth, tenant isolation, paywall, audit, or deployment controls | Anything that touches the constitution or production-shape concerns |

**Rules for how Claude treats ChatGPT review:**

- Treat as control input, not implementation approval.
- Pankaj's explicit go-ahead in chat is still required for any execution. ChatGPT thumbs-up does not authorise execution.
- If ChatGPT identifies contradictions, Claude must resolve or seek approval before proceeding. Surface the contradiction with quoted text, propose a fix in MCQ form, wait for Pankaj's selection.
- Disagreement is allowed. If Claude believes ChatGPT is wrong, say so with reasoning. Do not capitulate to the second opinion; do not dismiss it either.

### 24.7 Section 14 non-impact

This protocol does NOT reorder, weaken, delay, or override Section 14. The locked execution sequence remains: Step 3D Tasks → 3E Team → 3F Modules → Step 4 Auth + RBAC → Step 5 Persistence cutover. The pre-commit consistency check adds approximately 30 seconds to each governance commit and catches drift before it ships. 3D will be the first execution wave run under this protocol.

## 25. External Threat Security & Platform Hardening Guardrails

Minimum external-threat security and platform-hardening guardrails that PracticeIQ must follow from Section 14 Step 3D onward, especially before Step 4 Auth / RBAC, Step 5 Persistence cutover, friendly pilot, and real client data. Includes a CA / CPA client-trust and failure-scenario lens (25.12), a G9 cost-discipline matrix (25.11), a Platform Ownership Register status clarification (25.13), and a consumption rule (25.14). Adopted per D-2026-05-03-05. Does NOT reorder Section 14.

### 25.1 Current security posture

**What is already protected:**

- Every new route returns 401 by design (`requireSession()` is null until Step 4)
- Tenant isolation enforced at the route layer (`where: { firmId: session.firmId }`)
- Permission matrix codified at `src/lib/permissions.ts` with context-aware rules (`isCreator` / `isReviewer` / `isOwnTask`)
- Cross-firm hits return 404 — no existence leakage
- Zod validation on all inputs
- Generic 500 messages on existing catch paths
- Three security headers shipped via `netlify.toml`: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`
- Service-role key on Netlify env, server-only (not in client bundle)
- HTTPS via Netlify default (TLS 1.3)

**What is only planned:**

- Supabase Auth replacing hardcoded SHA-256 digest (Step 4)
- `requireSession()` wired to real session (Step 4)
- `writeActivityLog()` made real (Step 4)
- RLS policies on tenant-scoped tables (Section 22.5 pre-real-client-data)
- Allowed-domain enforcement (Step 4)
- Audited Platform Owner impersonation (Step 4)

**What remains unsafe for real external users:**

- Hardcoded Platform Owner SHA-256 password digest in client bundle (Risk #5)
- localStorage as UI source of truth (Risk #3)
- No RLS — defence-in-depth missing (Risk #10)
- No audit trail writes — `writeActivityLog()` no-op (Risk #8)
- No Content Security Policy (CSP) header
- No request rate limiting
- No failed-auth monitoring
- No incident log

**Why locked-by-default 401 is correct until Step 4.** The 401 contract is the safety floor. Every route returns 401 today regardless of payload because `requireSession()` returns null and `requireAuth()` short-circuits before any DB read. There is no path through which untrusted user input reaches Prisma queries. When Step 4 wires real auth, the same routes light up with the permission and tenant checks already in place.

### 25.2 External attacker model

| Actor | Vector | Today's exposure | Post-Step 4 mitigation |
|-------|--------|------------------|------------------------|
| Unauthenticated internet user | Direct API calls | Blocked by 401 | Auth-gated; RLS as defence in depth |
| Authenticated firm user → other firm's data | Cross-firm IDs in payloads | App-layer `firmId` filter | App + RLS |
| Lower-role user → higher-role action | Skip UI, hit API directly | `requirePermission` server-side | Same |
| Malicious insider at firm | Legitimate access used to harm | ActivityLog (post-Step 4) + permission matrix | Same + audit review cadence |
| Compromised account | Stolen credentials | Strong password reqs (Supabase) | + MFA at paid launch |
| Bot / API abuse | Scraping, brute force | Netlify default DDoS | + rate limits at friendly pilot (see 25.11) |
| Future file-upload attacker | Malware, malformed files, path traversal | N/A — Section 21.2 pre-conditions | When CP unlocks |
| AI / Writing Assist data exposure | Sensitive data in prompts | N/A — Section 23.9 deferred | When WA unlocks |

### 25.3 OWASP-style risk coverage

| OWASP | PracticeIQ posture | Required action |
|-------|--------------------|-----------------|
| A01 Broken Access Control | Tenant filter + permission matrix + cross-firm 404 + ARTICLE_STAFF own-actor scope | Continue patterns in 3D; RLS pre-real-client-data |
| A02 Cryptographic Failures | Hardcoded SHA-256 (Risk #5); HTTPS via Netlify | Step 4 brings Supabase Auth |
| A03 Injection | All DB access via Prisma (parameterized); Zod validation; no raw SQL | Continue Prisma-only; lock "no `$queryRaw` / `$executeRaw` without explicit approval" |
| A04 Insecure Design | Locked-by-default 401; Section 23 pre-locked operating model; G7 / G8 / G9 protocols | Continue Plan-First; security review per route group |
| A05 Security Misconfiguration | 3 security headers shipped; service-role key server-only | Add CSP + Permissions-Policy before friendly pilot; verify HSTS |
| A06 Vulnerable / Outdated Components | Next.js 16, React 19, Prisma 6.19, Zod | `npm audit` policy; Dependabot at Stage 0.5 (free) |
| A07 Authentication Failures | Hardcoded SHA-256; no MFA; no password reset | Step 4 brings Supabase Auth; MFA at paid launch (free in Supabase) |
| A08 Software / Data Integrity Failures | Netlify auto-deploy from GitHub `main`; no SRI; no CI signing | Branch protection on `main` at paid launch (free); SRI when external CDN |
| A09 Security Logging / Monitoring Failures | ActivityLog table exists but writes are no-op; no security event log; Netlify and Supabase default logs only | Step 4 lights up writes; failed-auth monitoring + incident log before friendly pilot (free) |
| A10 SSRF | No outbound HTTP from PracticeIQ today | When integration phase (Phase 5) ships, allowlist external hosts; no internal IPs |

### 25.4 Security rules for all API routes from 3D onward

Permanent route-construction checklist:

1. `requireAuth()` is the first non-DB-availability gate; nothing executes before it
2. Server-side `requirePermission` check; never trust UI gating
3. Tenant filter (`where.firmId = session.firmId`) on every read and write
4. Cross-firm ID validation for every referenced ID; return **404** on mismatch (no existence leak)
5. **400** only for missing firm context (`session.firmId == null`)
6. **422** for Zod validation errors with `issues` in `details`
7. No PLATFORM_OWNER all-firm access without audited impersonation flow
8. Zod validation on every input — body, query params, route params
9. Maximum length on every user text field (25.5 specifies 3D values)
10. No raw SQL via Prisma (`$queryRaw` / `$executeRaw`) without explicit per-action approval
11. No secrets in responses or logs (no env vars, no internal IDs of other firms, no PII in error messages)
12. Generic **500** messages: `"Unable to <verb> <entity>."` — never include `error.message` or stack
13. No stack traces or internal error details in API responses
14. `try / catch` around every Prisma call; map to 500 with generic message; `console.error` server-side
15. Cross-firm 404 attempts logged via `console.warn` server-side (cheap, no schema impact)

### 25.5 Task-route-specific security requirements for 3D

- `taskId` belongs to `session.firmId` on every endpoint
- `clientId` belongs to firm AND is `ACTIVE` on POST
- `reviewerId` belongs to firm AND is an active `FirmMember` on POST and reviewer-change PATCH
- Every `assigneeId` belongs to firm AND is an active `FirmMember` on POST and assignee mutation
- ARTICLE_STAFF cannot reassign / close / cancel; can only act on own tasks for status moves to `UNDER_REVIEW`
- Task edit by PARTNER / MANAGER requires `isCreator` OR `isReviewer` context computed server-side
- Task close and task reopen require `isReviewer` context for PARTNER / MANAGER (FIRM_ADMIN always; ARTICLE_STAFF never; assignees and creators cannot self-close per Section 23.3)
- Task cancel follows the approved lifecycle matrix: FIRM_ADMIN always; PARTNER always; MANAGER only if `isCreator` context; ARTICLE_STAFF never (even when creator, per Section 23.5)
- Status transitions strictly use `TASK_STATUS_TRANSITIONS` map from `src/lib/task-constants.ts` (created during 3D)
- close / reopen / cancel use dedicated POST endpoints (not PATCH discriminator)
- Length caps locked in `task-constants.ts`: title 200; description 4000; notes / remarks / reasons 4000; assignees per task max 50; pagination max 200 (Decision G in 3D plan)
- Zod `.strict()` on all POST and PATCH body schemas (rejects unknown fields with 422 — Decision H in 3D plan)
- ActivityLog `metadataJson` for free-text reasons stores `noteId` reference rather than the reason text (Decision I in 3D plan; reason text lives on the firm-scoped `TaskNote` row)
- All user text stored as plain `String`; UI rendering must never use `dangerouslySetInnerHTML`; Next.js JSX escapes by default
- Task list filters use exact match where possible; no LIKE wildcards over user input that could enable timing-based inference

### 25.6 Step 4 security requirements

- Supabase Auth replaces hardcoded SHA-256 digest (removes Risk #5)
- `requireSession()` wired to real Supabase session — routes light up
- Origin firm / tenant routes (5 routes from cloud Codex) hardened onto `requireAuth` (per D-2026-04-30-15 Decision 5)
- Service-role key strictly server-only — never in `NEXT_PUBLIC_*` env, never in client bundle
- Session-to-FirmMember resolution: `session.user.id → FirmMember(userId, firmId, firmRole)` lookup populates `SessionUser`
- Allowed-domain enforcement at API layer (per D-2026-04-30-10)
- Audited Platform Owner impersonation: separate flow that writes ActivityLog `CROSS_FIRM_IMPERSONATE` with target firmId
- `writeActivityLog()` made real — lights up 3B / 3C / 3D / 3E / 3F call sites
- Failed auth attempts logged — hooks for rate-limit triggers and suspicious-pattern detection

### 25.7 Database and RLS requirements

- **RLS REQUIRED before real client data** (Section 22.5)
- All tenant-scoped tables get policies: `Firm`, `FirmMember`, `Client`, `Task`, `TaskAssignee`, `TaskNote`, `ActivityLog`, `Plan`, `FirmSubscription`, `FirmModuleAccess`, `AllowedFirmDomain` (when added)
- App-level `firmId` checks remain even after RLS — defence in depth
- Service-role key bypasses RLS; usage controlled (server-only; audit any use; document why)
- No production database reset (G6 holds)
- No destructive ops without explicit per-action approval (G6 holds)
- Backup / restore per Section 22.4 trigger points (see 25.11 four-row treatment)

### 25.8 Platform / config hardening

| Layer | Today | Required | Cost |
|-------|-------|----------|------|
| Security headers | X-Frame-Options DENY; X-Content-Type-Options nosniff; Referrer-Policy strict-origin-when-cross-origin (in `netlify.toml`) | Add CSP (default-src 'self' starting point) before friendly pilot; add Permissions-Policy; verify HSTS | Free — `netlify.toml` config |
| HTTPS / TLS | Netlify default TLS 1.3 | Confirm HSTS header before friendly pilot | Free — Netlify default |
| Env vars | Five Netlify env vars set | Service-role key server-only; verify no `NEXT_PUBLIC_*` carries secrets | Free |
| Secrets in Git | `.env.local` gitignored | Lock: never in markdown docs, chat, screenshots, or logs | Free — discipline |
| Dependency audit | None | `npm audit` policy + Dependabot | Free — see 25.11 |
| Branch protection | None | Require PR reviews on `main` | Free — see 25.11 |
| Admin access | Single founder | Least-privilege as product matures (per Section 22) | Free — discipline |

### 25.9 Monitoring and incident response

- **Failed auth monitoring**: Supabase default + custom log when Step 4 lands (free)
- **API error monitoring**: Netlify function logs (free); upgrade trigger in 25.11
- **Suspicious cross-firm access attempts**: log every 404 from cross-firm ID mismatch via `console.warn` (free; no schema)
- **ActivityLog review cadence**: weekly post-Step 4; daily at scale (free — manual SQL queries)
- **Incident log**: simple markdown file at `02_App/tos-app/INCIDENT_LOG.md` once Stage 0.5 (free)
- **Backup / restore**: linked to Section 22.4 trigger points (see 25.11 four-row treatment); restore drill mandatory before friendly pilot
- **Severity classification**: P0 = data loss / breach; P1 = mass auth failure / data exposure; P2 = single-firm error storm; P3 = individual user error (free — markdown convention)

### 25.10 Future module security

- **Client Portal + Document Upload**: governed by Section 21.2 (11 pre-conditions). No bypass.
- **Writing Assist / AI**: governed by Section 23.9 (PII scrub, no client-name embedding, audit every call, per-firm opt-in, usage caps, no document/file processing)
- **Payment / paywall**: future only; PCI-DSS considerations when card data flows; never store card data ourselves (provider-hosted forms)
- **Integrations / outbound webhooks**: future only; SSRF defence (allowlisted hosts, no internal IPs, no metadata endpoints)

### 25.11 Cost-discipline matrix under G9

Per AGENTS G9 + Section 22.9, every spend-touching security item enumerated with the four-row template (Free / built-in / open-source option · Paid option · Recommendation · Trigger point for upgrade). Vendor names are examples only; not locked vendor decisions. Prices, free-tier limits, and quotas are NOT hardcoded — verify from official vendor sources at decision time.

**25.11.1 Database backup / PITR**
- Free / built-in / open-source: Manual `pg_dump` to free object storage (Supabase Storage or equivalent) on a daily schedule. Restore tested at least once before friendly pilot.
- Paid: Supabase Pro PITR (or equivalent managed Postgres provider's PITR feature).
- Recommendation: `pg_dump` + free object storage through Stage 0.5; managed PITR at first paying firm.
- Trigger: First paying firm (Section 22.4) OR pilot data sensitivity that requires sub-day RPO.

**25.11.2 Application error monitoring**
- Free / built-in / open-source: Netlify function logs + `console.error` server-side; Supabase log explorer for DB errors.
- Paid: Sentry / similar (typically tiered by event volume).
- Recommendation: Netlify + Supabase default logs through friendly pilot.
- Trigger: 3 active firms OR first reported user-facing incident that default logs failed to surface in time.

**25.11.3 Log aggregation / SIEM**
- Free / built-in / open-source: Netlify + Supabase native log views; `INCIDENT_LOG.md` for cross-system correlation.
- Paid: Datadog / similar SIEM.
- Recommendation: Defer entirely. Stage 0 / 0.5 / Stage 1+ to ~5 paying firms can run on native log views.
- Trigger: 5 paying firms with multi-incident frequency that manual correlation cannot keep up with.

**25.11.4 Rate limiting / WAF**
- Free / built-in / open-source: Netlify default DDoS protection. Optionally evaluate a free DNS / WAF / rate-limit option such as Cloudflare free tier or equivalent before friendly pilot. Verify current free-tier capabilities from official vendor sources at decision time.
- Paid: Cloudflare Pro / Business; AWS WAF; Netlify enterprise; etc.
- Recommendation: Before friendly pilot, evaluate a free DNS / WAF / rate-limit layer in front of the live URL. **Note**: fronting Netlify with such a service typically requires a custom domain (e.g., `app.practiceiq.in`) — it generally cannot be applied to the `netlify.app` subdomain. If a custom domain is not yet set up, this evaluation pairs with the Section 22.4 "Company-owned custom domain (Pre Stage-0.5)" trigger.
- Trigger (paid): sustained attack pattern that the chosen free-tier option cannot mitigate, OR first paying firm requesting WAF SLA.

**25.11.5 Secret scanning**
- Free / built-in / open-source: GitHub default secret scanning; `git-secrets` pre-commit hook (open-source).
- Paid: GitGuardian / similar commercial scanner.
- Recommendation: Enable GitHub default secret scanning now (free toggle); add `git-secrets` pre-commit hook before Stage 0.5.
- Trigger: First leaked secret incident OR multi-developer team with frequent commits.

**25.11.6 Penetration testing**
- Free / built-in / open-source: Self-test using OWASP ZAP (open-source) before friendly pilot.
- Paid: Third-party pen test (typically one-time engagement).
- Recommendation: Self-test with ZAP before friendly pilot. Defer paid pen test until paid launch.
- Trigger: First paying firm requiring formal pen test report; OR regulatory requirement.

**25.11.7 SSO / SAML enterprise auth**
- Free / built-in / open-source: Supabase Auth email + password; free OAuth providers (Google, GitHub, etc.) included with Supabase Auth.
- Paid: Supabase Pro (or higher) for SAML SSO; WorkOS / similar.
- Recommendation: Email + password through Step 4. Add free OAuth providers at Stage 0.5 if pilot firms want them. Defer SAML.
- Trigger: First paying firm with > 20 users requiring SAML / SSO.

**25.11.8 Email transactional sending (security notifications)**
- Free / built-in / open-source: Supabase Auth's built-in email (password reset, magic link, confirm email) at no extra cost on Supabase free tier (with rate limits). Default Supabase sender domain is acceptable for Stage 0 development.
- Paid: Provider paid tier (Resend / SES / Postmark / similar) with custom sender domain.
- Recommendation: Supabase built-in through Step 4 + internal testing. Move to paid provider with custom sender domain BEFORE friendly pilot — pilot users should not receive reset emails from a Supabase-default domain.
- Trigger: Friendly pilot invitation goes out (so password resets arrive from a branded sender). The earliest paid item.

**25.11.9 Uptime monitoring**
- Free / built-in / open-source: A free uptime monitor such as UptimeRobot or equivalent. Verify current free-tier interval and monitor count from official vendor sources at decision time.
- Paid: Pingdom / Better Uptime / similar paid tier.
- Recommendation: Set up a free uptime monitor before friendly pilot.
- Trigger: SLA commitments to paying firms that require sub-minute monitoring.

**25.11.10 Vulnerability scanning beyond `npm audit`**
- Free / built-in / open-source: `npm audit` in CI / locally; GitHub Dependabot alerts; OSV-Scanner (open-source).
- Paid: Snyk / similar commercial scanner.
- Recommendation: Stay on `npm audit` + Dependabot through paid launch.
- Trigger: Multi-language stack OR audit / compliance requirement (SOC2 / ISO27001) that requires Snyk-class evidence.

**Net new Stage 0 spend from this section: zero.** First paid item triggers at friendly pilot (25.11.8 transactional email). All other paid items deferred to first paying firm or later.

### 25.12 CA / CPA Client Trust & Failure Scenario Risk Lens

Reviews PracticeIQ from the perspective of a CA / CPA firm client, not only from a technical-security perspective. Reinforces and operationalises existing controls in Sections 21.2, 22, 23, 24.

**25.12.A Top 12 CA / CPA client concerns**

| # | Client question | Current coverage | Gap | Action | Timing |
|---|-----------------|------------------|-----|--------|--------|
| 1 | "Is our firm's confidential data really kept private?" | Tenant filter; cross-firm 404; permission matrix; 401-by-default | RLS not configured; ActivityLog writes deferred | RLS policies; `writeActivityLog()` made real | Step 4 + before Step 5 |
| 2 | "Can another CA firm see our data, even by accident?" | App-layer `firmId` filter | Defence-in-depth (RLS) missing | RLS policies; service-role key usage controlled and audited | Before Step 5 / before friendly pilot |
| 3 | "Are our end-clients' personal data (PAN, GSTIN, mobile, email) protected?" | Schema enforces plain string fields; HTTPS in transit | No field-level encryption; no PII redaction in logs / AI prompts | PII handling guardrails per Section 23.9; field-level review before document upload (21.2) | Before friendly pilot + Section 21.2 / 23.9 enforcement when modules unlock |
| 4 | "Whose data is it — ours or yours?" | No T&C published yet | Data ownership clause missing | T&C + DPA: firm owns data; PracticeIQ is processor | Before paying clients (Section 22.6) |
| 5 | "If we leave, can we take all our data in a usable format?" | Section 22.6 lists "Data export endpoint operational" | Endpoint not built | One-time export endpoint (downloadable structured bundle) | Before paying clients (Section 22.6) |
| 6 | "Can we prove who did what when?" | ActivityLog table + canonical actions in Section 23.6 | `writeActivityLog()` no-op until Step 4 | Step 4 lights up writes | Step 4 |
| 7 | "Can we control which staff member sees / does what?" | Section 10 permission matrix at `permissions.ts`; 4 firm roles + Platform Owner | UI gating only; API enforcement comes with Step 4 | Step 4 wires real session into existing `requireAuth` | Step 4 |
| 8 | "What happens if PracticeIQ is down on a tax-filing deadline?" | Netlify + Supabase default uptime | No SLA, no status page, no uptime monitoring | Free uptime monitor (25.11.9); `INCIDENT_LOG.md`; severity classification | Before friendly pilot |
| 9 | "If our data is lost, can you restore it from backup?" | Supabase manages base storage redundancy | No PITR; no tested restore drill | Manual `pg_dump` to free object storage + tested restore drill (25.11.1) | Before friendly pilot (free path); first paying firm (managed PITR) |
| 10 | "Will our client data ever be sent to AI providers?" | Section 19 principles; Section 23.9 Writing Assist guardrails | Writing Assist deferred; no current AI calls happen | Section 23.9 PII scrub + per-firm opt-in + audit when feature unlocks | When `WRITING_ASSIST` ships (Phase 4 / 5) |
| 11 | "If we upload a signed engagement letter, who else sees it?" | Section 21.2 (11 pre-conditions) | Document Upload deferred; no current upload path | Section 21.2 pre-conditions all met before Document Upload ships | When CP / Document Upload module unlocks |
| 12 | "Are you legally compliant for India? DPDP? Professional secrecy?" | Section 22.5 names DPDP applicability assessment; 22.6 names DPA template | Compliance posture open (Risk #6) | DPDP Act applicability assessed; audit retention period decided; T&C + DPA published | Before friendly pilot (assessment); before paying clients (DPA) |

**25.12.B Top 10 failure scenarios**

| # | What could go wrong | Impact | Current control | Missing control | Stage when fixed |
|---|---------------------|--------|-----------------|-----------------|------------------|
| 1 | Cross-firm data leakage — query forgets `firmId` filter | Catastrophic; privacy breach, regulator notification, client trust collapse | App-layer filter; cross-firm 404 pattern; code review per route | RLS; automated test for `firmId` enforcement | Before Step 5 (RLS) + 3D / 3E / 3F (pattern discipline) |
| 2 | Hardcoded login used by external users — SHA-256 digest reverse-engineered | Total platform compromise | None today | Removal in Step 4 when Supabase Auth lands (Risk #5) | Step 4 (mandatory before any external pilot) |
| 3 | Real data entered before Step 5 Persistence — friendly pilot user types real client data into localStorage UI | Permanent data loss for the firm; reputational damage | UI uses localStorage (Risk #3); 401-by-default APIs prevent persistence | Hard rule that no friendly pilot starts until Step 5 closes (Section 22.5) | Before friendly pilot (Section 22.5 enforcement) |
| 4 | Accidental deletion / cancellation without audit | Operational frustration; possible client complaint; cannot reconstruct | Cancel is terminal but requires non-empty reason note (Section 23.3); Section 23.6 audit taxonomy | `writeActivityLog()` no-op until Step 4; Decision I metadataJson policy | Step 4 (audit lights up) + Decision I |
| 5 | Unauthorized staff action — ARTICLE_STAFF hits PATCH directly to close someone else's task | Workflow integrity broken | Section 10 permission matrix; `permissions.ts` enforces `TASK_CLOSE` requires `isReviewer` | Step 4 wires real session so existing checks fire | Step 4 (existing checks light up) |
| 6 | Sensitive document upload too early — Document Upload turns on before Section 21.2 pre-conditions | Confidentiality breach; possible regulator action | Section 21.2 lists 11 mandatory pre-conditions; module flag OFF by default | None — gating already exists | Locked at Section 21.2; will not unlock until all 11 met |
| 7 | Backup exists but restore untested — `pg_dump` runs nightly but `pg_restore` never attempted | Permanent data loss; client trust collapse | None today | Quarterly restore drill from real backup to scratch DB; documented in `INCIDENT_LOG.md` | Before friendly pilot (25.11.1 explicitly names "restore tested at least once") |
| 8 | Personal account ownership failure — Pankaj loses access to GitHub / Netlify / Supabase | Total continuity failure; pilot firms abandoned | Personal accounts noted in Section 22.2 as Stage 0 acceptable; Platform Ownership Register template at 22.7 | Recovery codes documented; emergency access owner named; Register populated | Before friendly pilot — see 25.13 |
| 9 | AI / Writing Assist leaks client context | Confidentiality breach across multiple firms simultaneously | Section 23.9 guardrails; module flag `WRITING_ASSIST` OFF by default | Feature not built yet | Locked at Section 23.9; will not unlock until guardrails implemented and tested |
| 10 | Inability to export / delete client data — paying firm requests data export OR right to be forgotten | Regulatory non-compliance (DPDP); contract breach; public complaint | Section 22.6 names export and deletion paths as pre-paid-client requirements | Endpoints not built yet | Before paying clients (Section 22.6) |

**25.12.C Comparison with existing plan**

| Concern / scenario domain | Section 21.2 | Section 22 | Section 23 | Section 24 | CURRENT_STATUS |
|---------------------------|--------------|------------|------------|------------|----------------|
| Confidentiality / tenant isolation | covers Document Upload only | 22.5 RLS pre-real-client-data | route-layer `firmId` codified | catches drift | Risk #10 named |
| Data ownership / export / deletion | n/a | 22.6 names all three | n/a | n/a | not in Repo Health bullet |
| Audit trail | n/a | n/a | 23.6 taxonomy locked | n/a | Risk #8 named |
| User access control | n/a | n/a | 23.5 cross-firm ID + permission | n/a | Section 10 referenced |
| Reliability / downtime | n/a | 22.4 paid plan triggers | n/a | n/a | none |
| Backup / restore | n/a | 22.4 PITR trigger; 22.5 backup confirmation | n/a | n/a | Risk #11 named |
| AI / Writing Assist | n/a | n/a | 23.9 guardrails | n/a | none |
| Document upload | 11 pre-conditions | n/a | n/a | n/a | none |
| Legal / compliance | n/a | 22.5 DPDP; 22.6 DPA | n/a | n/a | Risk #6 named |
| Personal account failure | n/a | 22.7 register template | n/a | n/a | covered by 25.13 |

**25.12.D Required additions (folded into Section 25 / cross-references)**

The lens does not introduce wholly new categories. It produces these explicit Section 25 guardrails (folded inline above):

- Restore drill before friendly pilot (25.9 + 25.11.1)
- Platform Ownership Register populated before friendly pilot (25.13)
- Data export + deletion endpoints operational before paying clients (cross-reference to Section 22.6)
- Quarterly restore drill cadence post first paying firm (25.9 cadence)

All four are operational discipline — zero new spend.

### 25.13 Platform Ownership Register status (clarification)

The Platform Ownership Register template lives in Section 22.7. Its **population** is governed as follows:

- **Population remains deferred during Stage 0.** This was approved as Option A in D-2026-05-03-01 to let the Pilot-to-SaaS Scaling Guardrails framework land without forcing the founder to dictate account emails, recovery methods, and billing owner immediately.
- **Population becomes mandatory before friendly pilot / Stage 0.5.** The CA / CPA client-trust lens (25.12 Failure #8) shows why: a personal-account ownership failure at Stage 0.5 with real pilot users abandons those pilots indefinitely. Continuity requires the register be populated and the recovery paths documented before any external user is invited.

**This is not a contradiction of Section 22.7.** Section 22.7 states the population is deferred without specifying the trigger to populate. Section 25.13 names the trigger: friendly pilot / Stage 0.5. The two sections work together — Stage 0 keeps the Register as a template; Stage 0.5 promotion is blocked until the Register is populated and recovery is documented.

### 25.14 Section 25 consumption rule (and non-impact)

**Consumption rule:**

- Section 25 must be consumed by future API and entity route planning **alongside Section 23**.
- Section 14 Step 3D Tasks, Step 3E Team, Step 3F Modules, Step 4 Auth + RBAC, and Step 5 Persistence cutover plans must consider Section 25 security guardrails where relevant.
- AGENTS G7 already requires the agent to consume canonical sections before route plans. **D-2026-05-03-05 extends G7's effective scope to include Section 25** alongside Section 23. No new AGENTS G10 is required.
- Where a route group plan touches a Section 25 guardrail (auth, tenant isolation, cross-firm IDs, audit, paywall entitlement, error handling, length caps, monitoring, backup), the plan turn must cite the relevant 25.x subsection as the source of its constraint. Conflicts surface as MCQs requiring explicit Pankaj approval.

**Section 14 non-impact:**

This section does NOT reorder, weaken, delay, or override Section 14. The locked execution sequence remains: Step 3D Tasks → 3E Team → 3F Modules → Step 4 Auth + RBAC → Step 5 Persistence cutover. 3D will be the first execution wave run with Section 25 as canonical reference alongside Section 23.

## 26. Current Launch-Control State / TAMS Pilot Readiness

Alignment snapshot recorded 2026-06-12 per C-2026-06-12-03 (documentation-only; runtime/source unchanged at `5a9194a`; prior repo/doc HEAD `e3fdf94`). This section consolidates the current launch-control posture so nothing is missed; it does not reorder Section 14 and does not change any runtime behaviour.

### 26.1 Completed and closed
- **Section 14 Step 5B-final: CLOSED** — no localStorage source-of-truth remains; all app state is server-backed.
- **W1–W5 controlled-write core-live regression: CLOSED** (W1 client / W2 task-create / W3A status+cancel / W3B close+reopen via approved scoped status-seed / W4A notes / W5 team-writes all PASS; W4 assignee-swap + reviewer-change deferred — controls live only in the F3-parked Assignments/Project Review views).
- **TAMS firm-identity correction: CLOSED** (C-2026-06-12-01) — `firm_primary` is now `TAMS & CO LLP` / `tams.co.in` via the authenticated audited `PATCH /api/firms/[firmId]` route (one real `FIRM_UPDATE` audit row; no raw DB UPDATE).
- **Final controlled smoke (TAMS pilot-readiness viewing): PASS / CLOSED** (C-2026-06-12-02) — read-only.
- **Overnight phased UAT (UAT-0 / UAT-1 / UAT-2): PASS** (2026-06-12) — see 26.4.
- **Active workspace identity:** `TAMS & CO LLP` / `tams.co.in`. Gmail Platform Owner (`pu_owner` / `singhal.accuron@gmail.com`) remains the control/admin login, intact.

### 26.2 Current live baseline (post-UAT cleanup)
Firm count 1; active firm `firm_primary` (`TAMS & CO LLP` / `tams.co.in` / Mumbai / ACTIVE / planId null); Client 0; Task 0; FirmMember 1; PlatformUser 1; TaskNote 0; TaskAssignee 0; no live `ZZ_TEST_PL_*` (or other `ZZ_*`) residue after UAT cleanup. Historical `ActivityLog` rows (total 18 as of this snapshot) are **retained as internal pre-pilot validation evidence** from the 5B cutover UAT waves plus the one `FIRM_UPDATE` — they are log-only, with no live data behind them, and are not to be deleted casually (see 26.9 / 26.10).

### 26.3 UAT policy (phased, not a single final event)
UAT is not one final event. The standing model is phased:
- **UAT-0** — read-only spine (identity, signed-out 401 matrix, dashboard no-flash, section reads, localStorage, console).
- **UAT-1** — core write flow (client create → task create → note → status moves → cancel).
- **UAT-2** — team writes (add → role change → deactivate → reactivate).
- **mini-UAT** — a focused re-verification after each newly approved feature (e.g., Practice Intelligence v0).
- **final full UAT** — a complete pass after code freeze, before launch.

Write-based UAT touches the **live Supabase DB even from localhost** (localhost and production share the same Supabase Postgres). Therefore every write-based UAT must use **labelled data, captured IDs, exact-count FK-safe cleanup, and post-cleanup baseline proof**, and must clean only the current slice's own rows (by captured entity IDs) — never historical/non-slice rows. Git hygiene: no `git add .` / `git add -A`; stage only explicitly named files.

### 26.4 Overnight UAT result (2026-06-12)
- **UAT-0: PASS** — baseline pristine; signed-in `/api/me` + UI all TAMS; signed-out `/api/{me,clients,tasks,team,modules,activity}` all 401; localStorage absent; console clean; all traffic GET-only.
- **UAT-1: PASS** — `ZZ_TEST_PL_CLIENT` + `ZZ_TEST_PL_MGR` + `ZZ_TEST_PL_TASK` + note `ZZ_TEST_PL_NOTE`; lifecycle Open → In Progress → Pending Client → Cancel; 7 slice audit rows (CLIENT_CREATE, TEAM_MEMBER_ADD, TASK_CREATE, TASK_NOTE_ADD, TASK_STATUS_CHANGE ×2, TASK_CANCEL); 4 notes; one mutation + refetch per action; scoped cleanup; baseline restored.
- **UAT-2: PASS** — `ZZ_TEST_PL_TEAM_MGR`; add → role change Manager→Partner (set deterministically via element ref + form_input, exactly one PATCH) → deactivate → reactivate; 4 audit rows; scoped cleanup; baseline restored.
- During UAT: **no password reset, no module toggle, no status seed, no Netlify/browser ops, no source/doc/git/deploy/production actions.** Pankaj / Gmail control identity untouched; firm identity TAMS intact; ActivityLog total returned to 18 after each cleanup (no historical rows touched).
- **Operational note (not a product bug):** the SPA's in-memory team/task list does not auto-refetch after a DB-side SQL cleanup; stale cards persist until a page reload, which resyncs to DB truth. This is a test-operations artifact of cleaning via SQL while the SPA holds state, not a defect.

### 26.5 Remaining UAT gaps (acknowledged; non-blocking for the slices already passed)
- **A8b Close/Reopen** under the fresh TAMS identity not re-run; optional, requires either an approved one-off scoped status-seed (no fake audit row) or a sign-in-capable non-admin assignee.
- **Password reset** re-run — optional, approval-gated (credential action; audit-only verification; no real inbox required for `@example.com`).
- **Module toggle** re-run — optional, approval-gated (touches firm `FirmModuleAccess` state).
- **Full RBAC matrix** — blocked until sign-in-capable non-owner users exist (single-owner check is partial only; do not claim full RBAC coverage).
- **TAMS-domain user mapping** — DONE 2026-06-14 (C-2026-06-14-02): mapping live + dual-login UAT PASS; see 26.6. (Note-chip / ActivityLog-actor verification PASS 2026-06-15 per C-2026-06-15-01; test scaffold removed by approved exact-ID cleanup, baseline restored, ActivityLog evidence row retained.)
- **Practice Intelligence v0 mini-UAT** — required only if/when v0 is implemented.

### 26.6 TAMS-domain user mapping decision (coexist model)
Accepted: **coexist, do not replace.** The Gmail Platform Owner remains the active control/admin login. `pankaj.singhal@tams.co.in` will later be added as a **pilot-facing TAMS Firm Admin** (firm member of `firm_primary`, firmRole FIRM_ADMIN, platformRole STANDARD) once the mailbox exists — via a Pankaj-created Supabase Auth user (invite/reset flow) plus the app's audited Team "Add User" path. Do not delete, disable, or replace the Gmail control login. Do not create or map the TAMS user until explicit approval. The two identities coexist cleanly (different emails → different PlatformUsers → each its own single active FirmMember; the "single active FirmMember" rule is per-user, and the firm `emailDomain` is display-only, not part of login/RBAC/team-create).

**EXECUTED 2026-06-14 (C-2026-06-14-02): TAMS app-side mapping is LIVE and dual-login UAT PASS.** Pankaj confirmed the `pankaj.singhal@tams.co.in` Supabase Auth user already existed (email-confirmed; previously orphaned at the app layer) and set a usable password via the Supabase reset/login flow. The app-layer mapping was then created by a **controlled DB seed** (approval-gated SELECT pre-check → transactional INSERT → post-check), not the audited Team "Add User" route — so **no `TEAM_MEMBER_ADD` ActivityLog row exists** for it (consistent with the original `pu_owner`/`fm_owner` baseline seed). Rows: `PlatformUser pu_tams_admin` (`Pankaj Singhal (TAMS)` / `pankaj.singhal@tams.co.in` / platformRole STANDARD / active; non-authenticating sentinel passwordHash) + `FirmMember fm_tams_admin` (`firm_primary` / firmRole FIRM_ADMIN / active). Gmail control login untouched (`pu_owner` PLATFORM_OWNER + `fm_owner` FIRM_ADMIN). Localhost dual-login `/api/me` UAT PASS (read-only, user-driven, no Chrome bridge): TAMS → STANDARD/FIRM_ADMIN/firm_primary; Gmail → PLATFORM_OWNER/FIRM_ADMIN/firm_primary; Team UI shows both Active Firm Admins. Note-chip / ActivityLog-actor verification: **PASS 2026-06-15 (C-2026-06-15-01)**. A labelled disposable `ZZ_TEST_*` client and task hosted the test; one note was added through the real TAMS app session (UI chip `Pankaj Singhal (TAMS)`; `TaskNote.authorId = ActivityLog.actorId = pu_tams_admin`; exactly one note + one `TASK_NOTE_ADD` row). The scaffold was then removed by approved exact-ID cleanup (TaskNote `cmqeorx0i00011ao8r6ar180z`, Task `zz_test_notechip_task_20260615`, Client `zz_test_notechip_client_20260615`; 0 TaskAssignee); ActivityLog evidence row `cmqeorx2q00031ao8rdbip14j` retained (no FK block); baseline restored to `firm_primary` Task 0 / Client 0 / TaskNote 0. Earlier 'view-only' impression root-caused to disabled workflow/lifecycle buttons (separate gating); no code fix needed for the note form. **TAMS identity is temporary**: keep active while useful for pilot / enhancement / reset-login / UAT cycles; retire later via a controlled deactivation gate (not immediately; not by deactivating the mailbox first).

### 26.7 RLS / security decision
RLS remains a **separate pre-pilot security wave** — not part of Step 5 and not started. First future step is a **read-only connection-role / RLS readiness investigation** (confirm `pg_class.relrowsecurity`, `pg_policies`, and the connection role Prisma uses). Key design question: the app talks to Postgres via Prisma on a pooled `DATABASE_URL` that likely **bypasses RLS** unless the DB session carries the user/firm context (Supabase JWT, `SET LOCAL`, or a constrained role) — this enforcement-model decision drives the whole wave. Current protection is route-layer tenant isolation (`requireAuth` + `firmId` filters + audited cross-firm helper); RLS is defence-in-depth required before real client data (Section 22.5). No policy implementation without separate approval; it is a real schema/migration wave.

### 26.8 Practice Intelligence / AI decision
- **Real LLM/AI assistant: DEFERRED** until backend / RBAC / tenant isolation / auditability / RLS / security are stable (consistent with Section 19 "Rules first, AI second").
- **Deterministic Practice Intelligence v0: IMPLEMENTED and LIVE in production at source/runtime commit `5835d37`** (reconciled per C-2026-06-14-01; previously recorded here as "accepted as plan-first only / not implemented"). The v0 scope is the deterministic, frontend-only feature set below: Dashboard Practice Intelligence Preview, Recommended next steps (guided checklist), Smart task templates (deterministic CA/CPA chips that prefill the title), Suggested status wording snippets (deterministic, inserted into the notes field, nothing sent externally), and intelligence-framed empty states. The exact shipped feature breakdown and its UAT were not captured in a controlled wave and are reconstructed from Pankaj's handoff, not independently re-verified in this gate. **Advanced AI/intelligence (live LLM/model inference, predictions, autonomous assistance) remains PARKED unless separately approved.**
- v0 must be **deterministic, frontend-only if built, no LLM, no external/model calls, no new data access (no RLS dependency), and must not overclaim**. If built, it ships behind a feature flag in a single controlled `page.tsx` wave with its own mini-UAT, plan-first → approval → build → read-only smoke.
- **Approved language:** "Practice Intelligence", "Smart suggestions", "Suggested updates", "Recommended next steps". **Forbidden language:** "AI predicts", "AI decides", "AI-generated", "autonomous assistant", or anything implying live model intelligence before it exists.

### 26.9 First-impression / adoption guidance
- The tool should feel **helpful, not surveillance**; use supportive language. Adoption depends on reducing typing, improving clarity, helping staff/articles write better status updates, and giving managers visibility without WhatsApp-chasing.
- **Empty states should guide users** (turn an empty TAMS workspace into guided onboarding).
- **Positioning:** PracticeIQ is the **product brand**; TAMS is the **configured pilot workspace**. Single-firm pilot now; multi-firm onboarding is roadmap.
- **Audit visibility:** historical `ActivityLog` rows must not be deleted casually; if a cleaner demo Activity Monitor is wanted, audit visibility/cleanup is a **separate governance decision** (see 26.10), not a default action.

### 26.10 Deferred / parked items
Multi-firm onboarding; real LLM/AI; billing; UI redesign; real Assignment backend (and `Task.assignmentId`); advanced people-control exposure (assignee-swap + reviewer-change UI, currently only in the parked Assignments/Project Review views); historical `ActivityLog` cleanup (governance-gated, separate plan-first approval required). None of these start without explicit approval.

### 26.11 Next recommended execution phases
1. **Phase 1** — doc-sync this master-plan alignment (C-2026-06-12-03).
2. **Phase 2** — decide whether to run the optional gated UAT items (A8b Close/Reopen, password-reset, module toggle).
3. **Phase 3** — decide whether to build the Practice Intelligence v0 controlled frontend wave.
4. **Phase 4** — TAMS-domain user mapping once the mailbox exists.
5. **Phase 5** — RLS readiness investigation (read-only first).
6. **Phase 6** — final code-freeze UAT before launch.
7. **Phase 7** — TAMS demo / pilot exposure.

## 27. PracticeIQ Observability & Product Analytics Layer (planned later wave)

Documented per C-2026-06-12-03 as a **planned later wave — not built before TAMS launch**. This section captures the decision and the shape of the future work; nothing here is implemented, and it does not change Section 14 or any runtime behaviour.

### 27.1 Current state
- PracticeIQ already has **`ActivityLog`** for business/audit events, supporting auditability and operational traceability.
- It captures events such as: client create; task create / status change / cancel / close / reopen; task notes; team add / role change / password reset / deactivate / reactivate; firm update; and module access change.
- The **Activity Monitor** displays the server-side activity history.

### 27.2 Gap
`ActivityLog` is **not** a full product-analytics or observability system. It does not fully track user journeys, screen visits, feature adoption, drop-offs, failed form attempts, frontend errors, API latency trends, abandoned actions, or issue-reproduction trails.

### 27.3 Decision
- **Do not build full product analytics before TAMS launch.** Add it as a planned later wave.
- During the initial TAMS pilot, use **existing `ActivityLog` + manual issue tracking**.
- Build proper observability / product analytics only **after** launch stability and security priorities (notably RLS) are under control.

### 27.4 Future planned wave
- **Name:** `PracticeIQ Observability & Product Analytics Layer`.
- **Purpose:** debug issues faster; identify user drop-offs; track adoption; separate training issues from product bugs; support future Practice Intelligence.
- **Suggested phased approach:**
  - **Phase 0** — document metrics; use `ActivityLog` + a manual issue log.
  - **Phase 1** — lightweight app telemetry / event capture.
  - **Phase 2** — product-analytics dashboard.
  - **Phase 3** — AI-assisted issue diagnosis and usage intelligence (subject to the Section 19 / 26.8 AI deferral until the security spine is stable).

### 27.5 Future telemetry categories
Login/session events; page/screen views; modal opened / submitted / abandoned; validation errors; API failures; frontend runtime errors; feature usage; task-update frequency; user adoption by role; slow endpoints / page loads; support / bug-report events.

### 27.6 Privacy / security guardrails
No passwords; no tokens; no reset links; no secrets; no full client-sensitive text; no unnecessary PII. Acceptable fields: `firmId`, `userId`, `action`, `timestamp`, event type. Metadata must be **minimal and structured** (consistent with the existing `writeActivityLog` field-names-only / `targetEmailDomain`-only discipline). Telemetry remains tenant-scoped and must not weaken Section 25 guardrails or the RLS posture (26.7).

### 27.7 Product principle
Observability is for **product improvement and support, not employee surveillance.** Staff should feel **helped, not watched.** User-facing language stays supportive (aligned with 26.9).

### 27.8 Additional platform principles now locked
- **Adoption before enforcement.**
- **Intelligence without overclaiming.**
- **Server data as the source of truth.**
- **Tenant isolation and RBAC before multi-firm scaling.**
- **`ActivityLog` audit retained; historical cleanup is governance-gated.**
- **PracticeIQ remains the product brand; TAMS is the first configured pilot workspace.**
- **Real LLM/AI, full product analytics, multi-firm onboarding, billing, and UI redesign remain phased/deferred unless separately approved.**
