# Phase 4 — Polish, Orchestration & Scale

**Status:** ⬜ Planned (0%). This phase hardens what exists and lifts the
single‑instance / cooperative‑orchestration limitations for production.

---

## Done vs Remaining

| Item | Status |
|------|--------|
| Everything below | ⬜ Not started |

| Planned item | Why it's here |
|--------------|---------------|
| **Live session status grid** on the dashboard | PRD Phase 4; today we have overview cards + status dots, not a grid |
| **Multi‑instance SSE** (Vercel KV or Neon `LISTEN/NOTIFY`) | current pub/sub is in‑memory on `globalThis` → single instance only |
| **Attachment retention cron** (sweep files 24h after task done) | `task_attachments.expires_at` is set but nothing sweeps it |
| **Server‑assisted orchestration** (optional) | today collaboration is *cooperative* (bootstrap‑driven); a server loop could drive/verify multi‑agent rounds |
| **Multi‑session parallelism / fan‑out** for one complex task | PRD Phase 4 |
| **Jira sync** (import issues as tasks) | PRD §12.3 |
| **Custom webhook out** (task_complete / attention_raised / session_offline) | PRD §12.4 |
| **Native browser push** notifications (attention) | carried over from Phase 2 |
| Error / loading / empty states pass throughout | PRD Phase 4 |
| **Production deploy** (Vercel + Neon prod) | PRD Phase 4 |
| README, demo GIF, portfolio writeup | PRD Phase 4 |

---

## The two load‑bearing items

### 1. Multi‑instance SSE (the real scaling blocker)
`lib/sse/broadcast.ts` keeps subscribers in a `Map` on `globalThis`. That works
for one Node instance but breaks the moment Vercel runs more than one: a session
POSTing a `chunk` on instance A won't reach a browser subscribed on instance B.

**Plan:** replace the in‑memory channel with a shared bus:
- **Option A — Neon `LISTEN/NOTIFY`:** `broadcast()` does `NOTIFY channel, payload`;
  each instance holds a `LISTEN` connection and fans out to its local
  subscribers. No new infra.
- **Option B — Vercel KV / Upstash pub/sub:** publish to a channel; instances
  subscribe. Simple, another dependency.

Both keep the `subscribe/unsubscribe/broadcast(channel, type, data)` interface
(channels already generalised to `taskId` and `room:<projectId>`), so route code
is untouched. **Architecture change to log when done:** the "Session Manager /
SSE fan‑out" box in the System Overview gains an external bus; note it in the
change log in `README.md`.

### 2. Long‑poll → true pub/sub wakeup
`/next`, `/poll`, `/room/poll`, `/chat/poll` use a **2s DB poll loop up to 90s**.
`ARCHITECTURE_NEW.md` (line ~184) already flags this: replace with a proper
pub/sub wakeup so a new task wakes the long‑poll in <500ms instead of up to 2s.
Ties into the same shared bus as item 1.

---

## Optional: server‑assisted orchestration

Today, multi‑agent debate is **cooperative** — Mosaic provides the bus (room +
`/room/ask` + async callback) and the *bootstrap prompt* drives the rounds. A
misbehaving terminal can't be forced. Phase 4 could add an optional **server
orchestrator** that:
- drives N rounds of ask/verify itself (create ask‑tasks, wait, judge),
- records rounds in the **dormant `orchestration_traces`** table (finally using
  it — see change A1), and
- surfaces a trace view in the task UI.

This would be a *second* orchestration mode alongside the cooperative one, not a
replacement. **Log it as a new architecture change** if built.

---

## Deploy checklist (when shipping)
- Env: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ENCRYPTION_KEY`,
  `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, `APP_URL`, OAuth keys.
- Move migrations onto a real `drizzle-kit migrate` baseline (currently push‑
  managed — see `README.md` §3 warning).
- Swap SSE to the shared bus (item 1) before scaling beyond one instance.
- Verify cron (`/api/cron/session-health`) is registered in `vercel.json`.
