# DECISION_LOG.md - PracticeIQ

Update rule: one entry per meaningful product, architecture, database, auth, deployment, or pricing decision.

Historical Phase-0 product decisions (pre-takeover) live in `00_Project_Memory/TOS_MEMORY.md` and `01_Product_Docs/13_DECISION_LOG.md`. This log starts at the takeover handoff on 2026-04-30.

---

## D-2026-04-30-01 - Database stack: Prisma + Supabase Postgres

- **Decision**: Persistence layer is Prisma ORM against Supabase Postgres.
- **Why**: Keeps the existing Prisma schema work, gives type-safe queries, versioned migrations, and matches what `DEPLOYMENT.md` already documents.
- **Alternatives rejected**: Supabase-only (drops Prisma; loses ORM type-safety; throws away schema work). Stay on SQLite (blocks any client-facing rollout beyond TAMS-TKG).
- **Impact**: Prisma `provider` flips from `sqlite` to `postgresql` in Step 2. `supabase/schema.sql` becomes a reference doc, not the live schema.

## D-2026-04-30-02 - Authentication: Supabase Auth

- **Decision**: Identity and sessions are managed by Supabase Auth (email + password to start).
- **Why**: Sessions, password reset, email verification, JWT issuance handled for us. Matches the chosen DB stack.
- **Alternatives rejected**: Custom JWT + bcrypt over Prisma (we own all security patches forever). NextAuth / Auth.js (adds a second auth abstraction on top of Supabase, fragments the session story).
- **Impact**: Hardcoded SHA-256 password digest in client bundle is removed in Step 4. `tenant-guard.ts` consumes Supabase session.

## D-2026-04-30-03 - Backend build order: Foundation first

- **Decision**: Sequence locked as Foundation → Postgres → API → Auth + RBAC → Persistence cutover.
- **Why**: Each step builds on the last with no rework. Avoids writing API routes without identity (which would force RBAC retrofit across every route).
- **Alternatives rejected**: Persistence first then auth (double-work on every route). Auth first then everything else (cleanest identity but app gates nothing useful until rest follows).
- **Impact**: Defined as MASTER_PROJECT.md Section 14, locked sequence. No reorder without explicit approval.

## D-2026-04-30-04 - Canonical product name: PracticeIQ

- **Decision**: External brand is PracticeIQ. TOS is retained as internal codename.
- **Why**: Matches project instructions, sounds like a SaaS brand, allows live URL rename when ready.
- **Alternatives rejected**: Keep TOS everywhere (weaker brand, conflicts with project instructions). Defer the name (keeps tension in every future doc).
- **Impact**: All new docs use PracticeIQ. Codebase rename and live URL change deferred to Phase 2 cutover.

## D-2026-04-30-05 - Target market: Indian CA first, CPA-ready architecture

- **Decision**: Phase 1 to 3 sells only to Indian CA firms. Architecture stays multi-tenant and locale-flexible. CPA market unlocked in Phase 4+.
- **Why**: Matches every existing product doc (PAN, GSTIN, Indian roles). Doesn't cap long-term addressable market.
- **Alternatives rejected**: Indian only forever (caps market, contradicts project instructions). CA + CPA from day one (immediate locale, currency, tax-ID polymorphism work that is not yet scoped).
- **Impact**: No locale or currency work in Phase 1 to 3. Tax-ID polymorphism is a known schema lift in Phase 4.

## D-2026-04-30-06 - Pricing model: Hybrid per-firm base + per-user beyond N

- **Decision**: Per-firm flat base fee that includes N seats, per-user fee above the cap. Tiered as Free Trial → Starter → Professional → Enterprise.
- **Why**: Captures small-firm simplicity and large-firm scaling. Matches existing `Plan` / `FirmSubscription` schema.
- **Alternatives rejected**: Per-user / month tiered only (leaves money uncaptured for small firms with simple needs). Per-firm flat (caps revenue as firms scale).
- **Impact**: Plan tier rows in DB will carry both `priceMonthlyBase` and `priceMonthlyPerExtraUser` plus `includedSeats`. Schema lift deferred until Phase 4 (commercial activation).

## D-2026-04-30-07 - Long-term roadmap: 5 phases, milestone-level, no calendar dates

- **Decision**: MASTER_PROJECT.md carries Phase 1 to 5 milestones without dates. Calendar timing lives in CURRENT_STATUS.md.
- **Why**: Pre-revenue timing depends on validation. Calendar slippage in MASTER would mean constant edits.
- **Alternatives rejected**: 12-month dated quarterly roadmap (too brittle). Separate ROADMAP.md (splits source of truth).
- **Impact**: MASTER stays stable. Date discussions and slips happen in CURRENT_STATUS only.

