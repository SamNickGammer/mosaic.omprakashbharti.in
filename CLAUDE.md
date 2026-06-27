# CLAUDE.md — Working notes for Mosaic

> Read this first, then `docs/AGENTS.md` (rules), `docs/PRD.md` (spec),
> `docs/ARCHITECTURE.md` (data flow), and `docs/DESIGN_SYSTEM.md` (visual
> system). This file tracks *how the project is actually wired* and *what is done*.

---

## What Mosaic is

A multi-client, multi-agent AI orchestration workspace. A developer manages many
clients (PepsiCo, SpinQuest, …), each with projects and AI agent credentials,
from one interface. Sending a task runs a **primary agent → secondary reviewers
→ merged final answer** orchestration (Phases 2–3). Phase 1 is the foundation.

---

## Tech stack (as built)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14.2 (App Router) | `app/` only, never `pages/` |
| Language | TypeScript (strict, `target: ES2022`) | no `any`, no `@ts-ignore` w/o reason |
| Styling | **Tailwind CSS v4** | tokens in `app/globals.css` `@theme inline`; **no `tailwind.config.ts`** |
| UI | **shadcn/ui on `@base-ui/react`** | NOT Radix. Composition uses `render={<El/>}`, not `asChild` |
| Icons | `lucide-react` | |
| Server state | `@tanstack/react-query` | hooks in `hooks/queries.ts` |
| Client state | `zustand` | `stores/workspace.ts` (active client/project) |
| DB | Neon (serverless Postgres) | |
| ORM | Drizzle | schema = source of truth in `lib/db/schema.ts` |
| Auth | NextAuth v5 (Google + GitHub + email/password, JWT) | `lib/auth.ts`, `trustHost: true`; passwords hashed with built-in scrypt (`lib/password.ts`) |
| Drag & drop | `@dnd-kit/*` | Kanban board |
| Encryption | Node `crypto` AES-256-GCM | `lib/encryption.ts` |
| AI SDK | Vercel AI SDK (`ai`) | wired in Phase 2 |

> ⚠️ The shadcn registry in 2026 ships **base-ui + Tailwind v4** components.
> Do not add `@radix-ui/*` or `tailwindcss-animate`. Add components with
> `npx shadcn@latest add <name>`. Keep theme edits in `globals.css`.

---

## Project map

```
app/
  (auth)/login/             # Google sign-in
  (dashboard)/
    layout.tsx              # auth guard + Sidebar + Topbar
    page.tsx                # dashboard overview
    clients/[clientId]/projects/[projectId]/
      page.tsx              # Kanban board (server-guarded)
      tasks/[taskId]/page.tsx# task detail + chat placeholder (Phase 2)
    settings/agents/page.tsx # agent registry
  api/
    auth/[...nextauth]/      # NextAuth handler
    clients/ , clients/[id]/ , clients/[id]/projects/
    projects/[id]/ , projects/[id]/tasks/
    tasks/[id]/
    settings/agents/ , settings/agents/[id]/
components/
  ui/                        # shadcn (base-ui) primitives
  layout/  board/  clients/  projects/  agents/  brand/  auth/
hooks/queries.ts             # all React Query hooks
lib/
  db/{schema.ts,index.ts,migrations/}
  auth.ts  api.ts  authz.ts  encryption.ts  fetcher.ts  agent-style.ts  utils.ts
stores/workspace.ts
types/{index.ts,next-auth.d.ts}
```

---

## Non-negotiable rules (enforced in code)

1. **App Router only.** No `pages/`.
2. **Encrypt API keys** with `lib/encryption.ts` before insert; never return the
   raw key — list endpoints return a masked `keyPreview` only.
3. **Every DB query filters by `userId`** from the session. Project/task routes
   verify ownership via `lib/authz.ts` (`getOwnedProject` / `getOwnedTask`,
   which join through `clients.userId`).
4. **Never log API keys** anywhere.
5. **Streaming via SSE** for chat (Phase 2).
6. **Drizzle only**, no raw SQL.

API route auth pattern: `getSessionUserId()` → `unauthorized()` if null →
scope/verify by that id.

---

## Environment

`.env.local` (gitignored). See `.env.example`. Required:
`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ENCRYPTION_KEY`
(`openssl rand -hex 32`). Optional (OAuth): `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`.

Email/password sign-in works with **no OAuth keys** (the keyless path). To enable
the social buttons:
- Google: console.cloud.google.com → APIs & Services → Credentials → OAuth client
  ID (Web) → redirect URI `http://localhost:3000/api/auth/callback/google`.
- GitHub: github.com/settings/developers → New OAuth App → callback URL
  `http://localhost:3000/api/auth/callback/github`.

---

## Commands

```bash
npm run dev                                  # dev server
npm run build                                # prod build (also typechecks + lints)
DATABASE_URL=... npx drizzle-kit generate    # create migration after schema change
DATABASE_URL=... npx drizzle-kit push        # push schema to Neon (dev)
DATABASE_URL=... npx drizzle-kit studio      # DB GUI
```

drizzle-kit does not auto-load `.env.local`; prefix with the var or
`set -a; . ./.env.local; set +a` first.

---

## Git / committing

- Branch off `main`; keep commits scoped and conventional
  (`feat:`, `fix:`, `chore:`, `docs:`).
- Never commit secrets — `.env*.local` is gitignored.
- Ask before schema changes and before adding deps outside the stack above.

---

## Status

**Phase 1 — Foundation: ✅ complete & building.**
- Project scaffold, Tailwind v4 + shadcn(base-ui), design system applied.
- Drizzle schema (8 tables) pushed to Neon.
- NextAuth v5: Google + GitHub OAuth and email/password (scrypt) login + JWT,
  user upsert, route guards, `/api/auth/register`.
- AES-256-GCM key encryption.
- Sidebar/topbar shell, workspace switcher, dashboard.
- Client CRUD, Project CRUD + agent assignment, Agent registry (encrypted).
- Kanban board with @dnd-kit (drag between Backlog/In Progress/Review/Done).
- Task detail page with Phase-2 chat placeholder.

**Next — Phase 2 (single-agent streaming chat):** SSE endpoint at
`/api/tasks/[taskId]/chat`, chat UI, project context injection, one Claude agent.
Then **Phase 3** multi-agent orchestration (`lib/orchestrator/`).

One deviation from the PRD data model: `users.image` was added to store the
Google avatar (used in the user menu). Everything else matches `docs/PRD.md` §8.
