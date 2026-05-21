import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@shared/supabase", () => ({
  createAdminClient: createAdminClientMock,
}));

type TableName = "company_members" | "brands" | "social_accounts";

function createSupabaseMock() {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    calls,
    from(table: TableName) {
      const operations: string[] = [];
      const builder = {
        select(...args: unknown[]) {
          operations.push("select");
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          operations.push("eq");
          calls.push({ table, method: "eq", args });
          return builder;
        },
        in(...args: unknown[]) {
          operations.push("in");
          calls.push({ table, method: "in", args });
          return builder;
        },
        is(...args: unknown[]) {
          operations.push("is");
          calls.push({ table, method: "is", args });
          return builder;
        },
        delete() {
          operations.push("delete");
          calls.push({ table, method: "delete", args: [] });
          return builder;
        },
        then(resolve: (value: unknown) => void) {
          if (table === "company_members") {
            resolve({
              data: [{ company_id: "company-1" }, { company_id: "company-2" }],
              error: null,
            });
            return;
          }

          if (table === "brands") {
            resolve({
              data: [{ id: "brand-1" }, { id: "brand-2" }],
              error: null,
            });
            return;
          }

          if (table === "social_accounts" && operations.includes("delete")) {
            resolve({ data: null, error: null });
            return;
          }

          resolve({ data: null, error: null });
        },
      };

      return builder;
    },
  };
}

function base64UrlEncode(value: string | Uint8Array): string {
  const buffer =
    typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);

  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signPayload(payload: Record<string, unknown>) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("meta-app-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );

  return `${base64UrlEncode(new Uint8Array(signature))}.${encodedPayload}`;
}

async function postSignedRequest(signedRequest: string) {
  const { POST } = await import("../route");
  return POST(
    new Request("https://1wayseo.com/api/meta/data-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ signed_request: signedRequest }),
    }),
  );
}

describe("POST /api/meta/data-deletion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("META_APP_SECRET", "meta-app-secret");
    createAdminClientMock.mockReturnValue(createSupabaseMock());
  });

  it("verifies the Meta signed_request and deletes social accounts for the user", async () => {
    const supabase = createSupabaseMock();
    createAdminClientMock.mockReturnValue(supabase);

    const response = await postSignedRequest(
      await signPayload({
        algorithm: "HMAC-SHA256",
        user_id: "meta-user-1",
        issued_at: 1779400000,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      url: expect.stringMatching(
        /^https:\/\/1wayseo\.com\/api\/meta\/data-deletion\?code=/,
      ),
      confirmation_code: expect.stringMatching(/^meta-del-[a-f0-9-]+$/),
    });
    expect(supabase.calls).toContainEqual({
      table: "company_members",
      method: "eq",
      args: ["user_id", "meta-user-1"],
    });
    expect(supabase.calls).toContainEqual({
      table: "brands",
      method: "in",
      args: ["company_id", ["company-1", "company-2"]],
    });
    expect(supabase.calls).toContainEqual({
      table: "social_accounts",
      method: "delete",
      args: [],
    });
    expect(supabase.calls).toContainEqual({
      table: "social_accounts",
      method: "in",
      args: ["brand_id", ["brand-1", "brand-2"]],
    });
  });

  it("returns 400 for an invalid signed_request signature", async () => {
    const signedRequest = await signPayload({
      algorithm: "HMAC-SHA256",
      user_id: "meta-user-1",
    });
    const [, encodedPayload] = signedRequest.split(".");

    const response = await postSignedRequest(`bad-signature.${encodedPayload}`);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_signed_request",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});