## D-2026-04-30-08 - Project memory file location: `02_App/tos-app/`

- **Decision**: MASTER_PROJECT.md, CURRENT_STATUS.md, DECISION_LOG.md, CHANGE_LOG.md live at the app root next to `package.json` and `AGENTS.md`, not at the repo root or in `00_Project_Memory/`.
- **Why**: Co-locates project memory with code so any developer (human or agent) finds them without hunting. Project instructions explicitly read from app root.
- **Alternatives rejected**: Repo root (separates from code). `00_Project_Memory/` (legacy chronological log location, mixes Phase-0 history with active project memory).
- **Impact**: `00_Project_Memory/TOS_MEMORY.md` and `01_Product_Docs/13_DECISION_LOG.md` are kept as historical Phase-0 archive. New decisions go here.

## D-2026-04-30-09 - Live URL renamed: `tos-tams-tkg.netlify.app` to `practice-iq.netlify.app`

- **Decision**: The Netlify site was renamed by Pankaj directly from `tos-tams-tkg.netlify.app` to `practice-iq.netlify.app`. The new URL `https://practice-iq.netlify.app/` is now the canonical live URL.
- **Why**: Aligns the public URL with the new product brand (PracticeIQ, locked in D-2026-04-30-04). Removes the legacy product-codename "tos" from the user-facing surface. Closes the URL-rename concern that was tagged HIGH-RISK in the Phase-1 rebrand plan.
- **Alternatives rejected**: Custom domain such as `app.practiceiq.in` (deferred to Phase 4 commercial activation). Keep both URLs alive via redirect (Netlify free-tier rename does not preserve the old hostname; not configurable).
- **Impact**: Old URL `https://tos-tams-tkg.netlify.app/` returns 404 ("Site not found") - confirmed by Pankaj via browser test on 2026-04-30. Any pre-existing bookmarks to the old URL are dead. Doc references updated (see C-2026-04-30-03). User-comms about the URL change is NOT required (Pankaj confirmed 2026-04-30: no real users to inform). Section 14 cutover requirement (zero-downtime through Step 1) now applies to the new URL. Wave 4 of the rebrand plan is fully complete.

## D-2026-04-30-10 - PracticeIQ identity, allowed-domains, and notification architecture

- **Decision**: Lock the SaaS identity and notification model. Two-tier identity: Platform Owner uses a dedicated SaaS root account (`admin@practiceiq.app`), never a personal email. Firm users sign in with their own firm-domain emails. Firms carry one or more `AllowedFirmDomain` records. Personal emails are permitted only as recovery / backup. Notification preferences live at user-level and firm-level. Channels: EMAIL, WHATSAPP, IN_APP. Types: DUE_REMINDER, OVERDUE_ALERT, DAILY_SUMMARY, REVIEW_PENDING, ACTION_REQUIRED, CLOSURE_CONFIRMATION. Mobile number is an optional profile field; WhatsApp is a future module gated by consent and firm-level configuration.
- **Why**: Pre-takeover code wired the Platform Owner to a personal Gmail and gated all logins to a single firm domain. That works for a single-tenant prototype, not for multi-firm GA. Locking the identity model now ensures Section 14 Steps 2 (schema) and 4 (auth) build the right structure first time. Email becomes the primary notification channel; WhatsApp follows once Phase-5 messaging infrastructure is in. Notification audit trail (`NotificationLog`) is required from day one of email sending so every reminder is traceable.
- **Alternatives rejected**: (a) Keep personal Gmail as permanent Platform Owner identity - security and brand risk; personal email mixed with SaaS root is poor hygiene. (b) Single shared `@practiceiq.app` domain for all firm users - collapses firm boundaries; users would not recognize their own identity inside their firm's workspace. (c) Defer the identity decision until Section 14 Step 4 - forces a seed and login rebuild twice and risks Step 2 schema being misshapen.
- **Impact**: Three new entities planned for Phase 2/4 schema work: `AllowedFirmDomain` (firm allowed-domain rule), `UserNotificationPreference` (per-user channel and type opt-ins), `NotificationLog` (audit trail of every send). Two new enums planned: `NotificationChannel` (EMAIL, WHATSAPP, IN_APP) and `NotificationType` (DUE_REMINDER, OVERDUE_ALERT, DAILY_SUMMARY, REVIEW_PENDING, ACTION_REQUIRED, CLOSURE_CONFIRMATION). `MASTER_PROJECT.md` Section 12 (data model) and Section 13 (Auth & RBAC) updated. Seed data: Platform Owner is now `admin@practiceiq.app` named "Platform Admin"; firm users use the placeholder firm domain `@demo-ca-firm.com`; personal Gmail is recovery-only and not wired as a primary login. Hardcoded SHA-256 password digest preserved on the new Platform Owner email so single-tenant login keeps working through the prototype phase; full replacement happens in Section 14 Step 4 with Supabase Auth. Login validator updated to accept the new firm domain plus the Platform Owner email.

