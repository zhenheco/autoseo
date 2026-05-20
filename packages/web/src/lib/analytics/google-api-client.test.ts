import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseAdmin = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => supabaseAdmin);

vi.mock("@/lib/security/token-encryption", () => ({
  decryptToken: vi.fn(),
  encryptToken: vi.fn(),
  refreshGoogleToken: vi.fn(),
}));

function createFakeAdminClient(response: { data?: unknown; error?: unknown }) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  const client = {
    calls,
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        single() {
          calls.push({ table, method: "single", args: [] });
          return Promise.resolve(response);
        },
      };

      return builder;
    },
  };

  return client;
}

describe("getWebsiteOAuthToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("filters active OAuth tokens by website, service, and company when companyId is provided", async () => {
    const adminClient = createFakeAdminClient({
      data: { id: "token-1", company_id: "company-1" },
      error: null,
    });
    supabaseAdmin.createAdminClient.mockReturnValue(adminClient);

    const { getWebsiteOAuthToken } = await import("./google-api-client");

    await expect(
      getWebsiteOAuthToken("website-1", "gsc", "company-1"),
    ).resolves.toEqual({
      id: "token-1",
      company_id: "company-1",
    });

    expect(adminClient.calls).toEqual([
      {
        table: "google_oauth_tokens",
        method: "select",
        args: ["*"],
      },
      {
        table: "google_oauth_tokens",
        method: "eq",
        args: ["website_id", "website-1"],
      },
      {
        table: "google_oauth_tokens",
        method: "eq",
        args: ["service_type", "gsc"],
      },
      {
        table: "google_oauth_tokens",
        method: "eq",
        args: ["status", "active"],
      },
      {
        table: "google_oauth_tokens",
        method: "eq",
        args: ["company_id", "company-1"],
      },
      {
        table: "google_oauth_tokens",
        method: "single",
        args: [],
      },
    ]);
  });

  it("preserves existing unscoped token lookup when companyId is omitted", async () => {
    const adminClient = createFakeAdminClient({
      data: { id: "token-1", company_id: "company-1" },
      error: null,
    });
    supabaseAdmin.createAdminClient.mockReturnValue(adminClient);

    const { getWebsiteOAuthToken } = await import("./google-api-client");

    await getWebsiteOAuthToken("website-1", "gsc");

    expect(adminClient.calls).not.toContainEqual({
      table: "google_oauth_tokens",
      method: "eq",
      args: ["company_id", expect.any(String)],
    });
  });
});
