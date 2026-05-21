import { describe, expect, it } from "vitest";
import { resolveCompanyScopeForUser } from "./company-scope";

function createFakeAdminClient(response: { data?: unknown; error?: unknown }) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  return {
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
}

describe("resolveCompanyScopeForUser", () => {
  it("returns the company id for a user membership", async () => {
    const adminClient = createFakeAdminClient({
      data: { company_id: "company-1" },
      error: null,
    });

    await expect(
      resolveCompanyScopeForUser(adminClient as never, "user-1"),
    ).resolves.toEqual({
      success: true,
      companyId: "company-1",
    });

    expect(adminClient.calls).toEqual([
      {
        table: "company_members",
        method: "select",
        args: ["company_id"],
      },
      {
        table: "company_members",
        method: "eq",
        args: ["user_id", "user-1"],
      },
      {
        table: "company_members",
        method: "single",
        args: [],
      },
    ]);
  });

  it("returns no_company when there is no membership", async () => {
    const adminClient = createFakeAdminClient({
      data: null,
      error: null,
    });

    await expect(
      resolveCompanyScopeForUser(adminClient as never, "user-1"),
    ).resolves.toEqual({
      success: false,
      reason: "no_company",
    });
  });

  it("returns query_failed when the lookup fails", async () => {
    const adminClient = createFakeAdminClient({
      data: null,
      error: { message: "database down" },
    });

    await expect(
      resolveCompanyScopeForUser(adminClient as never, "user-1"),
    ).resolves.toEqual({
      success: false,
      reason: "query_failed",
      error: "database down",
    });
  });
});