## D-2026-04-30-11 - Rebranding cleanup closure: Wave 2B folder rename and Wave 3 localStorage key both deferred indefinitely

- **Decision**: The PracticeIQ rebrand initiative is closed at the user-facing surface. Two internal-only sub-waves are intentionally deferred indefinitely: (a) Wave 2B - folder rename `02_App/tos-app/` to `02_App/practiceiq-app/`; (b) Wave 3 - localStorage key migration from `tos-tams-tkg-live-v3` to a PracticeIQ-flavored key.
- **Why**: Both items are developer-internal only. The folder name is never user-visible; the localStorage key only appears in browser DevTools (99% of users never open it). Pankaj's standing principle: "if it works and is not user-visible, leave it alone." The cost of rename (doc churn, Netlify base-directory blast radius, workflow-break risk per AGENTS.md G1) outweighs zero user-visible benefit.
- **Alternatives rejected**: (a) Force the folder rename now - high doc-churn for cosmetic gain. (b) Force the localStorage rename now - non-zero workflow-break risk for invisible change. (c) Schedule a future maintenance window - speculative; no functional driver to commit to a date.
- **Impact**: Closes the rebrand initiative. `REBRANDING_CLOSURE_REPORT.md` produced at app root capturing what changed, what was deferred, what legacy remains and why, remaining risks, and Section 14 readiness. Section 14 Step 1 is unblocked pending Pankaj's approval of the closure report. Phase-0 internal names (`tamsEmailDomain` constant, `isTamsEmail` function, folder `02_App/tos-app/`, storage key `tos-tams-tkg-live-v3`, file `prisma/dev.db`) all retained with documented reasons.

## D-2026-04-30-12 - Product Intelligence Strategy locked: principles and three Phase-4/5 capabilities

- **Decision**: Lock the PracticeIQ Product Intelligence Strategy. Five principles govern any intelligence feature, present or future: (1) **rules first, AI second** - templates and deterministic logic before any model call; (2) **contextual and lightweight** - intelligence appears in the moment of work, never as a separate "AI panel"; (3) **human approval mandatory** - the platform suggests, recommends, warns; the user approves and acts; auto-execution is never the default; (4) **confidential by design** - every AI call respects firm tenancy, allowed-domain boundaries, audit logging, and notification preferences; (5) **predictable cost** - module-flag gated and per-firm capped. Three specific capabilities recorded as Phase-4/5 roadmap items, NOT for current build: (a) AI-assisted assignment tree builder; (b) capacity-aware assignment recommendation; (c) smart daily execution briefing.
- **Why**: Pankaj's directive to make the platform intelligence-assisted without derailing the locked Section 14 backend foundation work. Locking the principles now means Phase-1-to-3 backend work anchors the right hooks (templates, audit log, notification preferences, module flags) so intelligence layers slot in cleanly later. Recording the three capabilities up front prevents them from accumulating as ad-hoc requests during Phase 2-3 work.
- **Alternatives rejected**: (a) Build any intelligence feature in Phase 1 - derails locked Section 14 sequence. (b) Defer the strategy until Phase 5 - risks anchoring Phase-1-to-3 hooks incorrectly and missing data-model implications. (c) Build the three capabilities as full AI-first features with no rules-first layer - higher cost, more maintenance, less predictable than the rules-first approach.
- **Impact**: New `MASTER_PROJECT.md` Section 19 "Product Intelligence Strategy" captures the principles and the three roadmap items. Section 17 Phase 5 line updated to reference Section 19. Section 14 backend strategy unchanged - locked sequence preserved per the user's standing rule. None of the three capabilities are built in this turn or anytime before Section 14 Steps 1 to 5 are complete. Future intelligence features must conform to the five principles or get an explicit exception decision recorded in DECISION_LOG.

## D-2026-04-30-13 - Product Experience & Guided UX Principles locked: eight principles + Design Review gate before beta

