import type { renderAuditDigestEmail } from "./audit-digest-template";
import type { renderAuditNurtureEmail } from "./audit-nurture-template";

export type TransactionalTemplateName =
  | "trial_d3"
  | "trial_d1"
  | "converted"
  | "cancelled"
  | "expired"
  | "payment_failed"
  | "payment_failed_d1";

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

export async function enqueueTransactionalTemplateEmail(input: {
  to: string;
  template: TransactionalTemplateName;
  idempotencyKey: string;
  context?: Record<string, string | number | boolean | null | undefined>;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  return sendCfEmail({
    to: input.to,
    template: renderTransactionalTemplate(input.template),
    idempotencyKey: input.idempotencyKey,
    tags: ["stripe-webhook", `template:${input.template}`],
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

function renderTransactionalTemplate(template: TransactionalTemplateName): {
  subject: string;
  html: string;
  text: string;
} {
  switch (template) {
    case "trial_d3":
      return basicTemplate(
        "Your 1WaySEO trial ends in 3 days",
        "Your trial is ending soon. Your subscription will begin automatically when the trial ends.",
      );
    case "trial_d1":
      return basicTemplate(
        "Your 1WaySEO trial ends tomorrow",
        "Your trial ends tomorrow. Your subscription will begin automatically when the trial ends.",
      );
    case "converted":
      return basicTemplate(
        "Your 1WaySEO subscription is active",
        "Your payment was received and your subscription is now active.",
      );
    case "cancelled":
      return basicTemplate(
        "Your 1WaySEO subscription was cancelled",
        "Your subscription has been cancelled. Your workspace is now limited to read-only access.",
      );
    case "expired":
      return basicTemplate(
        "Your 1WaySEO trial expired",
        "Your trial has expired. Add a payment method to continue using 1WaySEO.",
      );
    case "payment_failed":
    case "payment_failed_d1":
      return basicTemplate(
        "Payment failed for your 1WaySEO subscription",
        "We could not process your latest payment. Please update your billing details to keep your workspace active.",
      );
  }
}

function basicTemplate(subject: string, text: string) {
  return {
    subject,
    text,
    html: `<p>${escapeHtml(text)}</p>`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
