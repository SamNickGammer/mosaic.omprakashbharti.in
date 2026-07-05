# Phase 2 — Agent Sessions & Webhook Protocol  ·  Phase 2.5 — Multi‑Agent Rooms

**Status:** ✅ Complete (Phase 2) · ✅ ~95% (Phase 2.5 added scope)
**Commits:** `4ec95f8` (sessions), `6e41fd1` (rooms), `935aa75` (connectors/review/upload)

This file covers two things that shipped together:
- **Phase 2** — the webhook protocol that lets a *live* Claude Code / Codex
  process connect to a project and run a work loop (the PRD‑planned scope).
- **Phase 2.5** — **added scope**: turning single sessions into a **multi‑agent
  room** where agents talk to each other, plus connectors, review, richer tasks
  and file upload. This is where most of the architecture changed.

---

## Done vs Remaining

| Item | Phase | Status |
|------|:----:|--------|
| `agent_sessions` + token + bootstrap prompt (copy‑once) | 2 | ✅ |
| Webhook protocol: `/next` `/heartbeat` `/tasks/[id]/{stream,comments,attention,poll,resume,complete}` | 2 | ✅ |
| Long‑poll (2s DB loop, 90s cap) in `/next` and `/poll` | 2 | ✅ |
| SSE task stream → browser (`chunk`/`attention`/`complete`/`status`) | 2 | ✅ |
| Live task chat UI (streamed output, attention/complete banners, reply → requeue) | 2 | ✅ |
| Session statuses (idle/working/needs_attention/offline) + dots | 2 | ✅ |
| Offline cron (`/api/cron/session-health`, 5‑min threshold) | 2 | ✅ |
| One **room per project**, participants, one **default/lead** | 2.5 | ✅ |
| Room chat with per‑agent attribution (`room_messages`) | 2.5 | ✅ |
| `/room/{participants,messages,poll,ask}` webhook routes | 2.5 | ✅ |
| **Agent‑to‑agent dispatch** (`/room/ask`) + **async callback** re‑queue | 2.5 | ✅ |
| **Unified inbox** (`/next?inbox=1` delivers tasks *or* chat) | 2.5 | ✅ |
| Task attribution: `created_by_session_id` ("Added by"), `assigned_session_id` | 2.5 | ✅ |
| Quiet/permanent bootstrap loop (no idle chatter, never self‑terminate) | 2.5 | ✅ |
| Per‑task chat = full **timestamped YOU/AGENT** history | 2.5 | ✅ |
| **File upload** (Vercel Blob) + task‑page attachment list | 2.5 | ✅ |
| Native browser **push** notification for attention | 2 | ⬜ (in‑app cards/dots only) |
| Server‑driven orchestration (vs cooperative bootstrap) | — | ⬜ (Phase 4) |
| Multi‑instance SSE | — | ⬜ (Phase 4) |

---

## Part A — Phase 2: the webhook protocol

### Goal
A developer pastes one prompt into a terminal running inside the real project
folder; that process then pulls tasks from Mosaic, streams its work back, asks
for input when stuck, and reports results — over plain HTTP long‑poll + POST.

### Session lifecycle
1. User creates a session → Mosaic generates a **40‑char hex token** (stored
   plain; nullable so *revoke* = set null) and a **bootstrap prompt**
   (`lib/bootstrap-prompt.ts`). Token + prompt returned **once**.
2. User pastes the prompt into Claude Code / Codex in the project folder.
3. The agent runs the work loop (long‑poll `/next`, do task, stream, complete).

### Webhook routes (token‑auth only, no NextAuth) — `app/api/sessions/[token]/**`
Auth via `verifySessionToken` (`lib/session-auth.ts`); task routes also
`loadTaskForSession` (same‑project guard). Runtime `nodejs`, long‑poll routes
`maxDuration = 90`.

