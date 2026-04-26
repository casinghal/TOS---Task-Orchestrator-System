# TOS TAMS-TKG Deployment

## Current Release Readiness

This build is prepared for TAMS-TKG client-facing release review on Netlify with a simple task-management workspace.

Live URL: `https://tos-tams-tkg.netlify.app`

What works:
- Role-based workspace access.
- My Tasks dashboard.
- List/Kanban view.
- Task creation.
- Multiple assignees and mandatory reviewer.
- Progress notes.
- Reviewer closure with closure remarks.
- Clients, Team, Reports, Admin, module flags, plan controls, and activity monitor.
- Browser workspace persistence for the current release environment.

Next production hardening layer:
- Connect Supabase Auth.
- Apply `supabase/schema.sql`.
- Replace browser workspace state with Supabase-backed API calls.
- Enable Netlify environment variables.

## Netlify Settings

If importing from GitHub, use:

- Base directory: repository root if this app is the repo root; otherwise `02_App/tos-app`.
- Build command: `npm run build`.
- Publish directory: `out`.
- Node version: `20`.

The included `netlify.toml` is configured for the app root. The current release is exported as a static Next.js app for a simple, reliable deployment.

## Supabase Environment Variables

Set these in Netlify once Supabase persistence is enabled:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## Data Safety

For confidential firm-wide production data, connect Supabase persistence, access control, and backups before opening usage beyond the controlled release environment.
