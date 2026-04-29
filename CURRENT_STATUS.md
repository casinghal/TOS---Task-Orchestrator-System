# CURRENT_STATUS.md

## Repo Health
- Branch: `main`
- Latest commit: `932b72c` (`Clean branding, add firm setup flow, and update role-based UI`)
- Working tree at creation time of this file: expected clean after commit

## What Was Just Completed
1. Removed old single-firm branding traces from active UI flow.
2. Kept platform owner login functional while removing visible credential hints from login copy.
3. Applied deep grey login styling and Montserrat on login.
4. Applied Poppins as in-app font baseline.
5. Improved sidebar sequencing and naming for clarity.
6. Enforced role-based section visibility more explicitly.
7. Added **Firm Setup** section for:
   - active firm profile maintenance
   - registration of additional firms (Platform Owner gated)

## Deployment Status
- GitHub push done to `main`.
- Netlify should auto-deploy from linked repository/branch.

## Environment Variables Expected (Netlify/Runtime)
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Immediate Validation Checklist
- Login page has no visible owner credential hint text.
- Branding shows `PracticeIQ` consistently.
- Role-specific sections are hidden/shown correctly by profile.
- Firm Setup tab visible only to authorized roles.
- Build command passes: `npm run build`.
