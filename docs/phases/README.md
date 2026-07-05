# Mosaic — Phase Documentation

> One folder that answers three questions for every build phase:
> **what we set out to do**, **what is actually done**, and **what is left**.
> Each phase file also carries the *architecture as it stood at that phase* and
> flags **where the architecture or a diagram changed** from an earlier phase.

Read order for a newcomer: this file → the phase you care about. The canonical
living specs remain `../PRD_NEW.md`, `../ARCHITECTURE_NEW.md`,
`../DESIGN_SYSTEM.md`, `../AGENTS.md`; the phase files below are the *narrative +
status* layer on top of them.

---

## 1. Status at a glance

| Phase | Title | Status | Done | File |
|------:|-------|--------|-----:|------|
| 1 | Foundation | ✅ Complete | 100% | [phase-1-foundation.md](./phase-1-foundation.md) |
| 2 | Agent Sessions & Webhook Protocol | ✅ Complete | 100% | [phase-2-sessions-and-rooms.md](./phase-2-sessions-and-rooms.md) |
| 2.5 | Multi‑Agent Rooms & Connectors *(added scope)* | ✅ Complete | ~95% | [phase-2-sessions-and-rooms.md](./phase-2-sessions-and-rooms.md) |
| 3 | Integrations & Direct Chat | 🟡 Partial (reframed as Connectors) | ~40% | [phase-3-integrations.md](./phase-3-integrations.md) |
| 4 | Polish, Orchestration & Scale | ⬜ Planned | 0% | [phase-4-polish-and-scale.md](./phase-4-polish-and-scale.md) |
| 5+ | Future | ⬜ Ideas | — | [roadmap.md](./roadmap.md) |

Legend: ✅ done · 🟡 partial · ⬜ not started.

---

## 2. Done vs Remaining (master table)

