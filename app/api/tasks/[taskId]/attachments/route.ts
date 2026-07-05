import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { put } from "@vercel/blob";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { getOwnedTask } from "@/lib/authz";
import { db } from "@/lib/db";
import { taskAttachments } from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: { taskId: string } };

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days while the task is open

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return notFound("Task not found");

  const rows = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, task.id))
    .orderBy(asc(taskAttachments.createdAt));

  return json({
    attachments: rows.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return notFound("Task not found");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return badRequest(
      "File storage is not configured (set BLOB_READ_WRITE_TOKEN).",
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return badRequest("Expected multipart/form-data with a 'file' field");
  }
  if (!file) return badRequest("No file provided");
  if (file.size > MAX_BYTES) return badRequest("File exceeds 50 MB");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const blob = await put(
    `tasks/${task.id}/${crypto.randomUUID()}-${safeName}`,
    file,
    { access: "public", token: process.env.BLOB_READ_WRITE_TOKEN },
  );

  const [row] = await db
    .insert(taskAttachments)
    .values({
      taskId: task.id,
      name: file.name,
      url: blob.url,
      mime: file.type || null,
      sizeBytes: file.size,
      expiresAt: new Date(Date.now() + RETENTION_MS),
    })
    .returning();

  return json(
    {
      attachment: {
        id: row.id,
        name: row.name,
        url: row.url,
        mime: row.mime,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
