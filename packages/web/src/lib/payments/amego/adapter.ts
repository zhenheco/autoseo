export interface AmegoIssueInput {
  stripeInvoiceId: string;
  amountUsd: number;
  amountTwd: number;
  buyer: {
    name: string;
    email: string;
    taxId?: string;
    country: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPriceTwd: number;
  }>;
}

export interface AmegoIssueResult {
  invoiceNumber: string;
  issuedAt: Date;
}

export interface AmegoAdapter {
  issueInvoice(input: AmegoIssueInput): Promise<AmegoIssueResult>;
}

export class AmegoFatalError extends Error {
  override readonly name = "AmegoFatalError";
}

export class AmegoRetryableError extends Error {
  override readonly name = "AmegoRetryableError";
}

export function createAmegoAdapter(deps: {
  microserviceUrl: string;
  hmacSecret: string;
  fetch: typeof fetch;
}): AmegoAdapter {
  return {
    async issueInvoice(input) {
      const body = JSON.stringify(input);
      const signature = await signBody(body, deps.hmacSecret);
      let response: Response;

      try {
        response = await deps.fetch(deps.microserviceUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": input.stripeInvoiceId,
            "X-1wayseo-Signature": signature,
          },
          body,
        });
      } catch (error) {
        throw new AmegoRetryableError(
          `Amego microservice request failed: ${errorMessage(error)}`,
        );
      }

      if (response.status >= 500) {
        throw new AmegoRetryableError(
          `Amego microservice returned ${response.status}: ${await responseText(response)}`,
        );
      }

      if (response.status >= 400) {
        throw new AmegoFatalError(
          `Amego microservice rejected request ${response.status}: ${await responseText(response)}`,
        );
      }

      const parsed = await readIssueResponse(response);
      return {
        invoiceNumber: parsed.invoiceNumber,
        issuedAt: new Date(parsed.issuedAt),
      };
    },
  };
}

async function signBody(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return `sha256=${toHex(new Uint8Array(signature))}`;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readIssueResponse(response: Response) {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AmegoFatalError("Amego microservice returned invalid JSON");
  }

  const candidate = body as {
    invoiceNumber?: unknown;
    issuedAt?: unknown;
  } | null;

  if (
    !candidate ||
    typeof candidate.invoiceNumber !== "string" ||
    typeof candidate.issuedAt !== "string" ||
    Number.isNaN(new Date(candidate.issuedAt).getTime())
  ) {
    throw new AmegoFatalError("Amego microservice response shape is invalid");
  }

  return {
    invoiceNumber: candidate.invoiceNumber,
    issuedAt: candidate.issuedAt,
  };
}

async function responseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "<unreadable>";
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
