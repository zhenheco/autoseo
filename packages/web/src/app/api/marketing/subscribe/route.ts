import { NextResponse } from "next/server";

import { addCfEmailSubscriber } from "@/lib/email/cf-email-client";

const newsletterList = "1wayseo-newsletter";

type SubscribeBody = {
  email?: unknown;
};

export async function POST(request: Request) {
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return jsonError("invalid_request", "Request body must be valid JSON", 400);
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return jsonError("invalid_email", "Email is invalid", 400);
  }

  try {
    const result = await addCfEmailSubscriber({
      email,
      list: newsletterList,
    });

    if (result.ok) {
      return NextResponse.json({ ok: true });
    }

    if (result.status === 409) {
      return jsonError(
        "already_subscribed",
        "Email is already subscribed",
        409,
      );
    }

    return jsonError(
      result.error ?? "subscribe_failed",
      "Unable to subscribe email",
      502,
    );
  } catch {
    return jsonError("subscribe_failed", "Unable to subscribe email", 502);
  }
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status });
}
