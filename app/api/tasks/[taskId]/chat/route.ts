import { asc, eq } from "drizzle-orm";
import type { ModelMessage } from "ai";

import { getSessionUserId } from "@/lib/api";
import { getOwnedTask } from "@/lib/authz";
import { db } from "@/lib/db";
import { taskMessages, tasks } from "@/lib/db/schema";
import {
  buildSystemPrompt,
  defaultModelFor,
  loadPrimaryAgent,
} from "@/lib/orchestrator";
import { streamAnthropic } from "@/lib/orchestrator/providers/anthropic";

// Streaming + Node crypto (decrypt) require the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { taskId: string } };

/** Format a named SSE event exactly as specified in ARCHITECTURE.md. */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return new Response("Not found", { status: 404 });

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const message = String(body.message ?? "").trim();
  if (!message) return new Response("Message is required", { status: 400 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      try {
        const ctx = await loadPrimaryAgent(task);
        if (!ctx) {
          send("error", {
            message:
              "No primary agent is assigned to this project. Assign one in the project's Edit dialog.",
          });
          controller.close();
          return;
        }

        const { project, agent, apiKey } = ctx;

        if (agent.provider !== "anthropic") {
          send("error", {
            message: `The primary agent uses "${agent.provider}", which isn't supported yet — multi-provider support arrives in Phase 3. Set an Anthropic agent as primary for now.`,
          });
          controller.close();
          return;
        }

        // Persist the incoming user message first so it's part of history.
        await db
          .insert(taskMessages)
          .values({ taskId: task.id, role: "user", content: message });

        // Build conversation history (chat messages only, no traces).
        const history = await db
          .select()
          .from(taskMessages)
          .where(eq(taskMessages.taskId, task.id))
          .orderBy(asc(taskMessages.createdAt));
        const conversation: ModelMessage[] = history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        const system = buildSystemPrompt(project, task);
        const model = agent.model ?? defaultModelFor(agent.provider);

        // STEP 1: PRIMARY ANALYSIS (streamed)
        send("primary_start", { agentName: agent.displayName });

        const result = streamAnthropic({
          apiKey,
          model,
          system,
          messages: conversation,
        });

        // Consume fullStream (not textStream) so provider errors surface as
        // `error` parts instead of silently ending an empty stream.
        let full = "";
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            full += part.text;
            send("primary_stream", { content: part.text });
          } else if (part.type === "error") {
            throw part.error instanceof Error
              ? part.error
              : new Error(String(part.error));
          }
        }

        if (!full.trim()) {
          throw new Error("The agent returned an empty response.");
        }

        send("primary_done", {});

        // STEP 2 (Phase 2): persist the assistant message.
        const [saved] = await db
          .insert(taskMessages)
          .values({
            taskId: task.id,
            role: "assistant",
            content: full,
            agentId: agent.id,
          })
          .returning({ id: taskMessages.id });

        await db
          .update(tasks)
          .set({ updatedAt: new Date() })
          .where(eq(tasks.id, task.id));

        send("done", { messageId: saved?.id });
        controller.close();
      } catch (err) {
        // Surface a safe message — never include the API key.
        const messageText =
          err instanceof Error ? err.message : "Failed to generate a response";
        send("error", { message: messageText });
        controller.close();
      }
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
