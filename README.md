# Mosaic

**A multi-client, multi-agent AI orchestration workspace.**
Pieces come together — one interface for every client, project, and AI agent.

Instead of juggling terminals, browser tabs, and AI tools across clients, you
open Mosaic, send a task, and the right agents for that project collaborate
behind the scenes to return one merged, high-quality answer.

---

## ✨ Features

- **Clients & Projects** — organize work in a client → project tree with
  per-project standing context injected into every agent call.
- **Agent registry** — connect Anthropic, OpenAI, GitHub Copilot, or any
  OpenAI-compatible endpoint by API key. Keys are **encrypted at rest**
  (AES-256-GCM) and never returned to the client.
- **Kanban task board** — drag tasks across Backlog → In Progress → Review →
  Done (`@dnd-kit`).
- **Multi-agent orchestration** *(Phase 3)* — a primary agent drafts, secondary
  agents critique, the primary merges into a final answer, streamed over SSE.

---

## 🧱 Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (base-ui) ·
Drizzle ORM · Neon (Postgres) · NextAuth v5 (Google) · Vercel AI SDK ·
Zustand · React Query · @dnd-kit · SSE.

---

## 🚀 Getting started

```bash
npm install
cp .env.example .env.local      # then fill in the values

# push the schema to your Neon database
set -a; . ./.env.local; set +a
npx drizzle-kit push

npm run dev                     # http://localhost:3000
```

### Environment variables

| Var | Description |
|-----|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` in dev |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client (redirect: `/api/auth/callback/google`) |
| `ENCRYPTION_KEY` | 32-byte hex, `openssl rand -hex 32` |

---

## 📂 Docs

- [`CLAUDE.md`](./CLAUDE.md) — working architecture notes & current status
- [`docs/AGENTS.md`](./docs/AGENTS.md) — contributor rules
- [`docs/PRD.md`](./docs/PRD.md) — product spec
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system design & data flow
- [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — visual system

---

## 🗺️ Roadmap

- [x] **Phase 1** — Foundation: auth, schema, client/project/agent CRUD, Kanban
- [ ] **Phase 2** — Single-agent streaming chat (SSE)
- [ ] **Phase 3** — Multi-agent orchestration + trace view
- [ ] **Phase 4** — Dashboard polish, more providers, deploy

---

*Mosaic — pieces come together.*
