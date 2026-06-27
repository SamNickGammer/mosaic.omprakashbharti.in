import { and, asc, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessionMessages } from "@/lib/db/schema";
import { sleep, verifySessionToken } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

type Params = { params: { token: string } };

export async function GET(req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const since = new Date(parseInt(url.searchParams.get("since") ?? "0", 10) || 0);
  const waitSeconds = Math.min(
    Math.max(parseInt(url.searchParams.get("wait") ?? "90", 10) || 90, 1),
    90,
  );
  const deadline = Date.now() + waitSeconds * 1000;

  while (Date.now() < deadline) {
    if (req.signal?.aborted) break;

    const rows = await db
      .select()
      .from(sessionMessages)
      .where(
        and(
          eq(sessionMessages.sessionId, session.id),
          eq(sessionMessages.authorKind, "user"),
          gt(sessionMessages.createdAt, since),
        ),
      )
      .orderBy(asc(sessionMessages.createdAt));

    if (rows.length > 0) {
      return Response.json({
        messages: rows.map((m) => ({
          authorKind: m.authorKind,
          content: m.content,
          createdAt: m.createdAt.getTime(),
        })),
      });
    }

    await sleep(2000);
  }

  return Response.json({ messages: [] });
}