| Route | Method | Purpose |
|-------|:------:|---------|
| `next` | GET | Long‑poll: claim oldest claimable task → task JSON, or 204. Piggyback heartbeat. |
| `heartbeat` | POST | Update `last_seen_at` + status. |
| `tasks/[taskId]/stream` | POST | Append a streamed output chunk → SSE `chunk`. |
| `tasks/[taskId]/comments` | POST | Post a discrete agent comment → SSE `chunk`. |
| `tasks/[taskId]/attention` | POST | Raise a flag → SSE `attention`, status `needs_attention`. |
| `tasks/[taskId]/poll` | GET | Long‑poll for user replies / status change. |
| `tasks/[taskId]/resume` | POST | Clear attention → SSE `status`. |
| `tasks/[taskId]/complete` | POST | Mark done + result → SSE `complete`. |
| `chat`, `chat/poll` | POST/GET | Direct session chat (now **dormant**, see change A4). |

### Browser routes
`GET/POST /api/projects/[id]/sessions` (create returns token+bootstrap once),
`GET /api/tasks/[id]/messages`, `GET /api/tasks/[id]/stream` (SSE),
`POST /api/tasks/[id]/messages` (reply, re‑queues if the session went offline),
`GET /api/overview`, `GET /api/cron/session-health` (`Bearer CRON_SECRET`).

### Data flow (task)
`user creates task → status in_progress → session /next claims it → streams
chunks (SSE chunk → browser) → optionally raises attention (SSE attention) →
completes (SSE complete)`. SSE is an **in‑memory pub/sub keyed by taskId**
(`lib/sse/broadcast.ts`, on `globalThis`).

### Schema (migration `0002`)
`agent_sessions`, `session_messages`, `task_attachments`; `tasks` gained
`claimed_by_session_id` / `attention_message` / `result`; `task_messages` gained
`session_id` / `is_stream_chunk` (and `role` doubles as author kind, adding
`agent`/`system`).

---

## Part B — Phase 2.5: Multi‑Agent Rooms (added scope)

The pivot from "each session is an isolated silo" to "a project is one **room**
with multiple agent participants that can address and help each other."

### Model
- **One room per project.** Participants = `agent_sessions` rows. Exactly one is
  the **default (lead)** (`agent_sessions.is_default`).
- **Room chat** = `room_messages` (project‑scoped): `author_kind` (user|agent),
  `author_session_id`, `mention_session_id` (who it's addressed to; null = the
  default / broadcast), `content`. Every message is attributed.
- **Directed delivery.** A participant receives messages addressed to it; the
  **default** also receives unaddressed user questions.

### Room webhook routes — `app/api/sessions/[token]/room/**`
| Route | Method | Purpose |
|-------|:------:|---------|
| `participants` | GET | Who else is in the room (ids to address them). |
| `messages` | POST | Post to the room (`to` = optional participant id). |
| `poll` | GET | Long‑poll for messages addressed to me (+ unaddressed if default). |
| `ask` | POST | **Dispatch a task to another agent** (see below). |
| `connectors` | GET | This client's connectors (decrypted) — see phase‑3 file. |

### The agent‑to‑agent mechanism (the important part)
Every agent parks on `/next` waiting for **tasks** — it will *not* see a room
chat message. So making Claude "ask Codex" reliably means the ask must arrive as
a **task**:

1. Claude → `POST /room/ask {to, question, fromTaskId}` → Mosaic creates a task
   **assigned to Codex** (`assigned_session_id`), records `origin_session_id` =
   Claude and `origin_task_id` = Claude's current task, and mirrors the ask into
   room chat.
2. Codex's `/next` claims it instantly (assigned tasks only go to their agent),
   does it, `/complete`s.
3. On complete, Mosaic **mirrors the result** into room chat (attributed
   *Codex → Claude*) **and** — because `origin_task_id` is set — **re‑queues
   Claude's original task** with Codex's reply attached as an `agent` comment.
4. Claude re‑claims its task via `/next`, sees `previousResult` + the peer reply
   in `comments[]`, folds it in, posts the master answer, completes.

This is the **async callback** — Claude can finish its own work first and get
re‑woken when Codex replies, instead of blocking. Termination is lead‑agent
driven (cap ~3 rounds in the prompt).

### Unified inbox — **change A3**
`/next?inbox=1` now also returns the **user's** room‑chat messages, so the
default agent's single long‑poll handles both tasks and chat:
- Response gained a `type` discriminator: `"task"` or `"message"`.
- Per‑session cursor `agent_sessions.room_cursor_at` (set to "now" on first inbox
  poll → no backlog flood; advanced as messages are delivered).
