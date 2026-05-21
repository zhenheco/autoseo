import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  INVENTORY_SELECT_QUERIES,
  createInventory,
  main,
  runCli,
  type InventoryDbClient,
} from "../pre-redesign-counts";

type QueryRows = Record<string, unknown>[];

class MockInventoryClient implements InventoryDbClient {
  readonly queries: string[] = [];

  constructor(private readonly rowsBySql: ReadonlyMap<string, QueryRows>) {}

  async query<T extends Record<string, unknown>>(
    sql: string,
  ): Promise<{ rows: T[] }> {
    const normalizedSql = sql.trim();
    this.queries.push(normalizedSql);

    return {
      rows: (this.rowsBySql.get(normalizedSql) ?? []) as T[],
    };
  }

  async end(): Promise<void> {}
}

describe("pre-redesign counts inventory", () => {
  it("generates only SELECT-style inventory SQL", () => {
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i;

    for (const sql of Object.values(INVENTORY_SELECT_QUERIES)) {
      expect(sql.trim()).toMatch(/^(WITH|SELECT)\b/i);
      expect(sql).not.toMatch(forbidden);
    }

    expect(INVENTORY_SELECT_QUERIES.freeUsersActive30d).toContain(
      "subscription_plans",
    );
    expect(INVENTORY_SELECT_QUERIES.freeUsersActive30d).toContain(
      "article_jobs",
    );
    expect(INVENTORY_SELECT_QUERIES.paymentOrdersNonTerminal).toContain(
      "payment_orders",
    );
    expect(INVENTORY_SELECT_QUERIES.articlesPerCompanyTop20).toContain(
      "generated_articles",
    );
  });

  it("refuses the unexpected write-enabling flag with process exit code 1", async () => {
    const exit = vi.fn<(code: number) => never>(() => {
      throw new Error("exit-called");
    });

    await expect(
      main({
        argv: ["--allow-write"],
        env: {},
        stdout: vi.fn(),
        stderr: vi.fn(),
        exit,
      }),
    ).rejects.toThrow("exit-called");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("prints the documented JSON shape", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const rowsBySql = createRowsBySql();
    const client = new MockInventoryClient(rowsBySql);

    const result = await runCli({
      argv: [],
      env: { SUPABASE_DB_URL: "postgres://example.invalid/db" },
      stdout,
      stderr,
      clientFactory: () => client,
      writeFiles: false,
      now: () => new Date("2026-05-21T13:00:00.000Z"),
    });

    expect(result.exitCode).toBe(0);
    expect(stdout).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(stdout.mock.calls[0]?.[0] ?? "{}") as unknown;

    expect(payload).toEqual({
      generatedAt: "2026-05-21T13:00:00.000Z",
      counts: {
        freeUsersActive30d: 2,
        freeUsersTotal: 5,
        paidUsersActive: 3,
        totalCompanies: 11,
        totalGeneratedArticles: 100,
        totalArticleJobs: 120,
        totalArticleTranslations: 30,
        totalWebsiteConfigs: 8,
        payuniNonTerminalRows: {
          paymentOrders: 4,
          recurringMandates: 1,
          recurringPayments: 6,
          refundRequests: 2,
        },
        referralRows: {
          companyReferralCodes: 7,
          referralCodes: 8,
          referralTokenRewards: 9,
          referralRewards: 10,
        },
        articlesPerCompanyTop20: [
          {
            companyId: "company-1",
            companyName: "Acme",
            articleCount: 42,
          },
        ],
        websitesPerCompanyTop20: [
          {
            companyId: "company-1",
            websiteCount: 3,
          },
        ],
      },
    });

    expect(client.queries).toContain("BEGIN");
    expect(client.queries).toContain("SET TRANSACTION READ ONLY");
    expect(
      stderr.mock.calls.some((call) =>
        String(call[0]).includes("SUPABASE_DB_URL"),
      ),
    ).toBe(false);
  });

  it("keeps the implementation source free of forbidden data-changing SQL verbs", async () => {
    const sourcePath = path.resolve(__dirname, "../pre-redesign-counts.ts");
    const source = await readFile(sourcePath, "utf8");

    expect(source).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i,
    );
  });
});

function createRowsBySql(): ReadonlyMap<string, QueryRows> {
  return new Map<string, QueryRows>([
    [INVENTORY_SELECT_QUERIES.freeUsersActive30d.trim(), [{ count: 2 }]],
    [INVENTORY_SELECT_QUERIES.freeUsersTotal.trim(), [{ count: 5 }]],
    [INVENTORY_SELECT_QUERIES.paidUsersActive.trim(), [{ count: 3 }]],
    [INVENTORY_SELECT_QUERIES.totalCompanies.trim(), [{ count: 11 }]],
    [INVENTORY_SELECT_QUERIES.totalGeneratedArticles.trim(), [{ count: 100 }]],
    [INVENTORY_SELECT_QUERIES.totalArticleJobs.trim(), [{ count: 120 }]],
    [INVENTORY_SELECT_QUERIES.totalArticleTranslations.trim(), [{ count: 30 }]],
    [INVENTORY_SELECT_QUERIES.totalWebsiteConfigs.trim(), [{ count: 8 }]],
    [INVENTORY_SELECT_QUERIES.paymentOrdersNonTerminal.trim(), [{ count: 4 }]],
    [
      INVENTORY_SELECT_QUERIES.recurringMandatesNonTerminal.trim(),
      [{ count: 1 }],
    ],
    [
      INVENTORY_SELECT_QUERIES.recurringPaymentsNonTerminal.trim(),
      [{ count: 6 }],
    ],
    [INVENTORY_SELECT_QUERIES.refundRequestsNonTerminal.trim(), [{ count: 2 }]],
    [INVENTORY_SELECT_QUERIES.companyReferralCodes.trim(), [{ count: 7 }]],
    [INVENTORY_SELECT_QUERIES.referralCodes.trim(), [{ count: 8 }]],
    [INVENTORY_SELECT_QUERIES.referralTokenRewards.trim(), [{ count: 9 }]],
    [INVENTORY_SELECT_QUERIES.referralRewards.trim(), [{ count: 10 }]],
    [
      INVENTORY_SELECT_QUERIES.articlesPerCompanyTop20.trim(),
      [{ companyId: "company-1", companyName: "Acme", articleCount: 42 }],
    ],
    [
      INVENTORY_SELECT_QUERIES.websitesPerCompanyTop20.trim(),
      [{ companyId: "company-1", websiteCount: 3 }],
    ],
    [
      INVENTORY_SELECT_QUERIES.paymentOrderStatuses.trim(),
      [
        { status: "pending", rowCount: 4 },
        { status: "success", rowCount: 9 },
      ],
    ],
    [
      INVENTORY_SELECT_QUERIES.recurringMandateStatuses.trim(),
      [{ status: "active", rowCount: 1 }],
    ],
    [
      INVENTORY_SELECT_QUERIES.recurringPaymentStatuses.trim(),
      [{ status: "processing", rowCount: 6 }],
    ],
    [
      INVENTORY_SELECT_QUERIES.refundRequestStatuses.trim(),
      [{ status: "pending_review", rowCount: 2 }],
    ],
  ]);
}
