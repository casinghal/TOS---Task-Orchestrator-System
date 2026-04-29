# NEXT_TASKS.md

## Priority Roadmap (Execution Order)

1. **Stabilize backend source of truth**
   - Move remaining UI localStorage-first flows to Prisma-backed APIs.
   - Keep UI unchanged; replace storage layer safely.

2. **Complete firm onboarding flow**
   - Connect Firm Setup UI to `/api/firms` create/update endpoints.
   - Persist firm directory and active firm server-side.

3. **Role-to-permission policy hardening**
   - Centralize permissions map (section access + action access).
   - Reuse policy across UI and API checks.

4. **Split `src/app/page.tsx` into modules**
   - Extract dashboard, review, team, admin, and modal components.
   - Keep behavior identical (no UX regression pass).

5. **Data validation hardening**
   - Enforce PAN/GSTIN/email/mobile validation at API and form level.
   - Add explicit error copy for invalid formats.

6. **Assignment/project governance polish**
   - Add clearer dependency mapping and timeline views per assignment.
   - Keep partner/admin control features primary.

7. **Email reminders + escalation engine**
   - Wire scheduler + template pipeline.
   - Add opt-in controls from admin panel.

8. **Release safety controls**
   - Add rollback playbook in docs.
   - Add deployment checklist script for pre-release.

9. **Automated QA baseline**
   - Add smoke tests for login, role visibility, task lifecycle, firm setup.
   - Add integration tests for critical API routes.

10. **Training collateral package**
   - Generate structured end-user PPT with latest screenshots once UI freeze is declared.

## Change Control Rule
For each new task: update only impacted modules; avoid full-file rewrites unless required.
