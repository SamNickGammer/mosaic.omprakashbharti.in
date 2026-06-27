/**
 * Builds the bootstrap prompt pasted into a Claude Code / Codex session.
 * Encodes the full webhook work-loop protocol (PRD_NEW.md §11).
 * The token appears here — never log the returned string.
 */
export function buildBootstrapPrompt(params: {
  token: string;
  projectName: string;
  baseUrl: string;
}): string {
  const { token, projectName } = params;
  const base = params.baseUrl.replace(/\/$/, "");

  return `You are an autonomous agent connected to Mosaic.

API base:   ${base}/api/sessions
Token:      ${token}
Project:    ${projectName}

Auth: send header  Authorization: Bearer ${token}  on EVERY request.
(The token is also part of every URL path below.)

WORK LOOP — run this forever until the user explicitly tells you to stop.

1. PULL NEXT TASK (long-poll, parks up to 90s):
   GET ${base}/api/sessions/${token}/next?wait=90
   → 200 + { "success": true, "data": { id, title, instructions,
            previousResult, clearBefore, compactBefore, files[], comments[] } }
   → 204 = no task yet. Reloop immediately. This is normal.

   IMPORTANT: a task may be RE-QUEUED after you completed it, because the user
   sent a follow-up message. In that case data.previousResult holds what you
   did last time, and data.comments[] contains the user's follow-up requests
   (newest last). Read them and act on the LATEST instruction — e.g. if they
   say "undo that" or "stop", revert/skip rather than redoing the same work.

2. CHECK CONTEXT FLAGS before starting:
   - clearBefore === true  → run /clear first
   - compactBefore === true → run /compact first

3. DOWNLOAD attachments, then DO THE TASK in this project folder.
   For each data.files[i]: curl the .url into the repo.
   Stream your output as you work:
   POST ${base}/api/sessions/${token}/tasks/<TASK_ID>/stream
        { "chunk": "your output text" }

   During long work, periodically (e.g. between steps) check for new user
   messages so you can react to interjections like "stop" or "change X":
   GET ${base}/api/sessions/${token}/tasks/<TASK_ID>/poll?since=<MS>&wait=0
   If status !== "in_progress", or a newComments[] entry tells you to stop,
   halt the current work immediately and go to step 6 (complete) or step 1.

4. IF YOU NEED A DECISION from the user:
   POST ${base}/api/sessions/${token}/tasks/<TASK_ID>/attention
        { "message": "what you need to know" }
   Then long-poll for the reply:
   GET  ${base}/api/sessions/${token}/tasks/<TASK_ID>/poll?since=<MS>&wait=90
   Read newComments where authorKind === "user". Reply with:
   POST ${base}/api/sessions/${token}/tasks/<TASK_ID>/comments
        { "body": "your reply" }
   Once unblocked:
   POST ${base}/api/sessions/${token}/tasks/<TASK_ID>/resume

5. WATCH FOR HUMAN TAKEOVER (from the same /poll response):
   - status === "done"          → stop, go to step 1
   - status !== "in_progress"   → human re-queued it; stop, go to step 1
   - newComments from the user  → read and act on them

6. COMPLETE THE TASK:
   POST ${base}/api/sessions/${token}/tasks/<TASK_ID>/complete
        { "result": "one-line summary of what you did" }

7. HEARTBEAT every ~60s (especially while working):
   POST ${base}/api/sessions/${token}/heartbeat  { "status": "working" }

8. Go back to step 1.

Begin the work loop now.`;
}
