# Mosaic — Architecture & Data Flow Reference
**Version:** 2.0

---

## System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                              │
│                                                                   │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │  Task Board  │  │   Task Chat    │  │   Session Status     │  │
│  │  (Kanban)    │  │ (live stream)  │  │  idle/working/attn   │  │
│  └──────┬───────┘  └───────┬────────┘  └──────────┬───────────┘  │
│         │                  │                       │              │
└─────────┼──────────────────┼───────────────────────┼──────────────┘
          │ REST             │ SSE                   │ SSE
┌─────────▼──────────────────▼───────────────────────▼──────────────┐
│                      NEXT.JS on Vercel                             │
│                                                                    │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐  │
│  │  Browser API Routes  │    │   Session Webhook API Routes     │  │
│  │  /api/clients        │    │   /api/sessions/[token]/next     │  │
│  │  /api/projects       │    │   /api/sessions/[token]/stream   │  │
│  │  /api/tasks          │    │   /api/sessions/[token]/poll     │  │
│  │  /api/tasks/stream   │    │   /api/sessions/[token]/attn     │  │
│  │  /api/settings       │    │   /api/sessions/[token]/complete │  │
│  └──────────┬───────────┘    └──────────────┬───────────────────┘  │
│             │                               │                      │
│             └───────────────┬───────────────┘                      │
│                             │                                      │
│                    ┌────────▼──────────┐                           │
│                    │  Session Manager  │                           │
│                    │  - token verify   │                           │
│                    │  - long-poll wait │                           │
│                    │  - pub/sub wakeup │                           │
│                    │  - SSE fan-out    │                           │
│                    └────────┬──────────┘                           │
│                             │                                      │
└─────────────────────────────┼──────────────────────────────────────┘
                              │ Drizzle ORM
         ┌────────────────────▼────────────────────┐
         │              NEON DB (PostgreSQL)         │
         │                                          │
         │  users          agent_sessions           │
         │  clients        session_messages         │
         │  projects       tasks                    │
         │  client_        task_attachments         │
         │    integrations task_messages            │
         │  agent_accounts                          │
         └──────────────────────────────────────────┘

         ┌────────────────────────────────────────────┐
         │           VERCEL BLOB                      │
         │   Task file attachments (24h TTL)          │
         └────────────────────────────────────────────┘

         ┌──────────────────────────────────────────────────────────┐
         │              DEVELOPER'S LOCAL MACHINES                   │
         │                                                          │
         │  ~/projects/spinquest/frontend/                          │
         │    └── Claude Code session ──────────────────────────┐   │
         │                                                       │   │
         │  ~/projects/pepsico/api/                              │   │
         │    └── Codex session ─────────────────────────────┐  │   │
         │                                                    │  │   │
         │  ~/projects/bitcs/backend/                         │  │   │
         │    └── Claude Code session ─────────────────────┐  │  │   │
         │                                                  │  │  │   │
         └──────────────────────────────────────────────────┼──┼──┼───┘
                                                            │  │  │
                          HTTPS (long-poll + POST) ─────────┘──┘──┘
                          back to Mosaic /api/sessions/[token]/...
```

---

## Session Lifecycle

```
User creates session in Mosaic UI
         │
         ▼
Mosaic generates:
  - id: UUID
  - token: 40-char random hex (stored hashed)
  - bootstrap prompt: full work-loop instructions
         │
         ▼
User copies bootstrap prompt
→ Opens terminal in ~/projects/[client]/[project]/
→ Starts Claude Code / Codex
→ Pastes bootstrap prompt
         │
         ▼
