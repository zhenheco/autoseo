import { createHmac, timingSafeEqual } from "crypto";

export function createAuditLeadUnsubscribeToken(leadId: string) {
  const signature = signLeadId(leadId);
  return `${encodeURIComponent(leadId)}.${signature}`;
}

export function verifyAuditLeadUnsubscribeToken(token: string) {
  const [encodedLeadId, signature, ...extra] = token.split(".");
  if (!encodedLeadId || !signature || extra.length > 0) return null;

  let leadId: string;
  try {
    leadId = decodeURIComponent(encodedLeadId);
  } catch {
    return null;
  }

  const expected = signLeadId(leadId);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;

  return timingSafeEqual(actualBuffer, expectedBuffer) ? leadId : null;
}

function signLeadId(leadId: string) {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error("oauth_state_secret_not_configured");
  }

  return createHmac("sha256", secret).update(leadId).digest("base64url");
}
