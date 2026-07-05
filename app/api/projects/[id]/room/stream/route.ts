import { getSessionUserId } from "@/lib/api";
import { getOwnedProject } from "@/lib/authz";
import { roomChannel, subscribe, unsubscribe } from "@/lib/sse/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const project = await getOwnedProject(userId, params.id);
  if (!project) return new Response("Not found", { status: 404 });

  const channel = roomChannel(project.id);
  const encoder = new TextEncoder();
  let keepalive: ReturnType<typeof setInterval> | undefined;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      subscribe(channel, controller);
      controller.enqueue(encoder.encode(": connected\n\n"));
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* closed */
        }
      }, 30000);

      req.signal?.addEventListener("abort", () => {
        if (keepalive) clearInterval(keepalive);
        unsubscribe(channel, controller);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (keepalive) clearInterval(keepalive);
      if (controllerRef) unsubscribe(channel, controllerRef);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