Session starts work loop:

  ┌─────────────────────────────────────────────────┐
  │                  WORK LOOP                       │
  │                                                  │
  │  ┌──────────────────────────────────────────┐   │
  │  │ 1. GET /sessions/[token]/next?wait=90    │   │
  │  │    ← 204: no task → reloop              │   │
  │  │    ← 200 + task JSON → proceed          │   │
  │  └───────────────────┬──────────────────────┘   │
  │                      │ task received             │
  │  ┌───────────────────▼──────────────────────┐   │
  │  │ 2. Check clearBefore / compactBefore     │   │
  │  │    Run /clear or /compact if needed      │   │
  │  └───────────────────┬──────────────────────┘   │
  │                      │                           │
  │  ┌───────────────────▼──────────────────────┐   │
  │  │ 3. Download file attachments from URLs   │   │
  │  │    curl each files[i].url → /tmp/        │   │
  │  └───────────────────┬──────────────────────┘   │
  │                      │                           │
  │  ┌───────────────────▼──────────────────────┐   │
  │  │ 4. DO THE WORK in the real project folder│   │
  │  │    Stream output chunks to Mosaic:       │   │
  │  │    POST /sessions/[token]/tasks/[id]/    │   │
  │  │         stream { chunk: "..." }          │   │
  │  └──────────┬──────────────┬────────────────┘   │
  │             │ stuck?       │ done?               │
  │  ┌──────────▼───────┐  ┌───▼────────────────┐   │
  │  │ 5. RAISE ATTENTION│  │ 6. COMPLETE        │   │
  │  │ POST .../attention│  │ POST .../complete  │   │
  │  │ { message: "..." }│  │ { result: "..." }  │   │
  │  │                  │  └───────────────────┬─┘   │
  │  │ Long-poll for    │                      │     │
  │  │ user reply:      │                      │     │
  │  │ GET .../poll     │                      │     │
  │  │ ?since=...&wait=90                      │     │
  │  │                  │                      │     │
  │  │ Read user comment│                      │     │
  │  │ POST .../resume  │                      │     │
  │  └──────────────────┘                      │     │
  │                                            │     │
  └────────────────────────────────────────────┼─────┘
                                               │
                                         back to step 1
```

---

## Long-Poll Implementation

The `/api/sessions/[token]/next` endpoint must "park" the connection until a task is ready.

```typescript
// app/api/sessions/[token]/next/route.ts

export async function GET(req: Request, { params }) {
  const session = await verifySessionToken(params.token)
  if (!session) return new Response(null, { status: 401 })

  // Update last_seen_at (heartbeat piggyback)
  await db.update(agentSessions)
    .set({ lastSeenAt: new Date(), status: 'idle' })
    .where(eq(agentSessions.id, session.id))

  const waitSeconds = Math.min(parseInt(url.searchParams.get('wait') || '90'), 90)
  const deadline = Date.now() + waitSeconds * 1000

  // Poll DB every 2s for an available task
  while (Date.now() < deadline) {
    const task = await claimNextTask(session.projectId, session.id)
    if (task) {
      // Mark session as working
      await db.update(agentSessions)
        .set({ status: 'working', currentTaskId: task.id })
        .where(eq(agentSessions.id, session.id))

      return Response.json({ success: true, data: task })
    }
    await sleep(2000)
  }

  // Timeout — no task. Return 204, session reloops.
  return new Response(null, { status: 204 })
}
```

> **Note for Phase 3:** Replace the 2s polling loop with a proper pub/sub mechanism
> (e.g. Neon's LISTEN/NOTIFY or Redis pub/sub) so wakeup is truly instant.
> For Phase 2, the 2s polling loop is fine.

---

## Stream Flow: Session Output → Browser

```
Session (local machine)
  │
  │  POST /api/sessions/[token]/tasks/[taskId]/stream
  │  Body: { chunk: "Here's my analysis of the auth middleware..." }
  │
  ▼
Mosaic API Route
  │
  ├── 1. Verify token
  ├── 2. Save chunk to task_messages (role='agent', is_stream_chunk=true)
  └── 3. Push chunk to SSE broadcast channel for taskId
           │
           ▼
  Browser SSE connection: GET /api/tasks/[taskId]/stream
           │
           ▼
  Task chat UI renders chunk in real-time
```

SSE event format (browser-facing):
```
event: chunk
data: {"sessionName": "Claude Code — Frontend", "content": "Here's my analysis..."}

event: attention
data: {"sessionName": "Claude Code — Frontend", "message": "Should I update /v2 routes?"}

event: complete
data: {"sessionName": "Claude Code — Frontend", "result": "Refactored auth into /lib/auth/verify.ts"}

