# REBRANDING_CLOSURE_REPORT.md - PracticeIQ

| Field | Value |
|---|---|
| Report date | 2026-04-30 |
| Initiative | Five-wave rebrand from TOS / TAMS-TKG (Phase-0 internal naming) to PracticeIQ (canonical product brand) |
| Closure status | All user-facing rebranding complete. Two internal-only items intentionally deferred. |
| Sign-off | **Approved by Pankaj on 2026-04-30.** Rebrand initiative closed. Section 14 Step 1 execution unlocked. |

---

## 1. What Was Changed

### Wave 1 - Cosmetic UI and documentation rename (DONE, C-2026-04-30-02)

- `src/app/layout.tsx` - page metadata title and description set to PracticeIQ.
- `src/app/page.tsx` - logo glyph "TOS" - "PIQ", header text "Task Orchestration System" - "PracticeIQ", title-attribute updates, sidebar logo, title-fallback.
- `README.md` - rewritten to PracticeIQ; Phase-0 codename TOS noted.
- `DEPLOYMENT.md` - title set to "PracticeIQ Deployment".
- `supabase/schema.sql` - first-line comment.
- `MASTER_PROJECT.md` Section 0 - codename note marked "(Phase-0 era)".

### Wave 2A - Internal package name (DONE, C-2026-04-30-06)

- `package.json` - `"name": "tos-app"` to `"name": "practiceiq-app"`.
- `package-lock.json` - auto-refreshed on next `npm install` (verified by Pankaj on Windows: lint, data-guard, db:validate, build all green; build header now reads `practiceiq-app@0.1.0`).

### Wave 4 - Live URL rename (DONE, C-2026-04-30-03 + D-2026-04-30-09)

- Netlify site renamed by Pankaj directly: `tos-tams-tkg.netlify.app` to `practice-iq.netlify.app`.
- All doc references updated: MASTER_PROJECT.md, CURRENT_STATUS.md, DEPLOYMENT.md.
- Old URL returns 404 (confirmed by Pankaj). User-comms not required (no real users to inform).

### Wave 5 - Firm data + identity architecture (DONE, C-2026-04-30-04 + C-2026-04-30-05 + D-2026-04-30-10)

- `src/lib/workspace-data.ts` - full rewrite. Firm = "PracticeIQ Workspace". Platform Owner = `admin@practiceiq.app` (dedicated SaaS root identity). Four firm users on `@demo-ca-firm.com`.
- `src/app/page.tsx` - "TAMS-TKG" - "PracticeIQ" globally; `@tams.co.in` - `@demo-ca-firm.com` globally; login validator + form copy + admin pitch + Team modal regex pattern updated; "Gmail ID" copy reworded to reflect dedicated platform owner identity.
- `scripts/release-data-guard.mjs` - `ignoredFiles` extended to skip `workspace-data.ts` (seed) and the four memory files plus `AGENTS.md`. Regex `/\bdemo\b/i` refined to `/\bdemo\b(?!-ca-firm)/i` to allow the placeholder firm domain while still catching real "demo" usage.
- `MASTER_PROJECT.md` - rewritten to v1.2. Section 4 (positioning), Section 12 (data model with planned `AllowedFirmDomain`, `UserNotificationPreference`, `NotificationLog`), Section 13 (two-tier identity model), Section 14 Step 2 (schema lift).
- `DECISION_LOG.md` D-2026-04-30-10 captures the SaaS identity and notification architecture as a locked decision.

### Supporting changes

- `AGENTS.md` - new "PracticeIQ Working Rules" section (G1 through G5) governing OneDrive file-edit discipline, bash verification cross-check, mandatory local production build, infra change-back-channel, and Section 14 spine vs side-wave sequencing.
- `CURRENT_STATUS.md` - priority items adjusted to reflect rebrand state.

---

## 2. What Was Intentionally Deferred

### Wave 2B - Folder rename `02_App/tos-app/` to `02_App/practiceiq-app/` (DEFERRED INDEFINITELY)

- **Decision date**: 2026-04-30 by Pankaj.
- **Reason**: Cosmetic-only value (folder name is developer-facing, not user-visible). High doc-churn cost across MASTER_PROJECT.md, CURRENT_STATUS.md, DECISION_LOG.md, CHANGE_LOG.md, DEPLOYMENT.md, README.md. Netlify base-directory configuration would also need updating with deploy-fail blast radius if mis-set.
- **Consequence**: The path `02_App/tos-app/` persists in all docs, paths, shell commands, and Pankaj's muscle memory. No functional impact.
- **To revisit**: Only if a clear functional reason emerges. None on the roadmap today.

### Wave 3 - localStorage key migration (DEFERRED INDEFINITELY)