| Area | Done ✅ | Remaining ⬜ |
|------|--------|-------------|
| **Foundation** | Next.js 14 + Tailwind v4 + base‑ui shadcn; Neon + Drizzle; NextAuth (Google + GitHub + email/password); client/project/agent CRUD; Kanban board | — |
| **Sessions** | `agent_sessions`, token + bootstrap prompt, full webhook protocol (`/next`, `/stream`, `/comments`, `/attention`, `/poll`, `/resume`, `/complete`, `/heartbeat`), long‑poll (2s loop, 90s cap), SSE task stream, live task chat, status dots, offline cron | Native browser push notifications for attention (only in‑app cards/dots today) |
| **Multi‑agent rooms** | One room per project, participants + default/lead, room chat with attribution, `/room/{participants,messages,poll,ask}`, agent‑to‑agent task dispatch + async callback re‑queue, unified inbox (`/next?inbox=1`) | Server‑driven orchestration option (currently cooperative via bootstrap) |
| **Connectors** | Client‑scoped connectors (Slack/Gmail/Google/WhatsApp/GitHub/Custom), encrypted secret, browser CRUD, agent fetch endpoint, `/connectors` page | Real OAuth flows (today: manual creds); server‑side send actions |
| **Tasks** | Richer New‑Task dialog (bookmark, park, before‑agent `/compact`//`/clear`, attach), per‑task timestamped YOU/AGENT chat, "Added by"/"Assigned to", requeue‑on‑reply | — |
| **Files** | Vercel Blob upload (`/api/tasks/[id]/attachments`), dialog drop/paste/click, task‑page list, agent `files[]` on `/next` | Retention/cleanup cron (24h‑after‑done sweep); needs `BLOB_READ_WRITE_TOKEN` set |
| **Review** | `/review` page listing bookmarked tasks across clients, un‑bookmark | — |
| **Dashboard** | Overview (active sessions, attention cards), topbar/sidebar status | Live session status **grid**, richer metrics |
| **Scale / infra** | Single‑instance in‑memory SSE pub/sub; Vercel cron | Multi‑instance SSE (Vercel KV / Neon `LISTEN/NOTIFY`); production deploy |
| **Integrations (Phase 3/4)** | — | GitHub/Slack OAuth, Slack notifications, Jira import, custom webhooks |
| **Orchestration traces** | `orchestration_traces` table exists (unused) | Primary→secondary→merge traces UI (superseded by rooms — see change log) |

---

## 3. Migration history (source of truth = `lib/db/migrations/`)

| Migration | Phase | What it added |
|-----------|-------|---------------|
| `0000_init` | 1 | Core tables: users, clients, agent_accounts, projects, project_agents, tasks, task_messages, orchestration_traces |
| `0001_add_password_hash` | 1 | `users.password_hash` (email/password auth) |
| `0002_agent_sessions` | 2 | `agent_sessions`, `session_messages`, `task_attachments`; `tasks.claimed_by_session_id`/`attention_message`/`result`; `task_messages.session_id`/`is_stream_chunk` |
| `0003_session_rooms` | 2.5 | `agent_sessions.is_default`; `tasks.assigned_session_id`; `room_messages` (+ indexes); default‑agent backfill |
| `0004_task_origin_session` | 2.5 | `tasks.origin_session_id` (ask reply‑to) |
| `0005_task_ask_callback` | 2.5 | `tasks.origin_task_id` + `created_by_session_id` (async ask callback + "who added") |
| `0006_session_room_cursor` | 2.5 | `agent_sessions.room_cursor_at` (unified inbox cursor) |
| `0007_connectors` | 2.5 | `connectors` (client‑scoped external services) |
| `0008_task_flags` | 2.5 | `tasks.bookmarked` / `clear_before` / `compact_before` |

> ⚠️ **DB is `drizzle-kit push`‑managed** — the migrations tracking table is empty,
> so `drizzle-kit migrate` replays from `0000` and fails. Apply new migrations via
> `drizzle-kit push` or direct SQL (see the migrations note in the team memory).
> Migrations `0003–0008` were applied to Neon directly.

---

## 4. Architecture change log (cross‑phase)

The single most important thing this folder tracks — **where the architecture
moved between phases.** Full detail lives in each phase file; this is the index.

| # | Change | Phase | Where |
|--:|--------|-------|-------|
| A1 | **Orchestration model pivot.** PRD v1 Phase 3 planned *server‑side* orchestration (primary agent → secondary reviewers → merged answer, recorded in `orchestration_traces`). We instead built **multi‑agent rooms**: real external agent processes talk to each other via **task dispatch** (`/room/ask`). `orchestration_traces` remains in the schema but is **unused**. | 2.5 | phase‑2 §"Change: orchestration" |
| A2 | **Integrations → Connectors.** PRD/ARCHITECTURE named a `client_integrations` table with GitHub/Slack **OAuth**. We shipped a broader, client‑scoped **`connectors`** table (Slack/Gmail/WhatsApp/…) with a manually‑entered encrypted secret the agent fetches. OAuth is deferred to Phase 3. | 2.5 | phase‑3 §"Change: integrations" |
| A3 | **`/next` became a unified inbox.** Originally `/next` returned only tasks. It now optionally (`?inbox=1`) returns **either** a task **or** the user's room‑chat message, so a single long‑poll drives both. Response gained a `type` discriminator. | 2.5 | phase‑2 §"Change: unified inbox" |
| A4 | **Direct session chat removed.** PRD Phase 3 listed "direct chat with a session"; we built it (`session_messages`, `/sessions/[id]/chat`) then **removed the UI** in favour of the room + per‑task chat. `session_messages` + the webhook `/chat` routes remain but are dormant. | 2.5 | phase‑2 §"Change: chat surface" |
| A5 | **SSE is now project‑keyed too.** The in‑memory pub/sub was keyed only by `taskId`; it now also serves a `room:<projectId>` channel for room chat. Still single‑instance (Phase 4 replaces it). | 2.5 | phase‑2 §"Change: SSE channels" |
| A6 | **Base URL derives from the request.** The bootstrap prompt's callback base was hard‑coded to `NEXTAUTH_URL`/localhost; it now derives from the request host (`X‑Forwarded‑*`), overridable by `APP_URL`. | 2.5 | phase‑2 §"Change: base URL" |
| A7 | **Task attachments went live.** Upload was deferred in Phase 2; Vercel Blob upload is now wired end‑to‑end. | 2.5 | phase‑2 §"Files" |

System‑overview and session‑lifecycle diagrams (from `ARCHITECTURE_NEW.md`) are
reproduced and **annotated with these deltas** inside the phase‑2 file.

---

## 5. Roadmap summary

- **Phase 3 — Integrations & Direct Chat:** real GitHub/Slack **OAuth** per client
  (building on connectors), Slack notifications on attention/complete,
  integration‑aware session actions, Jira one‑way import.
- **Phase 4 — Polish, Orchestration & Scale:** live session **grid** dashboard,
  multi‑instance SSE (KV / `LISTEN/NOTIFY`), attachment retention cron, custom
  webhooks, error/empty/loading polish, production deploy, README + demo.
- **Phase 5+ (ideas):** see [roadmap.md](./roadmap.md) — server‑assisted
  orchestration/judging, mobile, team/multi‑user, billing.

See [roadmap.md](./roadmap.md) for the detailed pre‑plan of every future phase.
