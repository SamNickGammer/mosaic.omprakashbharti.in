/**
 * In-memory SSE pub/sub keyed by a channel string.
 *
 * Two kinds of channel:
 *   - a task id            → per-task stream (`/api/tasks/[id]/stream`)
 *   - `room:<projectId>`   → the project room chat (`/api/projects/[id]/room/stream`)
 *
 * Sessions POST output/messages; we fan them out to any browser subscribed to
 * the matching channel. Persisted on globalThis so it survives Next dev
 * hot-reloads. Single-instance only — Phase 4 swaps in Vercel KV / Neon
 * LISTEN-NOTIFY for multi-instance (see ARCHITECTURE_NEW.md).
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

/** Channel key for a project's room chat. */
export const roomChannel = (projectId: string) => `room:${projectId}`;

const globalForSse = globalThis as unknown as {
  __mosaicSseChannels?: Map<string, Set<SSEController>>;
};

const channels: Map<string, Set<SSEController>> =
  globalForSse.__mosaicSseChannels ??
  (globalForSse.__mosaicSseChannels = new Map());

const encoder = new TextEncoder();

export function subscribe(channel: string, controller: SSEController): void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(controller);
}

export function unsubscribe(channel: string, controller: SSEController): void {
  const set = channels.get(channel);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) channels.delete(channel);
}

/**
 * Broadcast a named SSE event to all subscribers of a channel (a task id, or a
 * `room:<projectId>` key).
 * Event format (per ARCHITECTURE_NEW.md):
 *   event: <type>\ndata: <json>\n\n
 */
export function broadcast(
  channel: string,
  type: "chunk" | "attention" | "complete" | "status" | "room_message",
  data: Record<string, unknown>,
): void {
  const set = channels.get(channel);
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
