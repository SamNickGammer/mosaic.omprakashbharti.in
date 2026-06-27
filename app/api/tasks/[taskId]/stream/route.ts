import { getSessionUserId } from "@/lib/api";
import { getOwnedTask } from "@/lib/authz";
import { subscribe, unsubscribe } from "@/lib/sse/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: { taskId: string } };

export async function GET(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return new Response("Not found", { status: 404 });

  const taskId = task.id;
  const encoder = new TextEncoder();
  let keepalive: ReturnType<typeof setInterval> | undefined;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      subscribe(taskId, controller);
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
        unsubscribe(taskId, controller);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (keepalive) clearInterval(keepalive);
      if (controllerRef) unsubscribe(taskId, controllerRef);
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