- Only **user** messages ride the inbox (`userOnly`); agent‑to‑agent stays on
  tasks → no double‑handling. Gated on `?inbox=1` so old agents are unaffected.

### Schema (migrations `0003`–`0006`)
- `0003` — `agent_sessions.is_default`; `tasks.assigned_session_id`;
  `room_messages` (+ `project_created` / `mention` indexes); default backfill.
- `0004` — `tasks.origin_session_id` (ask reply‑to).
- `0005` — `tasks.origin_task_id` + `created_by_session_id`.
- `0006` — `agent_sessions.room_cursor_at`.

### Tasks & chat UX (this phase)
- **New Task dialog** redesigned to match the target design: bookmark‑for‑review,
  park‑it (queue vs backlog), before‑agent `Run as‑is / /compact / /clear`,
  instruction char‑count + ⌘+Enter, and file attach. Flags are migration `0008`
  (`tasks.bookmarked` / `clear_before` / `compact_before`); `/next` now returns
  the real `clearBefore`/`compactBefore` (previously hard‑coded `false`).
- **Per‑task chat** now renders full history as a **timestamped log** with
  YOU / AGENT headers, resolving *which* agent spoke (so a Claude↔Codex exchange
  shows both by name). Reply still re‑queues the task.
- **"Added by" / "Assigned to"** shown from `created_by_session_id` /
  `assigned_session_id`.

### Files — **change A7**
Vercel Blob upload wired end‑to‑end: `POST/GET /api/tasks/[id]/attachments`
(browser, owner‑scoped, 50 MB cap, 7‑day retention hint), dialog drop/paste/
click uploading right after Save, task page lists attachments as links, agents
receive them via `files[]` on `/next`. Requires `BLOB_READ_WRITE_TOKEN`.

### Bootstrap prompt (Quiet Mode)
`lib/bootstrap-prompt.ts` was rewritten to be **quiet and permanent**: silent on
idle/errors/5xx, never self‑terminate or "summarize and halt", one short line
only on real signal, heartbeat only during long task work. It also encodes the
room protocol, the ask/debate pattern, connectors, and context flags. It's
personalized per agent (name, type, default flag) and its callback base URL now
derives from the request host (**change A6**, `lib/base-url.ts`, `APP_URL`
override).

---

## Architecture / diagram changes introduced (annotated)

The `ARCHITECTURE_NEW.md` **System Overview** still holds, with these deltas:

```
NEON DB — add:  room_messages, connectors
              tasks += assigned/origin/created_by/bookmarked/clear/compact
              agent_sessions += is_default, room_cursor_at
Session Webhook Routes — add:  /room/{participants,messages,poll,ask}, /connectors
Browser Routes — add:  /projects/[id]/room(+/stream), /clients/[id]/connectors,
                       /tasks/[id]/attachments, /review
SSE pub/sub — now keyed by taskId  OR  room:<projectId>        ← change A5
/next — now a unified inbox (task | message)                  ← change A3
Session Lifecycle — the loop can now: ask a peer (task dispatch),
                    be re‑woken by an async callback,
                    receive user chat inline (inbox).
```

- **A1 — Orchestration pivot.** PRD v1 Phase 3 orchestration (primary→secondary→
  merge via `orchestration_traces`) is **replaced** by rooms. `orchestration_traces`
  stays in the schema, unused.
- **A3 — Unified inbox** (above).
- **A4 — Direct chat removed.** `session_messages` + `/chat` routes remain but the
  UI (`/sessions/[id]/chat`) was deleted; conversation now happens in the room
  and per‑task chat.
- **A5 — SSE project channel** (above).
- **A6 — Request‑derived base URL** (above).
- **A7 — Blob upload live** (above).

---

## Remaining in this phase
- Native browser **push** notifications for attention (only in‑app today).
- Attachment **retention cron** (sweep 24h after done) — table has `expires_at`.
- Server‑driven orchestration option (today collaboration is cooperative — it
  only works because each pasted bootstrap follows the protocol). → Phase 4.
- Multi‑instance SSE. → Phase 4.
