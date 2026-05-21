import type { renderAuditDigestEmail } from "./audit-digest-template";
import type { renderAuditNurtureEmail } from "./audit-nurture-template";

export async function sendAuditDigestEmail(input: {
  to: string;
  template: ReturnType<typeof renderAuditDigestEmail>;
  idempotencyKey: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  return sendCfEmail({
    to: input.to,
    template: input.template,
    idempotencyKey: input.idempotencyKey,
    tags: ["audit-weekly-digest"],
  });
}

export async function sendAuditNurtureEmail(input: {
  to: string;
  template: ReturnType<typeof renderAuditNurtureEmail>;
  idempotencyKey: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  return sendCfEmail({
    to: input.to,
    template: input.template,
    idempotencyKey: input.idempotencyKey,
    tags: ["audit-nurture"],
  });
}

async function sendCfEmail(input: {
  to: string;
  template: { subject: string; html: string; text: string };
  idempotencyKey: string;
  tags: string[];
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiUrl = process.env.CF_EMAIL_API_URL;
  const apiToken =
    process.env.CF_EMAIL_API_TOKEN ?? process.env.CF_EMAIL_API_KEY;

  if (!apiUrl || !apiToken) {
    throw new Error("cf_email_not_configured");
  }

  const response = await fetch(resolveSendUrl(apiUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiToken,
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      to: input.to,
      from: process.env.CF_EMAIL_FROM ?? "noreply@1wayseo.com",
      subject: input.template.subject,
      html: input.template.html,
      text: input.template.text,
      tags: input.tags,
    }),
  });

  const body = await readResponseBody(response);

  if (!response.ok) {
    return {
      ok: false,
      error:
        typeof body?.error === "object" && body.error && "code" in body.error
          ? String(body.error.code)
          : `cf_email_send_failed_${response.status}`,
    };
  }

  return {
    ok: true,
    messageId:
      typeof body?.id === "string"
        ? body.id
        : typeof body?.messageId === "string"
          ? body.messageId
          : undefined,
  };
}

function resolveSendUrl(apiUrl: string) {
  const trimmed = apiUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/send") ? trimmed : `${trimmed}/send`;
}

async function readResponseBody(response: Response) {
  try {
    return (await response.json()) as {
      id?: unknown;
      messageId?: unknown;
      error?: unknown;
    } | null;
  } catch {
    return null;
  }
}
