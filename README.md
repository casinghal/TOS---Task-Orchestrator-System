# TOS App

First working app foundation for the Task Orchestration System.

## Current Status

- Next.js app scaffolded with TypeScript and Tailwind.
- Demo task-management workspace added.
- Prisma schema added for SaaS-ready data model.
- SQLite is configured for local development.

## Local Commands

```bash
npm run dev
npm run lint
npx prisma validate
```

## Product Rule

Build C, show A: keep the foundation SaaS-ready while showing a simple task workspace first.

## TAMS-TKG UAT

Run locally with `npm run dev` and open `http://127.0.0.1:3000`.

Use `npm run uat:check` before deployment.

Deployment notes are in `DEPLOYMENT.md`.
