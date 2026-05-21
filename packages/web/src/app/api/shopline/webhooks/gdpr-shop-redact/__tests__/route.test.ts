import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@shared/supabase", () => supabaseMocks);

type TableName =
  | "audit_fix_log"
  | "audit_issues"
  | "audit_reports"
  | "shopline_connections"
  | "shopline_gdpr_redact_log";

function createSupabaseMock() {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const responses: Record<string, unknown> = {
    "shopline_connections.maybeSingle": {
      data: { website_id: "website-1" },
      error: null,
    },
    "audit_reports.select": {
      data: [{ id: "report-1" }],
      error: null,
    },
    "audit_issues.select": {
      data: [{ id: "issue-1" }],
      error: null,
    },
  };

  return {
    calls,
    from(table: TableName) {
      const builder = {
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        update(...args: unknown[]) {
          calls.push({ table, method: "update", args });
          return builder;
        },
        delete(...args: unknown[]) {
          calls.push({ table, method: "delete", args });
          return builder;
        },
        insert(payload: unknown) {
          calls.push({ table, method: "insert", args: [payload] });
          return Promise.resolve({ data: null, error: null });
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        in(...args: unknown[]) {
          calls.push({ table, method: "in", args });
          return builder;
        },
        maybeSingle: vi.fn(async () => {
          calls.push({ table, method: "maybeSingle", args: [] });
          return (
            responses[`${table}.maybeSingle`] ?? { data: null, error: null }
          );
        }),
        then(
          resolve: (value: { data: unknown; error: unknown }) => void,
          reject: (reason?: unknown) => void,
        ) {
          const response = responses[`${table}.select`] ?? {
            data: null,
            error: null,
          };
          return Promise.resolve(response).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

async function post(body: unknown, headers?: HeadersInit) {
  const { POST } = await import("../route");
  return POST(
    new Request("https://1wayseo.com/api/shopline/webhooks/gdpr-shop-redact", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    }),
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

describe("POST /api/shopline/webhooks/gdpr-shop-redact", () => {
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

  it("revokes the connection, deletes audit data, and logs the webhook receipt", async () => {
    const body = {
      shop_id: "shop-1",
      shop_domain: "demo.myshopline.com",
    };
    const supabase = createSupabaseMock();
    supabaseMocks.createAdminClient.mockReturnValue(supabase);

    const response = await post(body, {
      "X-SHOPLINE-Hmac-Sha256": await signBody(body),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(supabase.calls).toContainEqual({
      table: "shopline_connections",
      method: "update",
      args: [
        expect.objectContaining({
          status: "revoked",
          revoked_at: expect.any(String),
        }),
      ],
    });
    expect(supabase.calls).toContainEqual({
      table: "audit_fix_log",
      method: "delete",
      args: [],
    });
    expect(supabase.calls).toContainEqual({
      table: "audit_issues",
      method: "delete",
      args: [],
    });
    expect(supabase.calls).toContainEqual({
      table: "audit_reports",
      method: "delete",
      args: [],
    });
    expect(supabase.calls).toContainEqual({
      table: "shopline_gdpr_redact_log",
      method: "insert",
      args: [
        expect.objectContaining({
          webhook_type: "shop-redact",
          shop_id: "shop-1",
          shop_domain: "demo.myshopline.com",
          payload_summary:
            "shop data redacted: connection revoked; reports deleted: 1",
          result: "processed",
        }),
      ],
    });
  });
});