- **Decision date**: 2026-04-30 by Pankaj.
- **Reason**: localStorage key name is invisible to users (only appears in browser DevTools, which 99% of users never open). Renaming it carries non-zero workflow-break risk per AGENTS.md G1 file-edit discipline and Pankaj's standing rule "do not blindly rename localStorage keys holding real data" - for zero user-visible benefit. Pankaj's principle: "if it works and is not user-visible, leave it alone."
- **Consequence**: Key `tos-tams-tkg-live-v3` and the `legacyStorageKeys` array remain unchanged in `src/app/page.tsx`. Migration logic untouched.
- **To revisit**: Only if a real user-facing reason emerges (data corruption, multi-firm schema requiring per-firm keys, etc.).

---

## 3. Remaining Legacy References (Each With Reason for Retention)

### Active code (Phase-0 internal names retained)

| Location | Reference | Why retained |
|---|---|---|
| `src/app/page.tsx` line 70 | `workspaceStorageKey = "tos-tams-tkg-live-v3"` | Wave 3 deferral |
| `src/app/page.tsx` line 71 | `legacyStorageKeys = ["tos-tams-tkg-live-v3", ...]` | Wave 3 deferral |
| `src/app/page.tsx` line 75 | constant name `tamsEmailDomain` (value is now `@demo-ca-firm.com`) | Phase-0 internal name; rename queued for Phase-2 schema lift; commented inline |
| `src/app/page.tsx` ~line 1102 | function `isTamsEmail` | Phase-0 internal name; rename queued for Phase-2 |
| `prisma/dev.db` | SQLite filename `dev.db` | Replaced by Supabase Postgres in Section 14 Step 2 |

### Folder structure

- `02_App/tos-app/` - retained per Wave 2B deferral.

### Memory and historical references

- All four project memory files (MASTER_PROJECT.md, CURRENT_STATUS.md, DECISION_LOG.md, CHANGE_LOG.md) reference `02_App/tos-app/` - retained, will not change unless Wave 2B is unsealed.
- DECISION_LOG.md D-2026-04-30-04 records "TOS" as the Phase-0 codename - retained as historical record; not retro-edited.
- DECISION_LOG.md D-2026-04-30-08 records the path `02_App/tos-app/` - retained as historical record.
- `00_Project_Memory/TOS_MEMORY.md` - retained as Phase-0 historical archive.
- `01_Product_Docs/13_DECISION_LOG.md` - retained as Phase-0 historical archive.
- `01_Product_Docs/*.md` (Phase-0 docs) - retained, may contain TOS / TAMS references; not retro-edited.

### Why the retained legacy is acceptable

The retained references fall into three categories:

1. **Internal-only names** (`tamsEmailDomain`, `isTamsEmail`, folder name, localStorage key, `dev.db`) - never user-visible.
2. **Historical records** (DECISION_LOG entries, CHANGE_LOG entries, Phase-0 docs in `00_Project_Memory/` and `01_Product_Docs/`) - retro-editing rewrites history; project policy is to leave them as factual record.
3. **Phase-1 prototype ergonomics** (`dev.db` SQLite file) - replaced by design in Section 14 Step 2.

User-facing surface (UI text, page title, logo, header copy, login form, error messages, admin pitch, seed firm name, live URL) is fully PracticeIQ.

---

## 4. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Future folder rename would cascade across every memory file path | Low | Documented as deferred; no near-term trigger |
| Future localStorage key rename would wipe browser test data on next load | Low | Existing `legacyStorageKeys` cleanup mechanism handles it; documented |
| Internal constant `tamsEmailDomain` and helper `isTamsEmail` may confuse a future developer reading code without context | Very low | Inline comment links to D-2026-04-30-10 with the Phase-2 rename plan |
| Phase-0 historical docs in `00_Project_Memory/` and `01_Product_Docs/` carry TAMS / TOS references | Very low | Marked as historical archive; not part of active project memory |

No Critical, High, or Medium risks remain. All retained legacy is intentional and documented above.

---

## 5. Are We Clear to Resume Section 14?

**Yes.**

Recommendation: resume Section 14 Step 1 (Foundation cutover) at the next session.

Justification:

- All user-facing branding is now PracticeIQ.
- Both deferred items (Wave 2B, Wave 3) are documented and carry no functional dependency on Section 14 work.
- Section 14 Step 1's scope (`next.config.ts` flip from static export, `netlify.toml` runtime update, `.env.example` template) does not touch any deferred rebrand item and does not conflict with any retained Phase-0 internal name.
- The four memory files at app root are in place (Step 1's "create memory files" sub-task is already done as a side-effect of the rebrand work).
- Live URL `https://practice-iq.netlify.app/` is the new locked target for the zero-downtime cutover requirement.
- AGENTS.md G1 through G5 working rules are in force and were proven during the rebrand waves.

---

## 6. Sign-off

**Approved by Pankaj on 2026-04-30.** The PracticeIQ rebrand initiative is closed. Section 14 Step 1 execution is unlocked per the locked five-step backend strategy in `MASTER_PROJECT.md` Section 14.

End of report.
