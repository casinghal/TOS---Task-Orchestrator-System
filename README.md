# TOS App

Client-ready app foundation for the Task Orchestration System.

## Current Status

- Next.js app with TypeScript and Tailwind.
- TAMS-TKG task-management workspace.
- Role-based task flow with assignee, reviewer, progress notes, and closure remarks.
- Prisma schema added for SaaS-ready data model.
- Static Netlify deployment configured through `netlify.toml`.

## Local Commands

```bash
npm run dev
npm run lint
npm run db:validate
npm run release:check
```

## Product Rule

Build C, show A: keep the foundation SaaS-ready while showing a simple task workspace first.

## TAMS-TKG Release

Run locally with `npm run dev` and open `http://127.0.0.1:3000`.

Use `npm run release:check` before deployment.

Deployment notes are in `DEPLOYMENT.md`.
