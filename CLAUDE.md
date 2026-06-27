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
| Markdown | `react-markdown` + `remark-gfm` | agent/assistant output rendered rich (`components/markdown.tsx`); Tailwind-styled, no typography plugin |
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

If you hit `Cannot find module './vendor-chunks/*.js'` in dev, the `.next` cache
is stale (usually from interleaving `next build` and `next dev`). Fix: stop the
dev server, `rm -rf .next`, restart.

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

**Phase 2 — Single-agent streaming chat: ✅ complete & building.**
- `lib/orchestrator/` — `loadPrimaryAgent` (decrypts per-agent key), `buildSystemPrompt`
  (injects project context), `providers/anthropic.ts` (Vercel AI SDK).
- `POST /api/tasks/[taskId]/chat` — SSE (named events per ARCHITECTURE.md:
  `primary_start` → `primary_stream` → `primary_done` → `done`, plus `error`).
  Node runtime; saves user + assistant rows to `task_messages`.
- `GET /api/tasks/[taskId]/messages` — chat history (excludes traces).
- `components/chat/task-chat.tsx` — streaming chat UI in the task detail right panel.
- ⚠️ Gotcha: AI SDK v7 `result.textStream` **swallows** provider errors (ends
  empty). Consume `result.fullStream` and handle `text-delta` (`.text`) and
  `error` (`.error`) parts — that's how the route surfaces failures as SSE `error`.
- Note: all task API routes use the `[taskId]` slug (Next forbids mixing `[id]`/
  `[taskId]` at the same path).

**Agent Sessions & Webhook Protocol (PRD v2 Phase 2): ✅ complete & building, e2e-verified.**
Live AI sessions (Claude Code / Codex) connect to a project via a 40-char bearer
token and run a long-poll work loop. This supersedes the direct-call chat on the
task page (the legacy `/api/tasks/[taskId]/chat` + `components/chat/task-chat.tsx`
remain for quick one-off agent-account calls).

- Schema: `agent_sessions`, `task_attachments`, `session_messages`; `tasks` gained
  `claimed_by_session_id` / `attention_message` / `result`; `task_messages` gained
  `session_id` / `is_stream_chunk` (and `role` now doubles as author kind, with
  `"agent"`/`"system"` added — exposed as `authorKind` in session APIs).
- Webhook routes (token-auth only, no NextAuth) under `app/api/sessions/[token]/`:
  `next` (long-poll claim), `heartbeat`, `chat`(+`/poll`), and
  `tasks/[taskId]/{stream,comments,attention,poll,resume,complete}`. Long-poll =
  2s DB poll up to 90s (`lib/session-auth.ts`).
- Browser routes (NextAuth + ownership via `getOwnedSession`/`getOwnedProject`):
  `GET/POST /api/projects/[id]/sessions` (create returns token + bootstrap once),
  `DELETE /api/sessions/[token]` (param is a session *id* here — revoke nulls the
  token), `POST /api/tasks/[id]/messages` (user reply), `GET /api/tasks/[id]/stream`
  (SSE), `/api/sessions-chat/[sessionId]` (direct-chat wrapper), `/api/overview`.
- SSE: in-memory pub/sub keyed by taskId (`lib/sse/broadcast.ts`, on globalThis).
  Events: `chunk` / `attention` / `complete` / `status` (named events, per
  ARCHITECTURE_NEW.md). Browser uses `EventSource`. Single-instance only —
  KV/LISTEN-NOTIFY deferred to Phase 4.
- Cron: `vercel.json` → `/api/cron/session-health` every 2 min, marks sessions
  offline after 5 min (auth `Bearer ${CRON_SECRET}`).
- UI: sessions page + New Session modal (bootstrap prompt + copy), task workspace
  with live streamed output / attention + complete banners / user replies, direct
  session chat page, dashboard attention cards + active-session stat, sidebar +
  topbar session status dots. Session statuses in `lib/session-meta.ts`.
- ⚠️ CRITICAL: the neon client is created with `fetchOptions: { cache: "no-store" }`
  (`lib/db/index.ts`). Next.js patches global `fetch` and will cache the neon-http
  driver's responses — without no-store, long-polls (`/next`, `/poll`,
  `/chat/poll`) re-run the same query and keep getting their first stale result,
  so new tasks/comments are never seen and revoked tokens still appear valid.
  Never remove this.
- Re-queue on reply: `POST /api/tasks/[id]/messages` re-queues the task
  (status→in_progress, claimed→null, attention cleared) **unless** a live session
  is actively working it. `/next` then re-claims with the follow-up `comments[]`
  and the `previousResult`. This is why chatting on a *done* task gets a response.
- Slug note: everything under `/api/sessions/*` shares the `[token]` segment name
  (Next requires one slug per path); the browser DELETE reuses it as a session id.
- Deferred (needs `@vercel/blob`, will ask first): actual attachment **upload**.
  The `task_attachments` table + `files` in `/next` + UI display are wired.
- New env: `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` (see `.env.example`).

**Next — Phase 3** integrations (GitHub/Slack per client), plus the older
multi-agent orchestration (primary → secondary → merge) and `orchestration_traces`.

One deviation from the PRD data model: `users.image` was added to store the
Google avatar (used in the user menu). Everything else matches `docs/PRD.md` §8.
