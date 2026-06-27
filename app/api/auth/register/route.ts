import { eq } from "drizzle-orm";

import { badRequest, json, serverError } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = body.name?.trim() || null;
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !EMAIL_RE.test(email)) {
    return badRequest("A valid email is required");
  }
  if (password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  const [existing] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    // Allow setting a password on an OAuth-only account; block true duplicates.
    if (existing.passwordHash) {
      return badRequest("An account with this email already exists");
    }
    await db
      .update(users)
      .set({ passwordHash: hashPassword(password), name })
      .where(eq(users.id, existing.id));
    return json({ ok: true }, { status: 200 });
  }

  try {
    await db.insert(users).values({
      email,
      name,
      passwordHash: hashPassword(password),
    });
  } catch {
    return serverError("Could not create account");
  }

  return json({ ok: true }, { status: 201 });
}
