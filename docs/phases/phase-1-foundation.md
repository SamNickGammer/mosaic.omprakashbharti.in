# Phase 1 — Foundation

**Status:** ✅ Complete · **Commits:** `f3d9e62` (scaffold), `5b984a2` (foundation), `7db90ca` (auth)

---

## Done vs Remaining

| Item | Status |
|------|--------|
| Next.js 14 (App Router) + TypeScript strict scaffold | ✅ |
| Tailwind v4 + shadcn/ui on **base‑ui** (not Radix), dark theme, design tokens | ✅ |
| Neon (serverless Postgres) + Drizzle ORM schema & migrations | ✅ |
| NextAuth v5 — Google + GitHub OAuth **and** email/password (scrypt) + JWT | ✅ |
| AES‑256‑GCM encryption for agent API keys | ✅ |
| Client CRUD (UI + API) | ✅ |
| Project CRUD + agent assignment | ✅ |
| Agent registry (encrypted keys, masked previews) | ✅ |
| Kanban board with `@dnd-kit` (Backlog/In‑Progress/Review/Done) | ✅ |
| Sidebar / topbar shell, workspace switcher, dashboard overview | ✅ |
| Task detail page (chat placeholder at the time) | ✅ |
| **Remaining** | — nothing; foundation is closed |

---

## Goal

Stand up the multi‑client workspace shell: auth, data model, encrypted agent
credentials, and a Kanban task board — everything the later "live agent" phases
build on. No live agents yet.

## What was built

- **Auth.** NextAuth v5 with three sign‑in paths (Google, GitHub, email/password
  hashed with Node `scrypt`). JWT sessions, user upsert, route guards,
  `/api/auth/register`. `trustHost: true`. Config in `lib/auth.ts`,
  `lib/password.ts`.
- **Data isolation.** Every query is scoped by `userId` from the session. Project
  and task routes verify ownership by joining through `clients.userId` (see
  `lib/authz.ts`).
- **Encryption.** Agent API keys are encrypted with AES‑256‑GCM
  (`lib/encryption.ts`) before insert; list endpoints only ever return a masked
  `keyPreview`.
- **CRUD.** Clients, projects (+ agent assignment), and an agent registry.
- **Board.** Kanban with drag‑and‑drop across the four task statuses.
- **Shell.** Sidebar (client → project tree), topbar (client switcher), dashboard.

## Architecture at Phase 1

**Stack** (also in root `CLAUDE.md`):

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14.2 App Router (`app/` only) |
| Language | TypeScript strict, `target: ES2022` |
| Styling | Tailwind CSS v4 (tokens in `app/globals.css` `@theme inline`; **no** `tailwind.config.ts`) |
| UI | shadcn/ui on `@base-ui/react` (composition via `render={<El/>}`, not `asChild`) |
| Server state | `@tanstack/react-query` (`hooks/queries.ts`) |
| Client state | `zustand` (`stores/workspace.ts`) |
| DB / ORM | Neon Postgres + Drizzle (`lib/db/schema.ts` = source of truth) |
| Auth | NextAuth v5, JWT |
| Encryption | Node `crypto` AES‑256‑GCM |
| DnD | `@dnd-kit/*` |

**Data model (migrations `0000`, `0001`):**

```
users ──< clients ──< projects ──< tasks ──< task_messages
  │                        │
  │                        └──< project_agents >── agent_accounts
  └──< agent_accounts (encrypted api_key)
tasks ──< orchestration_traces   (defined here, used by no phase yet)
```

Columns of note: `users.password_hash` (0001), `users.image` (Google avatar —
one deviation from the PRD data model), `agent_accounts.api_key_encrypted`.

**Route map (browser, NextAuth):** `/api/auth/[...nextauth]`,
`/api/clients` (+`[id]`, +`[id]/projects`), `/api/projects/[id]` (+`/tasks`),
`/api/tasks/[id]`, `/api/settings/agents` (+`[id]`).

**Pages:** `(auth)/login`, `(dashboard)/` (guarded layout + sidebar + topbar),
dashboard overview, `clients/[clientId]/projects/[projectId]` (board),
`.../tasks/[taskId]`, `settings/agents`.

## Design system

Dark theme by default (`<html className="dark">`), Inter (sans) + Geist Mono
(code/keys/traces). Tokens live in `app/globals.css`. Full system in
`../DESIGN_SYSTEM.md`. **Unchanged by later phases** except additive utilities
(`.no-scrollbar`, gradient helpers).

## Deviations from PRD

- `users.image` added (Google avatar for the user menu).
- Email/password + GitHub OAuth added on top of the PRD's Google‑only login.

## Architecture / diagram changes introduced here

None — Phase 1 *is* the baseline the diagrams describe. First real change is in
Phase 2.5 (see [phase-2-sessions-and-rooms.md](./phase-2-sessions-and-rooms.md)).
