# TOS TAMS-TKG UAT Deployment

## Current UAT Readiness

This build is ready for first UAT review on Netlify as a browser-persistent demo. It is not yet the final production persistence layer.

What works for UAT:
- Role-based demo login.
- My Tasks dashboard.
- List/Kanban view.
- Task creation.
- Multiple assignees and mandatory reviewer.
- Progress notes.
- Reviewer closure with closure remarks.
- Clients, Team, Reports, Admin, module flags, plan readiness.
- Browser-local persistence for UAT changes.

Next production layer:
- Connect Supabase Auth.
- Apply `supabase/schema.sql`.
- Replace browser-local state with Supabase-backed API calls.
- Enable Netlify environment variables.

## Netlify Settings

If importing from GitHub, use:

- Base directory: repository root if this app is the repo root; otherwise `02_App/tos-app`.
- Build command: `npm run build`.
- Publish directory: `.next`.
- Node version: `20`.

The included `netlify.toml` is configured for the app root.

## Supabase Environment Variables

Set these in Netlify once Supabase persistence is enabled:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## Safety

Do not use real TAMS-TKG client confidential data until Supabase persistence, access control, and backups are enabled.
