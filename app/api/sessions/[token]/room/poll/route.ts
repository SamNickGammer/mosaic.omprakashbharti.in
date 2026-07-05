import { roomMessagesForSession } from "@/lib/room";
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
  const since = new Date(
    parseInt(url.searchParams.get("since") ?? "0", 10) || 0,
  );
  const waitSeconds = Math.min(
    Math.max(parseInt(url.searchParams.get("wait") ?? "90", 10) || 90, 1),
    90,
  );
  const deadline = Date.now() + waitSeconds * 1000;

  while (Date.now() < deadline) {
    if (req.signal?.aborted) break;

    const messages = await roomMessagesForSession({ session, since });
    if (messages.length > 0) {
      return Response.json({ messages });
    }

    await sleep(2000);
  }

  return Response.json({ messages: [] });
}
