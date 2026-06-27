import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Returns the authenticated user's internal id, or null if not signed in.
 * Every API route MUST scope its queries by this id.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong"): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}
