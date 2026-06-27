# Mosaic — Product Requirements Document
**Version:** 2.0  
**Author:** Sam  
**Status:** Active  
**Last Updated:** June 2026  
**Changes from v1:** Added Agent Sessions (webhook-based live AI sessions), Client Integrations (GitHub, Slack, etc.), updated data model, updated phases.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [Core Concepts & Terminology](#5-core-concepts--terminology)
6. [Feature Breakdown](#6-feature-breakdown)
7. [User Flows](#7-user-flows)
8. [Data Model](#8-data-model)
9. [Tech Stack](#9-tech-stack)
10. [API & Orchestration Design](#10-api--orchestration-design)
11. [Session Webhook Protocol](#11-session-webhook-protocol)
12. [Client Integrations](#12-client-integrations)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Build Phases](#14-build-phases)
15. [Out of Scope (v1)](#15-out-of-scope-v1)

---

## 1. Product Overview

**Mosaic** is a multi-client, multi-agent AI orchestration workspace for developers who manage work across multiple companies, clients, or projects simultaneously.

Each piece — a client, a project, a live AI session, an integration — is a tile. Mosaic assembles them into one complete picture: one interface, zero context switching.

The core model: you create a **project** (e.g. SpinQuest Frontend), attach a **live agent session** to it (Claude Code or Codex running in that project's actual folder on your machine), connect **integrations** (GitHub, Slack), and use Mosaic's **task board** to queue work. The session picks up tasks via a long-poll webhook, does the work autonomously in the real codebase, and streams results back to the Mosaic UI. You can also **chat directly with the session** — and the session can reach out when it needs a decision.

Multiple sessions can run on the same project simultaneously. Each client can have multiple projects, each with their own sessions and integrations.

---

## 2. Problem Statement

Developers working across multiple clients (e.g. PepsiCo, SpinQuest, Bitcs) today face:

- **Credential chaos** — each client has its own Claude account, GitHub Copilot, Codex subscription
- **Context switching overhead** — constantly opening/closing terminals, browser tabs, IDE sessions
- **No task visibility** — no single place to see what all your AI agents are working on right now
- **Single-agent limitations** — one AI works alone, can't loop in GitHub or Slack without manual effort
- **Lost context** — switching between clients means losing thread of what each AI knows about each project
- **No human-in-the-loop** — agents either block waiting for input or proceed without you; there's no clean "flag me" mechanism

**Mosaic solves this** by being the single command center for all clients, all projects, all live AI sessions, and all integrations.

---

## 3. Goals & Success Metrics

### Goals
- Reduce context-switching time between client workspaces to near zero
- Enable live AI sessions connected directly to real project folders
- Provide a task board that agents actively poll and execute from
- Let multiple sessions run in parallel on one project
- Connect integrations (GitHub, Slack) per client so agents can act on them

### Success Metrics (v1)
| Metric | Target |
|--------|--------|
| Time to switch between client contexts | < 5 seconds |
| Sessions per project | Up to 5 simultaneous |
| Task picked up by session after creation | < 2 seconds (long-poll wakes instantly) |
| Setup time for a new client + first session | < 5 minutes |
| Uptime | 99%+ |

---

## 4. User Personas

### Primary: Sam (The Multi-Client Dev)
- Full-stack developer, 4 years experience
- Works across 3–4 clients simultaneously
- Has different AI tool subscriptions per client (PepsiCo Claude, SpinQuest Codex, etc.)
- Wants to queue tasks from one UI and let AI sessions do the work in the right folders
- Needs to intervene quickly when a session gets stuck

### Secondary: The Solo Founder / Freelancer
- Manages multiple projects alone
- Wants agents to run autonomously with minimal interruption
- Values the integration angle (GitHub PR reviews, Slack notifications)

---

## 5. Core Concepts & Terminology

| Term | Definition |
|------|-----------|
| **Client** | A company or organization (e.g. PepsiCo, SpinQuest). Top-level container. |
| **Project** | A specific codebase or workstream within a client (e.g. "Frontend", "API"). Maps to a real folder on your machine. |
| **Agent Session** | A live AI process (Claude Code, Codex, GitHub Copilot) running inside a project folder, connected to Mosaic via a webhook token. It polls for tasks, executes them, and streams results back. |
| **Session Token** | A unique bearer token generated per session. The AI (e.g. Claude Code) uses this token to authenticate all webhook calls to Mosaic. |
| **Workspace** | Synonymous with Session — one Claude Code or Codex terminal session connected to one project. Multiple workspaces can run per project. |
| **Task** | A unit of work on the project's Kanban board. Created by the user, picked up by an available session via long-poll. |
| **Long-Poll** | The session curls `/api/sessions/[token]/next?wait=90` — the server parks the connection up to 90s, returning instantly when a task is ready. On 204 (no task), the session reloops. |
| **Attention Flag** | When a session hits a decision it can't make alone, it calls `/api/sessions/[token]/tasks/[id]/attention`. Mosaic notifies the user (dashboard highlight, browser notification). |
| **Integration** | A third-party service connected at the client level — GitHub, Slack, Jira, etc. Sessions can read/write to integrations for context. |
| **Orchestrator** | Mosaic's backend logic that routes tasks to available sessions, and optionally fans out to multiple sessions for parallel work. |
| **Agent Account** | A stored (encrypted) API credential — used for the older direct-call model. Sessions replace this for live work, but agent accounts still exist for quick one-off calls from the chat UI. |

---

## 6. Feature Breakdown

### 6.1 Client Management
- Create, edit, archive clients
- Each client has: name, color/icon, description
- Per-client integrations (GitHub org, Slack workspace, Jira project — see Section 12)
- Quick-switch between clients from sidebar

### 6.2 Project Management
- Create projects under a client
- Each project has: name, description, local folder path (for reference), project context (standing instructions)
- Projects are isolated — sessions attached to PepsiCo projects cannot see SpinQuest data

### 6.3 Agent Sessions
The core new feature in v2.

**Creating a session:**
1. Go to a project → "New Session"
2. Give it a name (e.g. "Claude Code — SpinQuest Frontend")
3. Choose the agent type: Claude Code / Codex / Copilot / Custom
4. Mosaic generates a **session token** + a **bootstrap prompt**
5. Copy the bootstrap prompt → paste it into a Claude Code (or Codex) terminal session running inside the real project folder
6. The session is now live and connected

**What the session does:**
- Runs a forever-loop: poll `/api/sessions/[token]/next` → get task → do work → complete → poll again
- Streams output back to Mosaic via POST to `/api/sessions/[token]/tasks/[id]/stream`
- Raises attention flags when it needs the user
- Monitors for human takeover (user marks task done/todo from board)
- Reads + acts on user comments posted via the board UI

**Session states:**
- `idle` — polling, no task
- `working` — executing a task
- `needs_attention` — waiting for user decision
- `offline` — hasn't polled in > 5 minutes

**Multiple sessions per project:**
- Each project can have N sessions running simultaneously
- Tasks are claimed on a first-come-first-served basis (the session that wins the long-poll gets the task)
- Useful for parallelizing independent tasks

### 6.4 Task Board
- Kanban columns: **Backlog → In Progress → Review → Done**
- Add tasks with title + detailed instructions + file attachments
- Drag and drop between columns
- Each task card shows: title, which session claimed it, status badge, last activity
- Filter by status, session, priority
- Human can override: drag a task back to Backlog (session sees `status=todo` on next poll and stops current work)
- Human can mark Done directly (session sees `status=done`, stops, moves to next task)

### 6.5 Task Chat (Per Task)
- Every task has a live chat thread
- Streamed output from the session appears here in real time
- User can post messages — session reads them via the comments endpoint
- When session raises attention: chat highlights, browser notification fires
- User replies in chat → session resumes
- Can also view the raw session output (terminal-style) in a collapsible panel

### 6.6 Direct Chat with Session (Not tied to a task)
- Each session has a "Chat" tab outside the task board
- Send a message → session receives it as a standalone prompt, responds
- Useful for: quick questions, asking for status, having the session explain something about the codebase
- This is the "talk to your AI in the real folder" experience

### 6.7 Multi-Session Orchestration (Advanced)
- For complex tasks: assign multiple sessions, each handles a subtask
- Mosaic fans the task out, collects outputs, synthesizes a summary
- One session can be designated "lead" — it reviews and integrates the others' work

### 6.8 Agent Accounts (Direct Call — Legacy/Quick Use)
- Still available for quick one-off calls without a live session
- Add by: name, provider, API key (encrypted)
- Used when you want a fast AI answer in the chat without spinning up a full session
- Providers: Anthropic, OpenAI, GitHub Copilot, Custom (OpenAI-compatible)

### 6.9 Client Integrations
See Section 12 for full detail. Per-client connections:
- **GitHub** — repo access, PR reviews, issue sync
- **Slack** — post updates, read channel messages
- **Jira** — sync tasks from Jira issues (future)
- **Custom Webhook** — any service via webhook

### 6.10 Dashboard
- Overview of all clients and projects
- Live session status across all projects (idle / working / needs_attention / offline)
- Active tasks across all projects
- Attention flags — highlighted, needs your reply
- Recent session activity feed
- Quick-add task from dashboard

---

## 7. User Flows

### Flow 1: Setting Up a New Project + Session

```
Sidebar → New Client → "SpinQuest"
  → Connect integration: GitHub org "spinquest-org"
  → Connect integration: Slack workspace "spinquest.slack.com"

  → New Project → "Frontend"
  → Folder path: ~/projects/spinquest/frontend
  → Project Context: "Next.js 14 app, TypeScript, Tailwind. No changes to /legacy routes."
  → Save

  → Project page → "New Session"
  → Name: "Claude Code — Frontend"
  → Agent type: Claude Code
  → [Mosaic generates token + bootstrap prompt]
  → Copy bootstrap prompt
  → Open terminal in ~/projects/spinquest/frontend
  → Run: claude (starts Claude Code)
  → Paste bootstrap prompt
  → Session status: 🟢 Idle (connected)
```

### Flow 2: Queuing a Task

```
Project: SpinQuest / Frontend
  → Task Board → Add Task
  → Title: "Refactor auth middleware"
  → Instructions: "Extract token verification into its own util. Keep /legacy routes untouched."
  → Attach file: current-auth.ts (for reference)
  → Create Task (lands in Backlog)
  → Drag to In Progress

  [Session (Claude Code in terminal) wakes from long-poll]
  → Receives task JSON (id, title, instructions, attached files)
  → Downloads attached file
  → Begins work in the real ~/projects/spinquest/frontend folder
  → Streams output to Mosaic → visible in task chat in real time

  [If session hits a question]
  → Posts attention flag: "Should I also update the /v2/auth route or leave it?"
  → Dashboard highlights, browser notification fires
  → User opens task chat, reads question, types reply
  → Session reads reply via poll, resumes, clears attention flag
  → Session completes → marks task done → polls for next task
```

### Flow 3: Chatting Directly with a Session

```
Project: SpinQuest / Frontend
  → Session: "Claude Code — Frontend" → Chat tab
  → Type: "What does the current auth flow look like?"
  → Claude Code (in the real folder) reads the codebase and answers
  → Response streamed back to Mosaic chat
```

### Flow 4: Switching Clients

```
Sidebar → Click "Bitcs"
  → All projects, sessions, tasks switch to Bitcs context
  → SpinQuest sessions stay running (they're on a separate machine/terminal)
  → Bitcs sessions shown with their current status
```

---

## 8. Data Model

### Schema Overview (Neon DB / PostgreSQL)

```sql
-- Users
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  created_at TIMESTAMP
)

-- Clients
clients (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT,
  color TEXT,
  icon TEXT,
  description TEXT,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP
)

-- Client Integrations (GitHub, Slack, etc.)
client_integrations (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  type TEXT,                -- 'github' | 'slack' | 'jira' | 'custom_webhook'
  display_name TEXT,
  config JSONB,             -- provider-specific config (org, workspace, etc.)
  credentials_encrypted TEXT, -- AES-256 encrypted token/secret
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP
)

-- Projects
projects (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  name TEXT,
  description TEXT,
  folder_path TEXT,         -- Local reference e.g. ~/projects/spinquest/frontend
  context TEXT,             -- Standing instructions injected into every session/call
  created_at TIMESTAMP
)

-- Agent Sessions (live webhook-connected sessions)
agent_sessions (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT,                -- e.g. "Claude Code — SpinQuest Frontend"
  agent_type TEXT,          -- 'claude_code' | 'codex' | 'copilot' | 'custom'
  token TEXT UNIQUE,        -- Bearer token used by the session to auth all calls
  token_prefix TEXT,        -- First 8 chars, shown in UI (never the full token)
  status TEXT DEFAULT 'offline', -- 'idle' | 'working' | 'needs_attention' | 'offline'
  current_task_id UUID,     -- FK to tasks (null if idle)
  last_seen_at TIMESTAMP,   -- Updated on every poll; used to detect offline
  created_at TIMESTAMP
)

-- Agent Accounts (stored API keys — for direct calls)
agent_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  display_name TEXT,
  provider TEXT,            -- 'anthropic' | 'openai' | 'github_copilot' | 'custom'
  model TEXT,
  api_key_encrypted TEXT,
  base_url TEXT,
  created_at TIMESTAMP
)

-- Tasks
tasks (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  claimed_by_session_id UUID REFERENCES agent_sessions(id),
  title TEXT,
  instructions TEXT,
  status TEXT DEFAULT 'backlog', -- 'backlog'|'in_progress'|'review'|'done'
  priority TEXT DEFAULT 'medium',
  position INTEGER,
  attention_message TEXT,   -- Set when session raises attention flag
  result TEXT,              -- Set when session marks complete
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Task File Attachments
task_attachments (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  name TEXT,
  url TEXT,                 -- Stored in Vercel Blob or similar
  mime TEXT,
  size_bytes INTEGER,
  expires_at TIMESTAMP,     -- 24h after upload
  created_at TIMESTAMP
)

-- Task Chat Messages (user + session output)
task_messages (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  author_kind TEXT,         -- 'user' | 'agent' | 'system'
  session_id UUID REFERENCES agent_sessions(id),
  content TEXT,
  is_stream_chunk BOOLEAN DEFAULT false,
  created_at TIMESTAMP
)

-- Direct Session Chat (outside of tasks)
session_messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES agent_sessions(id),
  author_kind TEXT,         -- 'user' | 'agent'
  content TEXT,
  created_at TIMESTAMP
)
```

---

## 9. Tech Stack

### Frontend
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | SSR, API routes, file-based routing |
| UI | Tailwind CSS + shadcn/ui | Fast, clean, customizable |
| State | Zustand | Workspace switching, session status |
| Drag & Drop | @dnd-kit | Task board Kanban |
| Real-time | Server-Sent Events (SSE) + polling | Stream session output to chat |
| Auth | NextAuth.js (Google) | Session management |

### Backend
| Layer | Choice | Reason |
|-------|--------|--------|
| API | Next.js API Routes | Collocated with frontend |
| ORM | Drizzle ORM | Type-safe, Neon-native |
| Database | Neon DB (PostgreSQL) | Serverless Postgres |
| File storage | Vercel Blob | Task attachments |
| Encryption | Node.js crypto (AES-256-GCM) | API keys + integration tokens |
| AI SDKs | Vercel AI SDK | Direct-call agent accounts |

### Infrastructure
| Layer | Choice |
|-------|--------|
| Hosting | Vercel |
| Database | Neon DB |
| File storage | Vercel Blob |
| Secrets | Vercel Environment Variables |

---

## 10. API & Orchestration Design

### Session Webhook API Routes

These are the endpoints the session (Claude Code / Codex running locally) calls into Mosaic.

```
# Task queue (long-poll)
GET  /api/sessions/[token]/next?wait=90
     → 200 + task JSON when task available
     → 204 when no task (session reloops)
     → 401 if token invalid

# Stream output back to Mosaic (task chat)
POST /api/sessions/[token]/tasks/[taskId]/stream
     Body: { chunk: string }
     → Forwarded to task chat via SSE to browser

# Post a comment (reply to user, update, etc.)
POST /api/sessions/[token]/tasks/[taskId]/comments
     Body: { body: string }

# Raise attention flag
POST /api/sessions/[token]/tasks/[taskId]/attention
     Body: { message: string }

# Poll for user replies (long-poll)
GET  /api/sessions/[token]/tasks/[taskId]/poll?since=[ms]&wait=90
     → Returns: { status, attentionMessage, newComments, result }

# Clear attention, resume
POST /api/sessions/[token]/tasks/[taskId]/resume

# Mark task complete
POST /api/sessions/[token]/tasks/[taskId]/complete
     Body: { result: string }

# Heartbeat / status update
POST /api/sessions/[token]/heartbeat
     Body: { status: 'idle' | 'working' }

# Direct chat (not task-bound)
POST /api/sessions/[token]/chat
     Body: { message: string }
GET  /api/sessions/[token]/chat/poll?since=[ms]&wait=90
```

### Browser-Facing API Routes

```
# Clients
GET    /api/clients
POST   /api/clients
PATCH  /api/clients/[id]
DELETE /api/clients/[id]

# Client Integrations
GET    /api/clients/[id]/integrations
POST   /api/clients/[id]/integrations
DELETE /api/clients/[id]/integrations/[integId]

# Projects
GET    /api/clients/[id]/projects
POST   /api/clients/[id]/projects
PATCH  /api/projects/[id]

# Sessions
GET    /api/projects/[id]/sessions        → list sessions + status
POST   /api/projects/[id]/sessions        → create session, get token + bootstrap prompt
DELETE /api/sessions/[id]                 → revoke session token

# Tasks
GET    /api/projects/[id]/tasks           → task board
POST   /api/projects/[id]/tasks           → create task
PATCH  /api/tasks/[id]                    → update status, position
DELETE /api/tasks/[id]

# Task Messages
GET    /api/tasks/[id]/messages           → full chat history
GET    /api/tasks/[id]/stream             → SSE stream of live session output

# Agent Accounts (direct call)
GET    /api/settings/agents
POST   /api/settings/agents
DELETE /api/settings/agents/[id]
```

---

## 11. Session Webhook Protocol

This section documents exactly how a connected session (Claude Code / Codex) communicates with Mosaic. The bootstrap prompt given to the AI encodes this protocol.

### Bootstrap Prompt (generated by Mosaic per session)

```
You are an autonomous agent connected to Mosaic.

API base:   https://[mosaic-domain]/api/sessions
Token:      [SESSION_TOKEN]
Project:    [PROJECT_NAME]

Auth: send header  Authorization: Bearer [SESSION_TOKEN]  on EVERY request.

Work loop — runs forever until the user explicitly tells you to stop.

1. PULL NEXT TASK (long-poll, parks up to 90s):
   GET /api/sessions/[TOKEN]/next?wait=90
   → 200 + JSON task: { id, title, instructions, files[], comments[] }
   → 204 = no task yet, reloop immediately. This is normal.

2. CHECK CONTEXT FLAGS before starting:
   - clearBefore=true → run /clear first
   - compactBefore=true → run /compact first

3. DO THE TASK fully in this project folder. Stream output back:
   POST /api/sessions/[TOKEN]/tasks/[id]/stream  { chunk: "your output" }

4. IF YOU NEED A DECISION from the user:
   POST /api/sessions/[TOKEN]/tasks/[id]/attention  { message: "what you need" }
   Then long-poll for their reply:
   GET /api/sessions/[TOKEN]/tasks/[id]/poll?since=[ms]&wait=90
   Read newComments where authorKind="user". Reply via:
   POST /api/sessions/[TOKEN]/tasks/[id]/comments  { body: "your reply" }
   Once resolved:
   POST /api/sessions/[TOKEN]/tasks/[id]/resume

5. WATCH FOR HUMAN TAKEOVER via poll:
   - status="done" → stop, go to step 1
   - status="todo" → stop, go to step 1 (human re-queued it)
   - newComments from user → read and act

6. COMPLETE THE TASK:
   POST /api/sessions/[TOKEN]/tasks/[id]/complete  { result: "one-line summary" }

7. Go back to step 1.
```

### Task JSON shape (from /next)

```json
{
  "success": true,
  "data": {
    "id": "task_uuid",
    "title": "Refactor auth middleware",
    "instructions": "Extract token verification...",
    "compactBefore": false,
    "clearBefore": false,
    "files": [
      { "name": "current-auth.ts", "url": "https://...", "mime": "text/plain", "size": 2048 }
    ],
    "comments": [
      { "authorKind": "user", "body": "Focus on the /v2 routes first", "createdAt": 1234567890 }
    ]
  }
}
```

### Session Status Detection

Mosaic's backend runs a background job (every 2 minutes via Vercel cron) that:
1. Checks `last_seen_at` for all sessions
2. Any session not seen in > 5 minutes → set `status = 'offline'`
3. Updates propagated to browser via SSE on the dashboard

---

## 12. Client Integrations

Each client can connect external services. Sessions can read from and write to these integrations.

### 12.1 GitHub Integration
- Connect via GitHub OAuth app or personal access token
- Per-client: select org/repos to link
- Capabilities available to sessions:
  - Read repo contents (for context)
  - Create/read PRs
  - Post PR review comments
  - Read open issues
- Mosaic stores token encrypted in `client_integrations.credentials_encrypted`
- Sessions access via: `GET /api/clients/[id]/integrations/github/[action]`

### 12.2 Slack Integration
- Connect via Slack OAuth
- Per-client: select workspace + default channel
- Capabilities:
  - Post task completion summaries to a channel
  - Post attention flag notifications
  - Read channel messages (for context)
- User can toggle: "notify Slack when session raises attention"

### 12.3 Jira Integration (Phase 3+)
- Connect via Jira API token
- Sync Jira issues → Mosaic tasks (one-way import)
- Post task completion updates back to Jira tickets

### 12.4 Custom Webhook
- Any service that accepts a POST
- User configures: URL, secret, event triggers (task_complete, attention_raised, session_offline)
- Mosaic POSTs a standard payload on each trigger

---

## 13. Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| Long-poll response latency (task wakeup) | < 500ms from task creation |
| Session heartbeat interval | Every 60s |
| Offline detection threshold | > 5 minutes without heartbeat |
| Task stream chunk delivery to browser | < 1s from session POST |
| API key / token encryption | AES-256-GCM at rest |
| Client data isolation | Row-level, user_id on every query |
| Session token entropy | 40+ character random hex |
| Mobile responsive | Task board + chat at minimum |
| Vercel cron (session health check) | Every 2 minutes |

---

## 14. Build Phases

### Phase 1 — Foundation ✅ (Mostly done)
- [x] Next.js project setup with Tailwind + shadcn/ui
- [x] Neon DB setup + Drizzle ORM schema migrations
- [x] NextAuth — Google login
- [x] Client + Project CRUD (UI + API)
- [x] Agent Settings page — add/remove agent accounts
- [x] Basic task board (Kanban, drag and drop)

### Phase 2 — Sessions & Webhook Protocol (Current)
- [ ] Update DB schema: add `agent_sessions`, `task_attachments`, `session_messages`, update `tasks` with `claimed_by_session_id` + `attention_message` + `result`
- [ ] Session creation flow — generate token, build bootstrap prompt, copy to clipboard
- [ ] Session webhook endpoints: `/next`, `/stream`, `/comments`, `/attention`, `/poll`, `/resume`, `/complete`, `/heartbeat`
- [ ] Long-poll implementation in `/next` and `/poll` (server-side wait with pub/sub or polling loop)
- [ ] Task stream → SSE → browser (session POSTs chunks, Mosaic forwards to browser)
- [ ] Task chat UI shows live streamed session output
- [ ] Attention flag UI — dashboard highlight, browser notification
- [ ] Session status display (idle/working/needs_attention/offline)
- [ ] Vercel cron for offline detection
- [ ] Task attachment upload (Vercel Blob) + file serving to sessions

### Phase 3 — Integrations & Direct Chat
- [ ] GitHub OAuth integration per client
- [ ] Slack OAuth integration per client
- [ ] Direct chat with session (outside task context)
- [ ] Integration-aware sessions: session can call `/api/clients/[id]/integrations/github/[action]`
- [ ] Slack notifications on attention flag + task complete

### Phase 4 — Polish & Ship
- [ ] Dashboard: live session status grid, active tasks, attention flags
- [ ] Multi-session parallelism (fan-out orchestration for complex tasks)
- [ ] Jira sync (import issues as tasks)
- [ ] Custom webhook integration
- [ ] Error handling, loading states, empty states throughout
- [ ] Deploy to Vercel + Neon production
- [ ] README, demo GIF, portfolio writeup

---

## 15. Out of Scope (v1)

- Mobile app (web-responsive is enough)
- Real-time collaboration (multi-user on same workspace)
- Voice input
- Billing / subscription management
- Team/org features (v1 is single-user)
- Git worktrees or PR creation managed directly by Mosaic (sessions handle this themselves in the real folder)

---

*Mosaic PRD v2.0 — pieces come together.*
