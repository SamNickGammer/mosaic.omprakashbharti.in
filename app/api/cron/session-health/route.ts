import { and, inArray, lt, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";
import { broadcast } from "@/lib/sse/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFFLINE_AFTER_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const threshold = new Date(Date.now() - OFFLINE_AFTER_MS);

  const stale = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        lt(agentSessions.lastSeenAt, threshold),
        ne(agentSessions.status, "offline"),
      ),
    );

  if (stale.length > 0) {
    await db
      .update(agentSessions)
      .set({ status: "offline" })
      .where(
        inArray(
          agentSessions.id,
          stale.map((s) => s.id),
        ),
      );

    for (const s of stale) {
      if (s.currentTaskId) {
        broadcast(s.currentTaskId, "status", {
          sessionId: s.id,
          status: "offline",
        });
      }
    }
  }

  return Response.json({ ok: true, markedOffline: stale.length });
}
