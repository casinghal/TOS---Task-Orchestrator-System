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

### G10 - Claude handoff and PowerShell hygiene

Effective 2026-05-05 (D-2026-05-05-04 adoption). Layers on top of G3 (local production build mandatory) and G6 (database safety).

**Claude-facing handoff format**:

- Execution instructions Claude receives via Pankaj must be fully contained inside one copyable markdown block. Stop conditions, validation steps, and PowerShell commands all live inside the block.
- If a prompt arrives with execution scattered across multiple blocks plus surrounding prose, Claude flags the split and asks for a single consolidated block before acting.

**PowerShell command blocks Claude issues**:

- Every block begins with the full PracticeIQ app folder path on the first executable line:
  ```
  cd "C:\Users\panka\OneDrive - Avantage Partners Private Limited\.MY DATA - AVANTAGE\CLAUDE_Automation projects\Practice IQ - Task Orchestration System_Automation\02_App\tos-app"
  ```
- Pankaj opens fresh PowerShell sessions from his home folder; without the `cd`, commands land in the wrong directory.

**Git staging discipline**:

- Never use `git add .` or `git add -A`. Both can stage files outside the intended scope of the wave.
- Use explicit `git add <path>` per intended file.
- Quote bracketed paths: e.g., `git add "src/app/api/team/[id]/route.ts"` — PowerShell treats `[id]` as a glob pattern otherwise.
- The staged set must match the wave's `CHANGE_LOG.md` entry exactly. Mismatch is a Tier 1 C3 fail.

**Git lockfile safety**:

- Never auto-delete `.git/index.lock` in a Claude-issued PowerShell block.
- Correct pattern: detect via `Test-Path` → inspect via `Get-Item` (size + last-write-time) → check live git processes via `Get-Process -Name git -ErrorAction SilentlyContinue` → warn Pankaj if uncertain → stop the block. Manual deletion is Pankaj's call only, after he reviews the inspection output.

**Repo-state authority**:

- Windows PowerShell `git status` and `git log` are authoritative for this OneDrive-mounted repo.
- The agent's bash sandbox may serve stale snapshots during active OneDrive sync (per G2). For commit-grade verification, the PowerShell-side report is the source of truth.

### G11 - Pre-major-wave stress test

Effective 2026-05-05 (D-2026-05-05-04 adoption). Layers on top of G7 (Section 23 consumption before entity routes) and G8 (Tier 1 consistency check).

**When the stress test applies**:

- Before any major planning, implementation, governance, auth, tenanting, schema, deployment, or commit-grade prompt.
- Not before trivial chat exchanges, factual questions, or read-only audits.

**Self-check categories**:

Before issuing a code or commit-grade plan, Claude self-checks for: scope creep, sequencing violation, security risk, tenant isolation risk, RBAC/auth risk, PII exposure, audit/ActivityLog gap, documentation drift, git risk, cost exposure, Step 4/Step 5 migration complication, rollback complexity, CA/CPA workflow impact, and Claude misinterpretation risk.

**Split risky waves**:

- Risky areas include identity, auth, RBAC, tenanting, deactivation, reactivation, paywall, entitlement, schema, cross-firm behavior, and Platform Owner behavior.
- Default to splitting these into smaller sub-waves. Recent precedent: 3D split into 3D-1 / 3D-2 / 3D-3; 3E split into 3E-1 / 3E-2A / 3E-2B. Confirm the split with Pankaj before the implementation turn.

**Conservative Stage 0 tenant defaults**:

The following SaaS-tenant rules apply unless explicitly overridden by a recorded DECISION_LOG entry:

- No silent cross-firm identity linking.
- No Platform Owner all-firm escape before an audited impersonation flow lands in Step 4.
- No cross-firm existence leakage in API responses.
- Cross-firm target lookups return 404 (not 403, not 422).
- Suspicious cross-firm attempts emit `console.warn` server-side per MASTER Section 25.4 #15.
- Admin-control actions (deactivate, reactivate, role-change, cancel, close) carry explicit rationale where practical (required text field).
- Multi-firm membership waits until Step 4 / Stage 1 unless an explicit DECISION_LOG entry approves it for a specific wave.

**Pankaj/ChatGPT advisory review**:

The advisory layer (Pankaj + ChatGPT) may stress-test Claude's plan with a 20-step impact review and a 10-flaw critique. Claude treats the review as a control input (per MASTER Section 24.6), not approval. Only Pankaj's explicit chat go-ahead authorises execution.

