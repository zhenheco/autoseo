import { describe, expect, it, vi } from "vitest";

import {
  runSocialPublishJob,
  type ScheduledSocialPostRow,
} from "../social-publish";
import { UpstreamRateLimitError } from "../../../src/lib/social/types";

function createPublishStore(rows: ScheduledSocialPostRow[]) {
  const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];

  class Builder {
    private statusFilter: string | null = null;
    private dueBefore: string | null = null;
    private rowLimit = Number.POSITIVE_INFINITY;
    private pendingUpdate: Record<string, unknown> | null = null;

    select() {
      return this;
    }

    eq(column: string, value: unknown) {
      if (this.pendingUpdate && column === "id") {
        const row = rows.find((candidate) => candidate.id === value);
        if (row) {
          Object.assign(row, this.pendingUpdate);
          updates.push({ id: String(value), payload: this.pendingUpdate });
        }
        return Promise.resolve({ data: row ?? null, error: null });
      }

      if (column === "status") this.statusFilter = String(value);
      return this;
    }

    lte(column: string, value: string) {
      if (column === "scheduled_at") this.dueBefore = value;
      return this;
    }

    order() {
      return this;
    }

    limit(value: number) {
      this.rowLimit = value;
      return this;
    }

    update(payload: Record<string, unknown>) {
      this.pendingUpdate = payload;
      return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: ScheduledSocialPostRow[]; error: null }) => TResult1)
        | null,
      onrejected?: ((reason: unknown) => TResult2) | null,
    ) {
      const data = rows
        .filter((row) =>
          this.statusFilter ? row.status === this.statusFilter : true,
        )
        .filter((row) =>
          this.dueBefore ? row.scheduled_at <= this.dueBefore : true,
        )
        .slice(0, this.rowLimit);
      return Promise.resolve({ data, error: null }).then(
        onfulfilled,
        onrejected,
      );
    }
  }

  return {
    rows,
    updates,
    supabase: {
      from(table: string) {
        if (table !== "social_posts") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return new Builder();
      },
    },
  };
}

const socialAccount = {
  id: "account-1",
  brand_id: "brand-1",
  platform: "x" as const,
  platform_account_id: "x-account",
  platform_username: "demo",
  access_token_encrypted: "encrypted-token",
  refresh_token_encrypted: null,
  token_expires_at: null,
  connected_at: "2026-05-22T00:00:00.000Z",
  disconnected_at: null,
};

function scheduledPost(
  overrides: Partial<ScheduledSocialPostRow> = {},
): ScheduledSocialPostRow {
  return {
    id: "post-1",
    social_account_id: "account-1",
    platform_post_id: null,
    scheduled_at: "2026-05-22T04:00:00.000Z",
    published_at: null,
    status: "scheduled",
    content_text: "Scheduled launch note",
    media_urls: null,
    error_message: null,
    retry_count: 0,
    social_accounts: socialAccount,
    ...overrides,
  };
}

describe("runSocialPublishJob", () => {
  it("dispatches due scheduled posts and marks them published", async () => {
    const store = createPublishStore([scheduledPost()]);
    const publisher = {
      publish: vi.fn(async () => ({
        publishedPostId: "remote-post-1",
        publishedAt: new Date("2026-05-22T04:01:00.000Z"),
        platform: "x" as const,
      })),
    };

    const result = await runSocialPublishJob({
      now: new Date("2026-05-22T04:00:00.000Z"),
      supabase: store.supabase,
      publisher,
      alertOps: vi.fn(),
      logger: console,
    });

    expect(result).toMatchObject({ scanned: 1, published: 1, failed: 0 });
    expect(publisher.publish).toHaveBeenCalledWith({
      socialAccount,
      content: { text: "Scheduled launch note", mediaUrls: undefined },
    });
    expect(store.rows[0]).toMatchObject({
      status: "published",
      platform_post_id: "remote-post-1",
      published_at: "2026-05-22T04:01:00.000Z",
      error_message: null,
    });
  });

  it("reschedules 429 failures on the original row and increments retry_count", async () => {
    const store = createPublishStore([scheduledPost({ retry_count: 2 })]);
    const publisher = {
      publish: vi.fn(async () => {
        throw new UpstreamRateLimitError(
          120,
          new Date("2026-05-22T04:00:00.000Z"),
        );
      }),
    };

    const result = await runSocialPublishJob({
      now: new Date("2026-05-22T04:00:00.000Z"),
      supabase: store.supabase,
      publisher,
      alertOps: vi.fn(),
      logger: console,
    });

    expect(result).toMatchObject({ scanned: 1, rescheduled: 1, failed: 0 });
    expect(store.rows[0]).toMatchObject({
      status: "scheduled",
      scheduled_at: "2026-05-22T05:00:00.000Z",
      retry_count: 3,
    });
  });

  it("marks permanent failures failed and emits an ops alert", async () => {
    const store = createPublishStore([scheduledPost()]);
    const alertOps = vi.fn(async () => ({ ok: true }));
    const publisher = {
      publish: vi.fn(async () => {
        throw new Error("invalid_token");
      }),
    };

    const result = await runSocialPublishJob({
      now: new Date("2026-05-22T04:00:00.000Z"),
      supabase: store.supabase,
      publisher,
      alertOps,
      logger: console,
    });

    expect(result).toMatchObject({ scanned: 1, failed: 1, alertsSent: 1 });
    expect(store.rows[0]).toMatchObject({
      status: "failed",
      error_message: "invalid_token",
    });
    expect(alertOps).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Social publish failed",
        idempotencyKey: "social-publish-failed:post-1",
      }),
    );
  });
});
