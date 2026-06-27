# Mosaic — Architecture & Data Flow Reference

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     USER BROWSER                        │
│                                                         │
│   ┌─────────────┐    ┌──────────────┐                  │
│   │  Task Board │    │  Task Chat   │                  │
│   │  (Kanban)   │    │  (SSE stream)│                  │
│   └──────┬──────┘    └──────┬───────┘                  │
│          │                  │                           │
└──────────┼──────────────────┼───────────────────────────┘
           │ REST             │ SSE
┌──────────▼──────────────────▼───────────────────────────┐
│                  NEXT.JS (Vercel)                        │
│                                                         │
│   ┌──────────────────┐   ┌─────────────────────────┐   │
│   │   API Routes     │   │     Orchestrator         │   │
│   │  /api/clients    │   │                         │   │
│   │  /api/projects   │   │  1. Call Primary Agent  │   │
│   │  /api/tasks      │   │  2. Call Secondaries    │   │
│   │  /api/tasks/chat │──▶│  3. Merge → Final Answer│   │
│   │  /api/settings   │   │                         │   │
│   └──────┬───────────┘   └────────┬────────────────┘   │
│          │                        │                     │
└──────────┼────────────────────────┼─────────────────────┘
           │ Drizzle ORM            │ HTTP (AI APIs)
┌──────────▼──────────┐   ┌────────▼────────────────────┐
│    NEON DB          │   │     AI PROVIDERS             │
│   (PostgreSQL)      │   │                             │
│                     │   │  ┌────────────┐             │
│  users              │   │  │ Anthropic  │ Claude      │
│  clients            │   │  └────────────┘             │
│  projects           │   │  ┌────────────┐             │
│  agent_accounts     │   │  │  OpenAI    │ GPT/Codex   │
│  project_agents     │   │  └────────────┘             │
│  tasks              │   │  ┌────────────┐             │
│  task_messages      │   │  │  Copilot   │ GitHub      │
│  orchestration_     │   │  └────────────┘             │
│    traces           │   │  ┌────────────┐             │
│                     │   │  │  Custom    │ Any OpenAI  │
└─────────────────────┘   │  └────────────┘  compatible │
                          └─────────────────────────────┘
```

---

## Multi-Agent Orchestration Flow

```
User sends: "Refactor the auth middleware"
                    │
                    ▼
         ┌──────────────────┐
         │   Orchestrator   │
         │  loads project:  │
         │  - context       │
         │  - primary agent │
         │  - secondaries   │
         └────────┬─────────┘
                  │
    ┌─────────────▼──────────────┐
    │   STEP 1: PRIMARY ANALYSIS │
    │                            │
    │  [System]: {project context│
    │  + task instructions}      │
    │  [User]: "Refactor auth..." │
    │                            │
    │  → Anthropic API           │
    │  ← "Here's my approach..." │
    │     (streamed to UI)       │
    └─────────────┬──────────────┘
                  │ primary_response
    ┌─────────────▼──────────────────────────┐
    │   STEP 2: SECONDARY REVIEW (parallel)  │
    │                                        │
    │  Agent 2 (Codex):                      │
    │  "Primary said: [X]. Review + add."   │
    │  ← "I'd also consider..."             │
    │                                        │
    │  Agent 3 (Copilot):                    │
    │  "Primary said: [X]. Review + add."   │
    │  ← "The existing pattern in /lib..."  │
    │                                        │
    │  (NOT streamed — internal only)        │
    └─────────────┬──────────────────────────┘
                  │ all secondary responses
    ┌─────────────▼──────────────┐
    │   STEP 3: FINAL MERGE      │
    │                            │
    │  "Your response: [X]       │
    │   Feedback: [Y, Z]         │
    │   Produce final answer."   │
    │                            │
    │  → Anthropic API           │
    │  ← Final merged answer     │
    │     (streamed to UI)       │
    └─────────────┬──────────────┘
                  │
    ┌─────────────▼──────────────┐
    │   STEP 4: SAVE             │
    │  → task_messages           │
    │  → orchestration_traces    │
    └────────────────────────────┘
