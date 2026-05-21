import { describe, expect, it, vi } from "vitest";
import {
  runGrandfatherFreeUsers,
  type GrandfatherDbClient,
  type GrandfatherEmailSender,
} from "../grandfather-free-users";

type QueryRows = Record<string, unknown>[];

class MockGrandfatherClient implements GrandfatherDbClient {
  readonly queries: Array<{ sql: string; values: readonly unknown[] }> = [];

  constructor(private readonly rowsBySql: Map<string, QueryRows>) {}

  async query<T extends Record<string, unknown>>(
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: T[] }> {
    this.queries.push({ sql: sql.trim(), values });

    if (sql.includes("UPDATE company_subscriptions")) {
      const subscriptionId = values[0];
      const candidates = this.rowsBySql.get("select") ?? [];
      const row = candidates.find(
        (candidate) => candidate.subscriptionId === subscriptionId,
      );
      if (row) {
        row.status = "grandfather_trial";
        row.trialEndsAt = values[1] as string;
      }
      return { rows: [] };
    }

    if (sql.includes("company_subscriptions cs")) {
      return {
        rows: (this.rowsBySql.get("select") ?? []).filter(
          (row) => row.status === "active",
        ) as T[],
      };
    }

    return { rows: [] };
  }

  async end(): Promise<void> {}
}

describe("grandfather-free-users", () => {
  it("marks active legacy rows once and does not resend on a second run", async () => {
    const rows = new Map<string, QueryRows>([
      [
        "select",
        [
          {
            subscriptionId: "sub-1",
            companyId: "company-1",
            companyName: "Acme",
            ownerEmail: "owner@example.com",
            status: "active",
            trialEndsAt: null,
            lastActivityAt: "2026-05-20T00:00:00.000Z",
          },
        ],
      ],
    ]);
    const client = new MockGrandfatherClient(rows);
    const sendEmail = vi.fn<GrandfatherEmailSender>(async () => ({
      ok: true,
      messageId: "email-1",
    }));

    const options = {
      client,
      sendEmail,
      writeReport: vi.fn(async () => undefined),
      now: () => new Date("2026-05-21T00:00:00.000Z"),
      stdout: vi.fn(),
      stderr: vi.fn(),
    };

    const first = await runGrandfatherFreeUsers(options);
    const second = await runGrandfatherFreeUsers(options);

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(options.writeReport).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        companyName: "Acme",
        trialEndsAt: "2026-06-20",
        idempotencyKey: "grandfather-free-users:sub-1",
      }),
    );
  });
});