event: status
data: {"sessionId": "uuid", "status": "idle"}
```

---

## Client / Project / Session Relationship

```
USER
├── Client: PepsiCo
│   ├── Integration: GitHub (org: pepsico-dev)
│   ├── Integration: Slack (workspace: pepsico.slack.com, channel: #ai-updates)
│   │
│   ├── Project: Frontend
│   │   ├── 🟢 Session: "Claude Code — Frontend" (status: working, task: "Refactor auth")
│   │   └── 🟡 Session: "Codex — Frontend 2" (status: needs_attention)
│   │
│   └── Project: API
│       └── 🟢 Session: "Claude Code — API" (status: idle)
│
├── Client: SpinQuest
│   ├── Integration: GitHub (org: spinquest-org)
│   │
│   └── Project: Mobile App
│       └── ⚫ Session: "Claude Code — Mobile" (status: offline)
│
└── Client: Bitcs
    └── Project: Backend
        └── 🟢 Session: "Codex — Backend" (status: working)

Session status legend:
  🟢 idle     — connected, polling, no active task
  🔵 working  — currently executing a task
  🟡 needs_attention — waiting for user decision
  ⚫ offline  — not seen in > 5 minutes
```

---

## Data Flow: Creating a Session

```
Browser                    Mosaic API               Neon DB
   │                           │                       │
   │  POST /api/projects/      │                       │
   │  [id]/sessions            │                       │
   │  { name, agent_type }     │                       │
   │──────────────────────────▶│                       │
   │                           │  INSERT agent_sessions│
   │                           │  token = randomHex(40)│
   │                           │──────────────────────▶│
   │                           │                       │
   │                           │  ← { id, token }      │
   │                           │                       │
   │                           │  Build bootstrap      │
   │                           │  prompt with token    │
   │                           │                       │
   │  ← { session, token,      │                       │
   │      bootstrapPrompt }    │                       │
   │◀──────────────────────────│                       │
   │                           │                       │
   │  [User copies prompt,     │                       │
   │   pastes into Claude Code]│                       │
   │                           │                       │
   │  [Claude Code starts      │                       │
   │   calling /next...]       │                       │
```

---

## Attention Flag Flow

```
Session (stuck)                Mosaic                    Browser (you)
      │                           │                           │
      │  POST /sessions/[t]/      │                           │
      │  tasks/[id]/attention     │                           │
      │  { message: "..." }       │                           │
      │──────────────────────────▶│                           │
      │                           │  UPDATE tasks             │
      │                           │  SET attention_message    │
      │                           │  UPDATE sessions          │
      │                           │  SET status='needs_attn'  │
      │                           │                           │
      │                           │  SSE push to browser ────▶│
      │                           │  event: attention         │
      │                           │  (dashboard highlights,   │
      │                           │   browser notification)   │
      │                           │                           │
      │                           │    ◀─── User reads msg    │
      │                           │    ◀─── User types reply  │
      │                           │                           │
      │                           │  POST /tasks/[id]/        │
      │                           │  messages                 │
      │                           │  { body: "Yes, update v2" │
      │                           │    authorKind: "user" }   │
      │                           │                           │
      │  GET /sessions/[t]/       │                           │
      │  tasks/[id]/poll?wait=90  │                           │
      │──────────────────────────▶│                           │
      │                           │  (parks, waiting for      │
      │                           │   user comment)           │
      │                           │                           │
      │  ← { newComments: [{      │                           │
      │      authorKind:"user",   │                           │
      │      body: "Yes, update"  │                           │
      │    }] }                   │                           │
      │◀──────────────────────────│                           │
      │                           │                           │
      │  POST .../resume          │                           │
      │──────────────────────────▶│                           │
      │                           │  UPDATE sessions          │
      │                           │  SET status='working'     │
      │                           │  SSE push status update ─▶│
      │                           │                           │
      │  [continues working]      │                           │
```

---

## UI Layout (Updated for v2)

```
┌─────────────────────────────────────────────────────────────┐
│  🔲 Mosaic  │  [PepsiCo ▼]  │  ⚡ 2 active  🟡 1 attention │
├─────────────┼───────────────────────────────────────────────┤
│             │                                               │
│  SIDEBAR    │           MAIN CONTENT                       │
│             │                                               │
│  ▼ PepsiCo  │                                               │
│  ● Frontend │  [Task Board / Task Chat / Session Chat]     │
│  ● API      │                                               │
│             │                                               │
│  ▼ SpinQ..  │                                               │
│  ● Mobile   │                                               │
│             │                                               │
│  ▼ Bitcs    │                                               │
│  ● Backend  │                                               │
│             │                                               │
│  + Client   │                                               │
│             │                                               │
└─────────────┴───────────────────────────────────────────────┘

Sidebar dot colors:
  🟢 = at least one session idle/working
  🟡 = at least one session needs_attention  ← animate/pulse
  ⚫ = all sessions offline

---

Task Board View:
┌──────────┬──────────────────┬──────────┬──────────┐
│ BACKLOG  │  IN PROGRESS     │  REVIEW  │   DONE   │
│          │                  │          │          │
│ [Card]   │ [Card]           │ [Card]   │ [Card]   │
│          │ 🔵 Claude Code   │          │          │
│ [Card]   │ streaming...     │          │ [Card]   │
│          │                  │          │          │
│ [Card]   │ [Card]           │          │          │
│          │ 🟡 NEEDS YOU     │          │          │
│ + Add    │                  │          │          │
└──────────┴──────────────────┴──────────┴──────────┘

---

Task Chat View:
┌──────────────────────────┬─────────────────────────────────┐
│  Task Details            │  Live Session Output            │
│                          │                                 │
│  Refactor auth middleware│  🔵 Claude Code — Frontend      │
│  ─────────────────────── │  ─────────────────────────────  │
│  Status: In Progress     │  Reading current auth.ts...     │
│  Session: Claude Code    │  Found token verification in    │
│  Priority: High          │  3 places. Extracting to        │
│  ─────────────────────── │  /lib/auth/verify.ts now...     │
│  Instructions:           │  ▋ (streaming)                  │
│  "Extract token verify   │                                 │
│   step..."               │  ─────────────────────────────  │
│  ─────────────────────── │  💬 You can reply here:         │
│  Attachments:            │  [Type a message to session...] │
│  📎 current-auth.ts      │                 [Send]          │
│                          │                                 │
│  [Move to Review] [Done] │                                 │
└──────────────────────────┴─────────────────────────────────┘

---

Session Management View (Project Settings):
┌─────────────────────────────────────────────────────────────┐
│  Sessions — SpinQuest Frontend                              │
│                                                             │
│  🟢 Claude Code — Frontend        [Chat] [Revoke]          │
│     Token: cw_live_fd63...  Last seen: 2 min ago           │
│     Current task: "Refactor auth middleware"               │
│                                                             │
│  ⚫ Codex — Frontend 2            [Chat] [Revoke]          │
│     Token: cw_live_a23b...  Last seen: 3 hours ago         │
│     Current task: none                                     │
│                                                             │
│  [+ New Session]                                           │
└─────────────────────────────────────────────────────────────┘

---

New Session Modal:
┌─────────────────────────────────────┐
│  New Session — SpinQuest Frontend   │
│                                     │
│  Name: [Claude Code — Frontend   ]  │
│  Agent: [Claude Code          ▼ ]  │
│                                     │
│  [Create Session]                   │
└─────────────────────────────────────┘

After creation:
┌─────────────────────────────────────────────────────┐
│  Session Created ✅                                  │
│                                                     │
│  Your bootstrap prompt is ready.                    │
│  Paste this into a Claude Code session running      │
│  inside ~/projects/spinquest/frontend               │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ You are an autonomous agent connected to    │   │
│  │ Mosaic.                                     │   │
│  │ ...                                         │   │
│  │ Token: cw_live_fd636da7...                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [📋 Copy Prompt]           [Done]                  │
└─────────────────────────────────────────────────────┘
```

---

## Environment Variables

```bash
# .env.local
DATABASE_URL=                    # Neon DB connection string
NEXTAUTH_SECRET=                 # Random 32-char string
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ENCRYPTION_KEY=                  # 32-byte hex string for AES-256
BLOB_READ_WRITE_TOKEN=           # Vercel Blob (task attachments)
CRON_SECRET=                     # For Vercel cron auth
```

---

## Vercel Cron — Session Health Check

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/session-health",
    "schedule": "*/2 * * * *"
  }]
}
```

```typescript
// app/api/cron/session-health/route.ts
// Marks sessions offline if not seen in > 5 minutes
// Sends SSE update to any browser watching those sessions
```
