import { db } from "@/lib/db";
import { sessionMessages } from "@/lib/db/schema";
import { verifySessionToken } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

export async function POST(req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = String(body.message ?? "").trim();
  if (!content) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  await db.insert(sessionMessages).values({
    sessionId: session.id,
    authorKind: "agent",
    content,
  });

  return Response.json({ ok: true });
}
