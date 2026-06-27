/**
 * In-memory SSE pub/sub keyed by task id.
 *
 * Sessions POST output; we fan it out to any browser subscribed to that task's
 * `/api/tasks/[id]/stream`. Persisted on globalThis so it survives Next dev
 * hot-reloads. Single-instance only — Phase 4 swaps in Vercel KV / Neon
 * LISTEN-NOTIFY for multi-instance (see ARCHITECTURE_NEW.md).
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

const globalForSse = globalThis as unknown as {
  __mosaicSseChannels?: Map<string, Set<SSEController>>;
};

const channels: Map<string, Set<SSEController>> =
  globalForSse.__mosaicSseChannels ??
  (globalForSse.__mosaicSseChannels = new Map());

const encoder = new TextEncoder();

export function subscribe(taskId: string, controller: SSEController): void {
  let set = channels.get(taskId);
  if (!set) {
    set = new Set();
    channels.set(taskId, set);
  }
  set.add(controller);
}

export function unsubscribe(taskId: string, controller: SSEController): void {
  const set = channels.get(taskId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) channels.delete(taskId);
}

/**
 * Broadcast a named SSE event to all subscribers of a task.
 * Event format (per ARCHITECTURE_NEW.md):
 *   event: <type>\ndata: <json>\n\n
 */
export function broadcast(
  taskId: string,
  type: "chunk" | "attention" | "complete" | "status",
  data: Record<string, unknown>,
): void {
  const set = channels.get(taskId);
  if (!set || set.size === 0) return;
  const payload = encoder.encode(
    `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
  );
  for (const controller of set) {
    try {
      controller.enqueue(payload);
    } catch {
      set.delete(controller);
    }
  }
}
