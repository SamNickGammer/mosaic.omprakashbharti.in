# Phase 3 — Integrations & Direct Chat

**Status:** 🟡 Partial (~40%) — the **Connectors** foundation shipped early in
Phase 2.5; OAuth flows and outbound notifications remain.

---

## Done vs Remaining

| Item | Status | Notes |
|------|--------|-------|
| Client‑scoped connector store (Slack/Gmail/Google/WhatsApp/GitHub/Custom) | ✅ | `connectors` table, migration `0007` |
| Encrypted secret per connector (AES‑256‑GCM) | ✅ | masked in browser, decrypted only for agents |
| Browser CRUD, owner‑scoped | ✅ | `/api/clients/[id]/connectors(+/[connectorId])` |
| Agent fetch endpoint (decrypted, client‑scoped) | ✅ | `GET /api/sessions/[token]/connectors` |
| `/connectors` page (per client, add/edit/delete) | ✅ | sidebar item |
| Bootstrap prompt tells agents to fetch + use connectors | ✅ | agent acts **locally** with the creds |
| Direct chat with a session (outside a task) | ✅→❌ | built then **removed** (see change A4 in phase‑2) |
| **GitHub OAuth** per client | ⬜ | today: manual token in a connector |
| **Slack OAuth** per client | ⬜ | today: manual token in a connector |
| **Slack notifications** on attention / task‑complete | ⬜ | outbound push not built |
| Integration‑aware server actions (`/api/clients/[id]/integrations/...`) | ⬜ | agents act locally instead |
| **Jira** one‑way import (issues → tasks) | ⬜ | Phase 4 per PRD §12.3 |
| Custom webhook out (task_complete / attention / offline) | ⬜ | Phase 4 |

---

## What shipped: Connectors

A **connector** is a service a *client* has connected, stored so the client's
agents can act on it. Fields (`connectors` table, client‑scoped):

| Field | Meaning |
|-------|---------|
| `type` | slack · gmail · google · whatsapp · github · custom |
| `name` | label |
| `account` | the handle the client provides (Slack channel, email, phone, org/repo) — **not secret** |
| `details` | free‑text instructions for the agent (how/when to use it) |
| `secret_encrypted` | optional token / app password, AES‑256‑GCM |

**Isolation.** Connectors are strictly **per client**. The browser API filters
by `getOwnedClient(userId, clientId)`; the agent endpoint resolves the session's
`project → client` and returns only that client's connectors. One client's
connectors are never visible to another client or its agents.

**How an agent uses it.** The agent (running the loop on the developer's
machine) calls `GET /api/sessions/[token]/connectors`, receives `account`,
`details`, and the **decrypted** `secret`, then performs the action *locally*
(e.g. logs into Slack and posts). Mosaic stores the reference + creds; the local
agent does the doing. Secrets are never streamed or logged.

**Files:** `lib/db/schema.ts` (`connectors`), `lib/connector-meta.ts`
(labels/icons), `app/api/clients/[id]/connectors/**`,
`app/api/sessions/[token]/connectors`, `components/connectors/*`,
`app/(dashboard)/connectors/page.tsx`.

---

## Change A2 — "Integrations" became "Connectors"

`ARCHITECTURE_NEW.md` / `PRD_NEW.md` planned a `client_integrations` table with
**OAuth** for GitHub and Slack, and server‑side integration actions. We shipped a
broader, simpler **`connectors`** model instead:

| PRD plan | What shipped |
|----------|--------------|
| `client_integrations` (github, slack) | `connectors` (6 types incl. gmail/whatsapp/custom) |
| OAuth connect flow | manual `account` + encrypted `secret` |
| Server calls the integration API | **agent** calls the service locally with the creds |
| `/api/clients/[id]/integrations/[provider]/[action]` | not built (agent‑local instead) |

**Why:** it matches the product reality — the agent already runs on a machine
that can log in and act; Mosaic just needs to *hand it the details*. OAuth stays
as the Phase‑3 completion goal for services where a token isn't enough.

---

## Pre‑plan: completing Phase 3

1. **GitHub OAuth per client** — OAuth app, callback, store the token as a
   `github` connector (encrypted). Optionally an integration‑aware action route
   for server‑side calls (issues, PR status) when the agent isn't the actor.
2. **Slack OAuth per client** — Slack app + bot token; store as a `slack`
   connector; scopes for `chat:write` + channel read.
3. **Slack notifications** — on `attention` and `complete` SSE events, if the
   client has a Slack connector with notifications enabled, POST to the channel.
   Add a per‑connector "notify on attention / complete" toggle.
4. **Integration‑aware session actions** — optional
   `/api/clients/[id]/integrations/[provider]/[action]` so an agent (or Mosaic)
   can call a service through Mosaic instead of holding the token locally.
5. **Jira import** (PRD §12.3) — connect via API token (a `custom`/`jira`
   connector), one‑way sync issues → tasks. (May land in Phase 4.)

**Architecture note if built:** adding OAuth introduces provider callback routes
(`/api/auth/callback/[provider]` style or dedicated integration callbacks) and,
if server‑side actions are added, a new outbound‑call layer — both are *additive*
to the current diagram; update the System Overview's "Session Manager" box with
an "Integrations" sibling and note it here.
