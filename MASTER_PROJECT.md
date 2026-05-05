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
3. **API layer scaffold** - **PARTIALLY DONE**. Cloud Codex shipped 5 origin API routes: `src/app/api/firms/`, `src/app/api/firms/[firmId]/`, `src/app/api/firms/[firmId]/access/`, `src/app/api/firms/[firmId]/members/`, `src/app/api/tenant/validate/`. Sub-step 3A (permissions map + API helper foundation, commit `093a816`), 3B (clients routes + soft-delete, commit `d1fad2f`), 3C (activity read route, commit `7e62c99`), 3D-1 (Tasks foundation + read/create routes, C-2026-05-04-01 / D-2026-05-04-01, commit `8754760`), 3D-2 (Tasks mutations: PATCH + notes + assignees, C-2026-05-04-03 / D-2026-05-04-02, commit `13d8b4f`), 3D-3 (Tasks lifecycle actions: close + reopen + cancel, C-2026-05-04-05 / D-2026-05-04-03, commit `8bcf4d1`), and 3E-1 (Team foundation + read routes: `GET /api/team`, `GET /api/team/[id]` plus `src/lib/team-constants.ts`; decisions A1/B1/C1/D1/E1; C-2026-05-05-02 / D-2026-05-05-02, commit `caafcd2`) **DONE** — pushed, deployed, and Netlify-verified. Full Section 14 Step 3D (Tasks route group) and Step 3E-1 (Team read routes) are now complete. Pending route groups: `team/` 3E-2 (mutations), `modules/` (3F).
4. **Supabase Auth + tenant-guard + RBAC** - **PARTIALLY DONE**. Cloud Codex shipped `src/lib/tenant-guard.ts` (53 lines, email / domain validation). Step 3A added the codified Section 10 permission matrix at `src/lib/permissions.ts` (extended in 3C with `Action.ACTIVITY_VIEW`). Pending: full Supabase Auth replacing the hardcoded login; `requireSession()` wired to a real Supabase session; origin firm / tenant routes hardened onto `requireAuth`; allowed-domain enforcement at the API layer; `writeActivityLog()` made real (lights up the deferred audit trail and the existing 3B / 3C call sites); removal of hardcoded Platform Owner credentials from the client bundle.
5. **Persistence cutover** - **NOT STARTED**. UI still reads / writes via localStorage. API routes exist but UI does not consume them. One-time browser-side export endpoint, `ActivityLog` writes, full validation pass against Postgres, removal of localStorage source-of-truth code - all pending.

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
