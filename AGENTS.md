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

## 9) PracticeIQ Working Rules

Effective 2026-04-30 (D-2026-04-30-15 reconciliation). These rules layer on top of Sections 1-8 above. They exist to prevent the file-corruption, verification failures, and infrastructure mistakes encountered during the Phase-1 build. Do not skip them. See `MASTER_PROJECT.md` and `DECISION_LOG.md` for the broader governance context.

### G1 - OneDrive file-edit discipline

For any source file touched more than once in a single wave, use one full-file `Write` instead of multiple `Edit` operations. Single-`Edit` on a file (one change in the wave) is fine. Never issue parallel `Edit` calls against the same file - parallel Edits on OneDrive-mounted files have been observed to append NULL bytes that break the ESLint parser.

### G2 - Bash allowed, cross-check critical findings

Bash on the Linux mount of OneDrive can serve stale snapshots during active sync. Bash is the right tool for `npm run lint`, `npm run db:validate`, `npm run uat:check`, and pattern grep. When bash output suggests a file has unexpected content (truncation, extra bytes, mismatched diff), cross-verify with the Cowork `Read` tool before acting on the finding. Read is the authoritative view of file state; do not "repair" a file based on bash alone.

### G3 - Local production build is mandatory

The agent's sandbox cannot run `npm run build` cleanly (OneDrive blocks `.next/BUILD_ID` deletion with EPERM). At the end of every wave that touches code or config, Pankaj runs `npm run build` (or `npm run uat:check`) on Windows PowerShell and reports green or specific error. This is mandatory, not optional.

### G4 - Infra change-back-channel

If Pankaj changes anything directly on Netlify (URL, build settings, env vars, custom domain) or any other live infra (Supabase, DNS, registrar, M365), the next message to the agent includes a one-line note. The next wave's first action reconciles docs and code with the change. Current locked live URL: `https://practice-iq.netlify.app`.

### G5 - Section 14 sequence vs side waves

Section 14 of `MASTER_PROJECT.md` is the locked execution spine. Side waves (rebrand, URL update, data cleaning, reconciliation, etc.) can interleave only when they touch different files than the active Section 14 step. When they conflict, the agent surfaces the conflict and asks for ordering before executing.

### G6 - Database and schema safety

In effect from Section 14 Step 2 onward (Postgres, Prisma, migrations, schema, env files):

- **Git hygiene before edit**: agent runs `git status` before editing any schema or config file. If the working tree is dirty, agent surfaces the uncommitted changes and recommends a specific checkpoint commit before agent edits begin.
- **Never delete `dev.db`**. The file may become orphaned after the Postgres switch; it stays preserved as a no-op artefact, not removed.
- **Never run or recommend `prisma migrate reset`**. If schema-vs-data drift surfaces, agent stops and asks the user rather than suggesting reset.
- **No destructive database operations** (`DROP TABLE`, `TRUNCATE`, `DELETE FROM` without `WHERE`, manual schema demolitions) without explicit per-action user approval.
- **Secrets never enter chat or any committed file**. Service-role keys, `DATABASE_URL` with passwords, Supabase anon keys, etc. belong in `.env.local` only (already gitignored). Agent never requests them in chat and never pastes them anywhere the user might commit.

### G7 - Entity route groups consume Section 23 first

For any new entity route group (Section 14 Step 3D Tasks, 3E Team, 3F Modules, and any future entity routes), the agent reads `MASTER_PROJECT.md` Section 23 (or its named successor) **before** drafting the route plan. Status / priority / transition / reopen / cancel / inactive-handling / audit-event / cross-firm-ID / entitlement / paywall-feature-code decisions live there as canonical, not in scattered route files. The route plan turn cites Section 23 as the source of its implementation constraints. Decisions that conflict with Section 23 are surfaced as MCQs requiring explicit Pankaj approval, never silently overridden.

### G8 - Tier 1 governance file maintenance + pre-commit consistency check

The agent runs a Tier 1 consistency check across the five governance files: `MASTER_PROJECT.md`, `CURRENT_STATUS.md`, `DECISION_LOG.md`, `CHANGE_LOG.md`, `AGENTS.md`. The 11 specific checks (C1 through C11) are listed in `MASTER_PROJECT.md` Section 24.5.

**The Tier 1 consistency check applies before every commit-grade wave, whether code or documentation. It does not apply to every minor chat response or exploratory discussion. It applies when Claude is preparing changes that may be staged, committed, pushed, or used as the basis for a major Section 14 step.**

The check runs as a short structured report in chat (typically ~10 lines) before the "ready to stage" message. The result is reported as **GREEN** (all 11 pass), **YELLOW** (informational findings that do not block commit), or **RED** (one or more checks fail; commit blocked until resolved). On RED, the agent surfaces the failure with an MCQ before staging.

Independent ChatGPT review (per `MASTER_PROJECT.md` Section 24.6) is a control input, not an approval. Only Pankaj's explicit chat go-ahead authorises execution.

### G9 - Cost discipline at Stage 0

PracticeIQ is a founder-led POC. Recommendations prefer free, built-in, open-source, or existing-stack options before any paid spend. Detailed principle and trigger framework live at `MASTER_PROJECT.md` Section 22.9.

For every proposal that touches tooling, infrastructure, third-party APIs, paid plans, or any spend (including switching from a free tier to a paid one), the agent presents four rows in this order:

1. **Free / built-in / open-source option** - which Netlify / Supabase / GitHub / Prisma / Next.js feature, or which open-source tool
2. **Paid option** - the named alternative if a paid path becomes necessary
3. **Recommendation** - one of the two above
4. **Trigger point for upgrade** - concrete stage gate or observable event that flips the recommendation (e.g., "first paying firm", "3 active firms", "Stage 0.5 friendly pilot", "API quota exceeded", or "specific gap that free option cannot close")

Recommending a paid option without all four rows is a check failure under MASTER Section 24.5 (specifically C8 "no unlogged decisions" - paid tooling decisions need their justification visible).

Vendor prices, exact free-tier limits, and plan limits are NOT hardcoded in MASTER or AGENTS. The agent verifies current pricing and limits from official vendor sources at the time of recommendation and surfaces them in chat for the specific decision; the documented rule stays principle-based.

