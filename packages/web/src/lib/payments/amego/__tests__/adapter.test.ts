import { describe, expect, it, vi } from "vitest";

import {
  AmegoFatalError,
  AmegoRetryableError,
  createAmegoAdapter,
  type AmegoIssueInput,
} from "../adapter";

const input: AmegoIssueInput = {
  stripeInvoiceId: "in_test_123",
  amountUsd: 29,
  amountTwd: 899,
  buyer: {
    name: "Buyer Chen",
    email: "buyer@example.com",
    taxId: "12345678",
    country: "TW",
  },
  items: [
    {
      description: "1WaySEO Solo monthly subscription",
      quantity: 1,
      unitPriceTwd: 899,
    },
  ],
};

describe("Amego adapter", () => {
  it("returns invoice number and issued date on a 200 response", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        invoiceNumber: "AB12345678",
        issuedAt: "2026-05-21T03:00:00.000Z",
      }),
    );
    const adapter = createAmegoAdapter({
      microserviceUrl: "https://affiliate.1wayseo.com/api/amego/issue",
      hmacSecret: "test-secret",
      fetch: fetchMock,
    });

    const result = await adapter.issueInvoice(input);

    expect(result.invoiceNumber).toBe("AB12345678");
    expect(result.issuedAt).toEqual(new Date("2026-05-21T03:00:00.000Z"));
  });

  it("includes the Stripe invoice id as the Idempotency-Key header", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        invoiceNumber: "AB12345678",
        issuedAt: "2026-05-21T03:00:00.000Z",
      }),
    );
    const adapter = createAmegoAdapter({
      microserviceUrl: "https://affiliate.1wayseo.com/api/amego/issue",
      hmacSecret: "test-secret",
      fetch: fetchMock,
    });

    await adapter.issueInvoice(input);

    const request = fetchCallOptions(fetchMock);
    expect(request?.headers).toMatchObject({
      "Idempotency-Key": "in_test_123",
    });
  });

  it("signs the request body with HMAC-SHA256", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        invoiceNumber: "AB12345678",
        issuedAt: "2026-05-21T03:00:00.000Z",
      }),
    );
    const adapter = createAmegoAdapter({
      microserviceUrl: "https://affiliate.1wayseo.com/api/amego/issue",
      hmacSecret: "test-secret",
      fetch: fetchMock,
    });

    await adapter.issueInvoice(input);

    const request = fetchCallOptions(fetchMock);
    const headers = request?.headers as Record<string, string>;
    expect(headers["X-1wayseo-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    await expectSignatureToVerify(
      String(request?.body),
      "test-secret",
      headers["X-1wayseo-Signature"],
    );
  });

  it("throws a retryable error for 5xx responses", async () => {
    const adapter = createAmegoAdapter({
      microserviceUrl: "https://affiliate.1wayseo.com/api/amego/issue",
      hmacSecret: "test-secret",
      fetch: vi.fn(async () =>
        Response.json({ error: "upstream_unavailable" }, { status: 503 }),
      ),
    });

    await expect(adapter.issueInvoice(input)).rejects.toBeInstanceOf(
      AmegoRetryableError,
    );
  });

  it("throws a fatal error for 4xx responses", async () => {
    const adapter = createAmegoAdapter({
      microserviceUrl: "https://affiliate.1wayseo.com/api/amego/issue",
      hmacSecret: "test-secret",
      fetch: vi.fn(async () =>
        Response.json({ error: "invalid_request" }, { status: 400 }),
      ),
    });

    await expect(adapter.issueInvoice(input)).rejects.toBeInstanceOf(
      AmegoFatalError,
    );
  });
});

async function expectSignatureToVerify(
  body: string,
  secret: string,
  signature: string | undefined,
) {
  const expected = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    ),
    new TextEncoder().encode(body),
  );
  const hex = Array.from(new Uint8Array(expected))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  expect(signature).toBe(`sha256=${hex}`);
}

function fetchCallOptions(fetchMock: unknown): RequestInit | undefined {
  const calls = (fetchMock as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[0]?.[1] as RequestInit | undefined;
}