- **Decision**: Lock the PracticeIQ Product Experience and Guided UX Principles. Eight principles govern all UI work, present and future: (1) **visual design direction** - calm, professional, clean, business-grade for CA / CPA firm operations; not flashy, childish, overloaded, or generic-dashboard-template; (2) **role-based UX** - the platform experience changes by role (Platform Owner, Firm Admin, Partner, Manager, Article / Staff); each role sees only what is relevant; (3) **guided workflow design** - every screen shows what needs attention, what is pending, what action is expected, what should happen next; (4) **progressive input capture** - inputs captured step by step, lightweight prompts, MCQ-style interactions, no field-floods; (5) **interactive decision support** - the platform recommends, the user decides, human approval mandatory; (6) **low-clutter interface** - no unnecessary panels, floating widgets, or excessive AI suggestions; (7) **Design Review Gate** - mandatory Product Experience Review before beta release, covering visual quality, role-based usability, navigation, guided workflow, input burden, decision support, and new-user operability without full training; (8) **final UX objective** - "guided execution system, not a static task tracker."
- **Why**: Pankaj's directive to lock product experience principles before any UI redesign begins, so Phase 1 backend foundation anchors the right hooks (role-based surfacing, progressive capture state, decision-support hooks, audit log of approvals). Locking now prevents drift toward generic-dashboard-template aesthetic during Phase 2-3 implementation. Beta release is gated on the Product Experience Review.
- **Alternatives rejected**: (a) Defer UX principles until Phase 2 - risks Phase 1 backend and seed UX work shipping with anti-patterns that need rework. (b) Begin UI redesign now - derails the locked Section 14 backend foundation. (c) Make the Design Review optional - removes the only structural quality gate before beta and makes drift acceptable.
- **Impact**: New `MASTER_PROJECT.md` Section 20 "Product Experience & Guided UX Principles" captures the eight principles. Section 17 Phase 2 line updated to make Product Experience Review approval the entry gate to beta / GA. Section 14 backend strategy untouched - locked sequence preserved. No UI implementation work begins now; each principle becomes its own Plan → Approval → Execution → Test → Log cycle when Phase 2+ work reaches it. Phase-0 docs `01_Product_Docs/06_UI_UX_BLUEPRINT.md` and `01_Product_Docs/16_UI_UPGRADE_BLUEPRINT.md` remain historical archives; Section 20 supersedes them as the active reference for UI work going forward. Future UI features must conform to the eight principles or get an explicit exception decision recorded in DECISION_LOG.

## D-2026-04-30-14 - Product strategy and release-readiness principles locked

- **Decision**: Lock seven strategic principles in MASTER_PROJECT.md. (1) **Build C, show A reinforced** with the concrete list of currently-scaffolded-but-hidden modules: Client Portal, Document Upload, WhatsApp Reminders, AI Assignment Builder, Advanced Reports, Billing / Subscription, Email Integration. These surface only in a controlled Plan & Modules / Upgrade Features area, not as locked buttons on operational screens. (2) **Plan tier feature contents locked**: Starter = Tasks, Clients, Team, Basic reports; Professional = Starter + Recurring workflows + Client Request Reminder Engine + Advanced reports + Email reminders; Enterprise = Professional + Client Portal + Document Upload + WhatsApp + AI assignment builder + Capacity intelligence + Audit log search + Advanced admin controls. Pricing values remain TBC. (3) **Client Request Reminder Engine ships before any Client Portal** - solves client-delay problem without document-storage risk. (4) **Client Portal Security Pre-Conditions** - 11 specific items must each be approved and recorded in DECISION_LOG before document upload ships. (5) **Monetization Discipline** - four standing don'ts protecting Section 14 sequence and keeping operational UX clean. (6) **Three release-readiness gates** overlay the existing 5-phase roadmap (Pre-Beta inside Phase 1; Pre-Paid-Launch inside Phase 3; Post-Launch / Premium inside Phase 5). (7) **"Fast or clutter" acceptance test** added to Section 20.6.
- **Why**: Pankaj's directive to lock product strategy and release-readiness principles before Phase 2-3 work begins, so feature shipping order is governed by user value and security pre-conditions, not by ad-hoc commercial pressure. Reminder engine before Client Portal solves the operational problem (client-side delays slowing closure) without taking on document-storage risk. Locking 11 portal security pre-conditions removes any "ship now, secure later" path. Defining plan tier contents now lets the seed and admin UI scaffold the right gating from the start.
- **Alternatives rejected**: (a) Build Client Portal in Phase 2 to drive premium revenue earlier - violates security-first principle; storage and audit posture not ready. (b) Leave plan tier contents TBC until Phase 4 - means firm admins cannot see what they're paying for during onboarding; pushes the decision into commercial-pressure territory. (c) Skip the reminder engine and rely on out-of-band email - misses the pending-request audit trail, breaks the workflow loop. (d) Keep the existing 5-phase roadmap without overlaying release gates - leaves the entry conditions implicit and contestable under pressure.
- **Impact**: New `MASTER_PROJECT.md` Section 21 captures 21.1 (reminder engine), 21.2 (portal security pre-conditions), 21.3 (monetization discipline). Section 4 expanded with scaffolded-but-hidden module list. Section 5 expanded with per-tier feature contents table. Section 17 restructured with three release-readiness gates as bullets within the 5-phase plan (no phase removed or renamed). Section 20.6 gains the "fast or clutter" acceptance test. Section 14 untouched - locked sequence preserved. New module flags planned: `CLIENT_REQUEST_ENGINE`, `CLIENT_PORTAL`, `DOCUMENT_UPLOAD` (Phase 2/3 schema work; natural extensions of existing `ModuleFlag` table). None of these capabilities are built in this turn. Each becomes its own Plan → Approval → Execution → Test → Log cycle when its phase arrives.