```

---

## Client / Project / Agent Relationship

```
USER
├── Client: PepsiCo
│   ├── Project: Frontend
│   │   ├── Primary Agent: PepsiCo Claude (claude-sonnet-4-6)
│   │   ├── Secondary: PepsiCo Copilot
│   │   └── Secondary: Personal Codex
│   └── Project: API
│       ├── Primary Agent: PepsiCo Claude
│       └── Secondary: PepsiCo Copilot
│
├── Client: SpinQuest
│   └── Project: Mobile App
│       ├── Primary Agent: SpinQuest Claude
│       └── Secondary: SpinQuest Codex
│
├── Client: Bitcs
│   └── Project: Backend
│       └── Primary Agent: Bitcs Codex
│
└── Client: Personal
    └── Project: Mosaic (this!)
        ├── Primary Agent: Personal Claude
        └── Secondary: Personal Codex

[Agent Accounts — stored in agent_accounts table, encrypted]
- PepsiCo Claude      → provider: anthropic, model: claude-sonnet-4-6
- PepsiCo Copilot     → provider: github_copilot
- SpinQuest Claude    → provider: anthropic, model: claude-opus-4-6
- SpinQuest Codex     → provider: openai, model: codex
- Bitcs Codex         → provider: openai, model: codex
- Personal Claude     → provider: anthropic, model: claude-haiku-4-5
- Personal Codex      → provider: openai, model: gpt-4o
```

---

## SSE Streaming Protocol

The `/api/tasks/[taskId]/chat` route returns `Content-Type: text/event-stream`.

Event types in order:

```
event: primary_start
data: {"agentName": "PepsiCo Claude"}

event: primary_stream
data: {"content": "Here's how I'd approach..."}

event: primary_done
data: {}

event: secondary_thinking
data: {"agentName": "Personal Codex", "index": 1, "total": 2}

event: secondary_thinking
data: {"agentName": "PepsiCo Copilot", "index": 2, "total": 2}

event: merge_start
data: {"agentName": "PepsiCo Claude"}

event: final_stream
data: {"content": "After reviewing all inputs, here's the final answer..."}

event: done
data: {"messageId": "uuid-of-saved-message"}
```

Error case:
```
event: error
data: {"message": "Anthropic API rate limit exceeded"}
```

---

## Encryption

API keys are encrypted using AES-256-GCM before saving to DB.

```typescript
// lib/encryption.ts
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store as: iv:tag:encrypted (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encryptedHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  TOPBAR: Mosaic logo | [Client switcher ▼] | Settings   │
├────────────┬────────────────────────────────────────────┤
│            │                                            │
│  SIDEBAR   │         MAIN CONTENT                      │
│            │                                            │
│  ▼ PepsiCo │  [Task Board or Task Chat]                │
│    Frontend│                                            │
│    API     │                                            │
│  ▼ SpinQ.. │                                            │
│    Mobile  │                                            │
│  ▼ Bitcs   │                                            │
│  + New     │                                            │
│            │                                            │
└────────────┴────────────────────────────────────────────┘

Task Board View:
┌──────────┬──────────────┬──────────┬──────────┐
│ BACKLOG  │ IN PROGRESS  │  REVIEW  │   DONE   │
│          │              │          │          │
│ [Card]   │ [Card]       │ [Card]   │ [Card]   │
│ [Card]   │              │          │ [Card]   │
│ + Add    │              │          │          │
└──────────┴──────────────┴──────────┴──────────┘

Task Chat View (split):
┌───────────────────────────┬────────────────────────┐
│   Task Details            │   Chat Thread          │
│   Title: "Refactor auth"  │                        │
│   Status: In Progress     │  [You]: Start on this  │
│   Agents: Claude + Codex  │                        │
│   Instructions:           │  🤖 Claude analyzing.. │
│   "Extract token-verify   │  🤖 Codex reviewing... │
│   step..."                │  ✅ Final answer:       │
│                           │  "Here's the approach  │
│   [Edit] [Move to Review] │   ..."                 │
│                           │  [Message input]       │
└───────────────────────────┴────────────────────────┘
```
