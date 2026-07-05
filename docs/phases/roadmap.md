# Mosaic — Roadmap & Pre‑Plan (all phases)

A single forward‑looking view. Phases 1–2.5 are done; this file pre‑plans 3, 4,
and beyond so anyone can see the whole arc. Per‑phase detail lives in the sibling
files; this is the sequencing + rationale.

---

## Timeline

| Phase | Title | State | Headline outcome |
|------:|-------|-------|------------------|
| 1 | Foundation | ✅ | Auth, data model, encrypted agents, Kanban |
| 2 | Sessions & Webhook Protocol | ✅ | Live agents connect + run a work loop |
| 2.5 | Multi‑Agent Rooms & Connectors | ✅ | Agents talk to each other; connectors; review; upload |
| 3 | Integrations & Direct Chat | 🟡 | OAuth (GitHub/Slack), Slack notifications |
| 4 | Polish, Orchestration & Scale | ⬜ | Multi‑instance SSE, dashboards, deploy |
| 5 | Server‑assisted orchestration | ⬜ | Optional server‑driven multi‑agent rounds + traces |
| 6 | Team / multi‑user | ⬜ | Beyond single‑user (currently out of scope) |

---

## Phase 3 — complete the integration story
**Goal:** turn manually‑entered connector creds into first‑class OAuth
integrations and make Mosaic *push* to services.

1. GitHub OAuth per client → store token as a `github` connector.
2. Slack OAuth per client → bot token connector, `chat:write`.
3. Outbound Slack notifications on `attention` / `complete` (per‑connector toggle).
4. Optional integration‑aware server actions
   (`/api/clients/[id]/integrations/[provider]/[action]`).
5. Jira token connector + one‑way issue import (may slip to Phase 4).

**Dependencies:** none blocking; builds on the `connectors` table.
**Architecture delta to log:** OAuth callback routes + (optional) outbound‑call
layer beside the Session Manager.

---

## Phase 4 — production hardening
**Goal:** remove the single‑instance ceiling and ship.

1. **Shared SSE bus** (Neon `LISTEN/NOTIFY` or KV) — unblocks horizontal scale.
2. **True long‑poll wakeup** (<500ms) on the same bus.
3. **Live session grid** dashboard + richer metrics.
4. **Attachment retention cron** (sweep `expires_at`).
5. Custom webhook out; error/empty/loading polish.
6. **Deploy** (Vercel + Neon prod), migration baseline cleanup, README + demo.

**Dependencies:** SSE bus should land before any multi‑instance deploy.
**Architecture delta to log:** external pub/sub bus; `orchestration_traces` may
start being written if server orchestration (Phase 5) is pulled forward.

---

## Phase 5 — server‑assisted orchestration (optional)
**Goal:** a *second* orchestration mode where Mosaic drives multi‑agent rounds
itself (create ask‑tasks, wait, judge, synthesize), recording each step in the
**currently‑dormant `orchestration_traces`** table and showing a trace view.
Complements — does not replace — the cooperative room model from Phase 2.5.

---

## Phase 6+ — beyond v1 (currently out of scope, PRD §15)
- Team / multi‑user on one workspace (real‑time collaboration).
- Mobile app (web‑responsive is the v1 bar).
- Billing / subscriptions.
- Voice input.

---

## Standing conventions for future phases
- **Every architecture or diagram change gets logged** in `README.md` §4 with a
  new `A#` id and a pointer to the phase file that explains it.
- **Migrations:** DB is `drizzle-kit push`‑managed today; before Phase 4 deploy,
  establish a clean `migrate` baseline (see `README.md` §3).
- **Data isolation** (row‑level `user_id`, client‑scoped connectors) and
  **AES‑256‑GCM** for secrets are invariants — keep them in every new surface.
