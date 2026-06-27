# Mosaic — Product Requirements Document
**Version:** 1.0  
**Author:** Sam  
**Status:** Draft  
**Last Updated:** June 2026

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
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Build Phases](#12-build-phases)
13. [Out of Scope (v1)](#13-out-of-scope-v1)

---

## 1. Product Overview

**Mosaic** is a multi-client, multi-agent AI orchestration workspace for developers who manage work across multiple companies, clients, or projects simultaneously.

Each piece of the puzzle — a client, a project, an AI agent — is a tile. Mosaic assembles them into one complete picture: one interface, one answer, zero context switching.

Instead of opening five terminals, three browser tabs, and four AI tools, you open Mosaic. You send a task. The right agents for that project collaborate behind the scenes and return **one merged, high-quality answer**.

---

## 2. Problem Statement

Developers working across multiple clients (e.g. PepsiCo, SpinQuest, Bitcs) today face:

- **Credential chaos** — each client has its own Claude account, GitHub Copilot, Codex subscription
- **Context switching overhead** — constantly opening/closing terminals, browser tabs, IDE sessions
- **Single-agent limitations** — one AI gives one perspective; there's no cross-validation
- **No unified workspace** — task tracking, AI interaction, and project management are all separate tools
- **Lost context** — switching between clients means losing thread of what each AI knows about each project

**Mosaic solves this** by being the single command center for all clients, all projects, and all AI agents.

---

## 3. Goals & Success Metrics

### Goals
- Reduce context-switching time between client workspaces to near zero
- Enable multi-agent collaboration that produces better answers than any single agent
- Provide a clean task board + chat interface per project
- Be useful as a personal tool AND impressive as a portfolio/product

### Success Metrics (v1)
| Metric | Target |
|--------|--------|
| Time to switch between client contexts | < 5 seconds |
| Agents connected per project | Up to 5 |
| Task response quality (subjective) | Noticeably better than single-agent |
| Setup time for a new client | < 3 minutes |
| Uptime | 99%+ |

---

## 4. User Personas

### Primary: Sam (The Multi-Client Dev)
- Full-stack developer, 4 years experience
- Works across 3–4 clients simultaneously
- Has different AI tool subscriptions per client
- Needs a single place to manage everything
- Values speed, clarity, and not repeating himself

### Secondary: The Solo Founder / Freelancer
- Similar to Sam but also doing product + QA work
- Wants AI agents to handle the grunt work autonomously
- Values the portfolio/showcase angle of Mosaic

---

## 5. Core Concepts & Terminology

| Term | Definition |
|------|-----------|
| **Client** | A company or organization (e.g. PepsiCo, SpinQuest). Top-level container. |
| **Project** | A specific codebase or workstream within a client (e.g. "Frontend", "API"). |
| **Agent** | An AI model connected via API key (Claude, Codex, Copilot, etc.). |
| **Agent Account** | A specific API credential set for an agent, scoped to a client. |
| **Primary Agent** | The agent designated to lead a task and produce the final answer. |
| **Secondary Agents** | Supporting agents consulted by the primary for additional context/validation. |
| **Orchestrator** | Mosaic's backend logic that routes tasks, collects agent responses, and merges them. |
| **Task** | A unit of work added to a project's board. Has a title, instructions, status, and chat thread. |
| **Workspace** | The full Mosaic environment for a user — all their clients, projects, and agents. |

---

## 6. Feature Breakdown

### 6.1 Client Management
- Create, edit, archive clients
- Each client has: name, color/icon, description, linked agent accounts
- Quick-switch between clients from sidebar

### 6.2 Project Management
- Create projects under a client
- Each project has: name, description, repo URL (optional), primary agent, secondary agents
- Projects are isolated — agents attached to PepsiCo's project cannot see SpinQuest data

### 6.3 Agent Registry (Settings)
- Global settings page to manage all AI agent connections
- Add an agent by: name, provider (Claude / OpenAI / GitHub Copilot / Custom), API key
- Agents are stored encrypted in Neon DB
- Assign agents to projects (one primary, multiple secondaries)
- Supported providers out of the box:
  - **Anthropic** (Claude Sonnet, Opus, Haiku)
  - **OpenAI** (GPT-4o, Codex)
  - **GitHub Copilot** (via API)
  - **Custom** (any OpenAI-compatible endpoint)

### 6.4 Task Board
- Kanban columns: **Backlog → In Progress → Review → Done**
- Add tasks with title + detailed instructions
- Drag and drop between columns
- Each task card shows: title, assigned agents, status badge, last activity timestamp
- Filter by status, agent, priority

### 6.5 Task Chat (Per Task)
- Every task has a chat thread
- Send a message → Orchestrator routes to agents → streamed response appears
- Visible agent activity: "Claude is analyzing... Codex is reviewing... Merging responses..."
- Chat history persists per task
- Can @mention a specific agent to direct a question to it alone

### 6.6 Multi-Agent Orchestration
- When a task is submitted:
  1. Primary agent receives the full task + instructions
  2. Primary generates initial response
  3. Secondary agents receive: original task + primary's response → asked to critique, add, or validate
  4. Orchestrator collects all secondary responses
  5. Primary agent receives all secondary feedback → produces final merged answer
  6. Final answer returned to user in task chat
- User can see the "reasoning trace" (collapsed by default): what each agent said

### 6.7 Context Per Project
- Each project has a **Project Context** — a text field for standing instructions (like AGENTS.md)
- e.g. "This is a React 18 app. Use TypeScript. Do not modify legacy /v1 routes."
- Context is injected into every agent call for that project automatically

### 6.8 Dashboard
- Overview of all clients and projects
- Active tasks across all projects
- Recent agent activity feed
- Quick-add task from dashboard

---

## 7. User Flows

### Flow 1: Setting Up a New Client + Project

```
Settings → Agents → Add Agent
  → Name: "PepsiCo Claude"
  → Provider: Anthropic
  → API Key: sk-ant-...
  → Save

Sidebar → New Client → "PepsiCo"
  → New Project → "Frontend"
  → Primary Agent: PepsiCo Claude
  → Secondary Agents: Personal Codex, PepsiCo Copilot
  → Project Context: "React 18, TypeScript, Tailwind..."
  → Save
```

### Flow 2: Running a Task

```
Project: PepsiCo / Frontend
  → Task Board → Add Task
  → Title: "Refactor auth middleware"
  → Instructions: "Extract token-verify step, keep /v1 routes untouched..."
  → Create Task → Drag to "In Progress"
  
  → Task opens → Chat panel visible
  → Send: "Start working on this"
  
  [Orchestrator]
  → Primary (PepsiCo Claude) analyzes task
  → Secondary 1 (Codex): reviews Claude's approach
  → Secondary 2 (Copilot): checks repo patterns
  → Primary merges all input → Final answer streamed to chat
```

### Flow 3: Switching Clients

```
Sidebar → Click "SpinQuest"
  → All projects, tasks, agents switch to SpinQuest context
  → SpinQuest agents load, PepsiCo agents are not accessible here
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

-- Projects
projects (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  name TEXT,
  description TEXT,
  repo_url TEXT,
  context TEXT,           -- Standing instructions injected into every agent call
  primary_agent_id UUID,  -- FK to agent_accounts
  created_at TIMESTAMP
)

-- Agent Accounts (stored credentials)
agent_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  display_name TEXT,      -- e.g. "PepsiCo Claude"
  provider TEXT,          -- 'anthropic' | 'openai' | 'github_copilot' | 'custom'
  model TEXT,             -- e.g. 'claude-sonnet-4-6'
  api_key_encrypted TEXT, -- AES-256 encrypted
  base_url TEXT,          -- For custom providers
  created_at TIMESTAMP
)

-- Project ↔ Agent join (secondaries)
project_agents (
  project_id UUID REFERENCES projects(id),
  agent_account_id UUID REFERENCES agent_accounts(id),
  role TEXT DEFAULT 'secondary', -- 'primary' | 'secondary'
  PRIMARY KEY (project_id, agent_account_id)
)

-- Tasks
tasks (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  title TEXT,
  instructions TEXT,
  status TEXT DEFAULT 'backlog', -- 'backlog'|'in_progress'|'review'|'done'
  priority TEXT DEFAULT 'medium', -- 'low'|'medium'|'high'|'critical'
  position INTEGER,       -- For ordering within column
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Task Chat Messages
task_messages (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  role TEXT,              -- 'user' | 'assistant' | 'agent_trace'
  content TEXT,
  agent_id UUID,          -- Which agent produced this (for traces)
  is_trace BOOLEAN DEFAULT false,
  created_at TIMESTAMP
)

-- Orchestration Traces (agent collaboration logs)
orchestration_traces (
  id UUID PRIMARY KEY,
  task_message_id UUID REFERENCES task_messages(id),
  step INTEGER,
  agent_id UUID REFERENCES agent_accounts(id),
  role TEXT,              -- 'primary_analysis' | 'secondary_review' | 'final_merge'
  input TEXT,
  output TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
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
| State | Zustand | Lightweight, perfect for workspace switching |
| Drag & Drop | @dnd-kit | Task board Kanban |
| Real-time | Server-Sent Events (SSE) | Stream agent responses to chat |
| Auth | NextAuth.js (Google + Email) | Quick setup, session management |

### Backend
| Layer | Choice | Reason |
|-------|--------|--------|
| API | Next.js API Routes | Collocated with frontend |
| ORM | Drizzle ORM | Type-safe, works perfectly with Neon |
| Database | Neon DB (PostgreSQL) | Serverless Postgres, free tier generous |
| Encryption | Node.js crypto (AES-256) | Encrypt API keys at rest |
| AI SDKs | Vercel AI SDK | Unified interface for Anthropic + OpenAI |

### Infrastructure
| Layer | Choice |
|-------|--------|
| Hosting | Vercel |
| Database | Neon DB |
| Secrets | Vercel Environment Variables |

---

## 10. API & Orchestration Design

### Orchestration Flow (Backend)

```
POST /api/tasks/[taskId]/chat
Body: { message: string }

1. Load task + project context + agent config
2. Build system prompt = project context + task instructions
3. Call Primary Agent with: system prompt + conversation history + user message
   → Stream partial response
4. On primary completion → call each Secondary Agent with:
   → system prompt + original message + "Primary agent said: [primary response]. 
      Review this and add anything missing, flag any errors, suggest improvements."
5. Collect all secondary responses
6. Call Primary Agent again with:
   → "You previously said: [your response]. 
      Secondary agents reviewed and said: [secondary responses]. 
      Produce a final, improved answer incorporating their feedback."
7. Stream final response to client via SSE
8. Save full trace to orchestration_traces table
```

### Agent Provider Abstraction

```typescript
// All providers implement this interface
interface AgentProvider {
  call(params: {
    systemPrompt: string;
    messages: Message[];
    stream: boolean;
  }): Promise<AgentResponse | ReadableStream>;
}

// Implementations
class AnthropicProvider implements AgentProvider { ... }
class OpenAIProvider implements AgentProvider { ... }
class CopilotProvider implements AgentProvider { ... }
class CustomProvider implements AgentProvider { ... }
```

### Key API Routes

```
GET    /api/clients                    → List all clients
POST   /api/clients                    → Create client
GET    /api/clients/[id]/projects      → List projects for client
POST   /api/clients/[id]/projects      → Create project

GET    /api/projects/[id]/tasks        → Get task board
POST   /api/projects/[id]/tasks        → Create task
PATCH  /api/tasks/[id]                 → Update task (status, position)

GET    /api/tasks/[id]/messages        → Get chat history
POST   /api/tasks/[id]/chat            → Send message (triggers orchestration)

GET    /api/settings/agents            → List agent accounts
POST   /api/settings/agents            → Add agent account
DELETE /api/settings/agents/[id]       → Remove agent account
```

---

## 11. Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| First agent response starts streaming | < 2 seconds |
| Full orchestrated response (3 agents) | < 15 seconds |
| API key encryption | AES-256-GCM at rest |
| Client data isolation | Row-level, enforced by user_id on every query |
| Mobile responsive | Yes — at minimum task board and chat |
| Session security | NextAuth JWT, httpOnly cookies |

---

## 12. Build Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Next.js project setup with Tailwind + shadcn/ui
- [ ] Neon DB setup + Drizzle ORM schema migrations
- [ ] NextAuth — Google login
- [ ] Client + Project CRUD (UI + API)
- [ ] Agent Settings page — add/remove agent accounts (no orchestration yet)
- [ ] Basic task board (Kanban, drag and drop, no AI yet)

### Phase 2 — Single Agent Chat (Week 3)
- [ ] Task chat UI (message thread, streaming)
- [ ] SSE endpoint for streaming
- [ ] Connect one agent (Claude) to a project
- [ ] Send message → get single-agent streamed response in chat
- [ ] Project context injected into every call

### Phase 3 — Orchestration (Week 4–5)
- [ ] Multi-agent orchestration logic (primary → secondaries → merge)
- [ ] Visible "thinking" states in chat UI ("Claude is analyzing...")
- [ ] Collapsible trace view (what each agent contributed)
- [ ] Support Anthropic + OpenAI providers

### Phase 4 — Polish & Ship (Week 6)
- [ ] Dashboard overview (all clients, active tasks)
- [ ] GitHub Copilot + Custom provider support
- [ ] Workspace switcher (fast client/project switching)
- [ ] Error handling, loading states, empty states
- [ ] Deploy to Vercel + Neon production
- [ ] README, demo GIF, portfolio writeup

---

## 13. Out of Scope (v1)

- Mobile app (web-responsive is enough for v1)
- Real-time collaboration (multi-user on same workspace)
- Agent-to-agent direct messaging (orchestrator is always the middleman)
- File/image uploads to agents
- Billing / subscription management
- Team/org features (v1 is single-user)
- Git integration (no worktrees, no PR creation in v1)
- Voice input

---

*Mosaic PRD v1.0 — pieces come together.*