## D-2026-04-30-15 - Cloud-Codex divergence reconciliation: adopt origin/main as code base; preserve local governance docs

- **Decision**: Local working tree was reset to `origin/main` (`eaac64f`) on 2026-04-30. The cloud Codex co-work environment had pushed 8 commits that materially advanced the backend (Postgres schema, first migration, 5 API routes, `tenant-guard.ts`, Prisma client singleton) ahead of our locked Section 14 plan. Live URL serves origin/main. Local memory documentation (`MASTER_PROJECT.md`, `DECISION_LOG.md`, `CHANGE_LOG.md`, `REBRANDING_CLOSURE_REPORT.md`, plus G1-G6 Working Rules in `AGENTS.md` Section 9) is preserved as the governance layer on top of origin's code base.
- **Why**: Origin is what ships and what users see. Our local code edits had not been pushed and had been overtaken by the cloud Codex environment's work. Force-pushing local would have wiped origin's deployed backend progress. The safest reconciliation is to adopt origin's code, layer our governance docs on top, and document the divergences for resolution in subsequent steps.
- **Alternatives rejected**: (a) Force-push local over origin - catastrophic; would have wiped deployed backend. (b) Pure file-by-file merge - too large, too fragile (32 files, +8752 / -7279 lines diff). (c) Discard our local docs and start from origin's `NEXT_TASKS.md` / `PROJECT_CONTEXT.md` alone - loses the architectural decisions, principles, and audit trail we built (Sections 19, 20, 21; D-01 through D-14; the rebrand closure record).
- **Architectural divergences logged for follow-up**:
  - (a) Origin uses `Firm.emailDomain` (single string) instead of D-2026-04-30-10's `AllowedFirmDomain` table (multi-domain per firm). Acceptable for current single-firm prototype; revisit when a firm needs more than one domain.
  - (b) `UserNotificationPreference`, `NotificationLog`, `NotificationChannel`, `NotificationType` are NOT in origin's schema. They remain Phase-2 work per D-2026-04-30-10.
  - (c) `scripts/release-data-guard.mjs` was deleted by origin. `package.json` no longer has `release:data-guard`. `release:check` was renamed to `uat:check`. Decision pending: reinstate (with our regex + ignored-files setup) or accept origin's removal.
  - (d) Origin's seed firm uses domain `practiceiq.in` (real-looking) instead of D-2026-04-30-10's planned `@demo-ca-firm.com` placeholder. Origin's Platform Owner is still `singhal.accuron@gmail.com` instead of D-2026-04-30-10's planned dedicated `admin@practiceiq.app`. Both kept as origin shipped them; revisit when commercial activation requires hardening.
- **Impact**: All Section 14 step statuses updated in `MASTER_PROJECT.md` v1.7 (Step 1 done; Steps 2, 3, 4 partially done; Step 5 not started). `CURRENT_STATUS.md` rewritten to merge our phase tracker with origin's repo-health facts. `AGENTS.md` G1-G6 working rules ported into origin's `AGENTS.md` as Section 9. `NEXT_TASKS.md` and `PROJECT_CONTEXT.md` from origin retained as supporting handover docs. `.env.example` re-augmented with `DIRECT_URL` and the comment block (lost during reset). `.gitignore` extended with a narrow Netlify rule. No Prisma schema, migration, API route, page.tsx, or `.env.local` edits in this reconciliation wave.
