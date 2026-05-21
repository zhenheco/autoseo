import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@shared/supabase", () => supabaseMocks);

type TableName = "shopline_gdpr_redact_log";

function createSupabaseMock() {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    calls,
    from(table: TableName) {
      return {
        insert(payload: unknown) {
          calls.push({ table, method: "insert", args: [payload] });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
}

async function post(body: unknown, headers?: HeadersInit) {
  const { POST } = await import("../route");
  return POST(
    new Request(
      "https://1wayseo.com/api/shopline/webhooks/gdpr-customer-redact",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
    ),
  );
}

async function signBody(body: unknown) {
  const rawBody = JSON.stringify(body);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("shopline-client-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
}

describe("POST /api/shopline/webhooks/gdpr-customer-redact", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("SHOPLINE_CLIENT_SECRET", "shopline-client-secret");
    vi.spyOn(console, "info").mockImplementation(() => {});
    supabaseMocks.createAdminClient.mockReturnValue(createSupabaseMock());
  });

  it("returns 401 when the HMAC header is missing", async () => {
    const response = await post({});

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_hmac",
    });
  });

  it("returns 401 when the HMAC header is invalid", async () => {
    const response = await post(
      { shop_id: "shop-1", shop_domain: "demo.myshopline.com" },
      { "X-SHOPLINE-Hmac-Sha256": "invalid-signature" },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_hmac",
    });
  });

  it("accepts a valid HMAC and logs the webhook receipt", async () => {
    const body = {
      shop_id: "shop-1",
      shop_domain: "demo.myshopline.com",
      orders_requested: [],
    };
    const supabase = createSupabaseMock();
    supabaseMocks.createAdminClient.mockReturnValue(supabase);

    const response = await post(body, {
      "X-SHOPLINE-Hmac-Sha256": await signBody(body),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(supabase.calls).toContainEqual({
      table: "shopline_gdpr_redact_log",
      method: "insert",
      args: [
        expect.objectContaining({
          webhook_type: "customer-redact",
          shop_id: "shop-1",
          shop_domain: "demo.myshopline.com",
          payload_summary: "customer email absent; scrubbed: 0 rows",
          result: "processed",
        }),
      ],
    });
  });
});
