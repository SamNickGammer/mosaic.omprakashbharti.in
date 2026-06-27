import { asc, eq } from "drizzle-orm";

import { badRequest, getSessionUserId, json, unauthorized } from "@/lib/api";
import { db } from "@/lib/db";
import { agentAccounts } from "@/lib/db/schema";
import { encrypt, maskKey } from "@/lib/encryption";
import { PROVIDERS, type AgentAccountDTO, type AgentProviderId } from "@/types";
import { decrypt } from "@/lib/encryption";

const VALID_PROVIDERS = new Set<AgentProviderId>(PROVIDERS.map((p) => p.id));

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const rows = await db
    .select()
    .from(agentAccounts)
    .where(eq(agentAccounts.userId, userId))
    .orderBy(asc(agentAccounts.createdAt));

  const agents: AgentAccountDTO[] = rows.map((row) => {
    let keyPreview = "••••";
    try {
      keyPreview = maskKey(decrypt(row.apiKeyEncrypted));
    } catch {
      // If decryption fails (e.g. rotated ENCRYPTION_KEY), never leak anything.
      keyPreview = "••••";
    }
    return {
      id: row.id,
      displayName: row.displayName,
      provider: row.provider,
      model: row.model,
      baseUrl: row.baseUrl,
      keyPreview,
      createdAt: row.createdAt.toISOString(),
    };
  });

  return json({ agents });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  let body: {
    displayName?: string;
    provider?: AgentProviderId;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const displayName = body.displayName?.trim();
  if (!displayName) return badRequest("Display name is required");
  if (!body.provider || !VALID_PROVIDERS.has(body.provider)) {
    return badRequest("A valid provider is required");
  }
  const apiKey = body.apiKey?.trim();
  if (!apiKey) return badRequest("API key is required");

  const meta = PROVIDERS.find((p) => p.id === body.provider);
  const baseUrl = body.baseUrl?.trim() || null;
  if (meta?.requiresBaseUrl && !baseUrl) {
    return badRequest("A base URL is required for custom providers");
  }

  const [row] = await db
    .insert(agentAccounts)
    .values({
      userId,
      displayName,
      provider: body.provider,
      model: body.model?.trim() || null,
      apiKeyEncrypted: encrypt(apiKey),
      baseUrl,
    })
    .returning();

  const dto: AgentAccountDTO = {
    id: row.id,
    displayName: row.displayName,
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
    keyPreview: maskKey(apiKey),
    createdAt: row.createdAt.toISOString(),
  };

  return json({ agent: dto }, { status: 201 });
}
