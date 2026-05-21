import { describe, expect, it, vi } from "vitest";

import {
  runSocialReconcileJob,
  type PublishedSocialPostRow,
} from "../social-reconcile";

function createReconcileStore(rows: PublishedSocialPostRow[]) {
  class Builder {
    private statusFilter: string | null = null;
    private publishedAfter: string | null = null;
    private requirePlatformPostId = false;
    private pendingUpdate: Record<string, unknown> | null = null;

    select() {
      return this;
    }

    eq(column: string, value: unknown) {
      if (this.pendingUpdate && column === "id") {
        const row = rows.find((candidate) => candidate.id === value);
        if (row) Object.assign(row, this.pendingUpdate);
        return Promise.resolve({ data: row ?? null, error: null });
      }

      if (column === "status") this.statusFilter = String(value);
      return this;
    }

    gte(column: string, value: string) {
      if (column === "published_at") this.publishedAfter = value;
      return this;
    }

    not(column: string, operator: string, value: unknown) {
      if (
        column === "platform_post_id" &&
        operator === "is" &&
        value === null
      ) {
        this.requirePlatformPostId = true;
      }
      return this;
    }

    order() {
      return this;
    }

    limit() {
      return this;
    }

    update(payload: Record<string, unknown>) {
      this.pendingUpdate = payload;
      return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: PublishedSocialPostRow[]; error: null }) => TResult1)
        | null,
      onrejected?: ((reason: unknown) => TResult2) | null,
    ) {
      const data = rows
        .filter((row) =>
          this.statusFilter ? row.status === this.statusFilter : true,
        )
        .filter((row) =>
          this.publishedAfter && row.published_at
            ? row.published_at >= this.publishedAfter
            : true,
        )
        .filter((row) =>
          this.requirePlatformPostId ? Boolean(row.platform_post_id) : true,
        );
      return Promise.resolve({ data, error: null }).then(
        onfulfilled,
        onrejected,
      );
    }
  }

  return {
    rows,
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

describe("runSocialReconcileJob", () => {
  it("updates last-24h published metrics idempotently", async () => {
    const store = createReconcileStore([
      {
        id: "post-1",
        platform_post_id: "remote-post-1",
        status: "published",
        published_at: "2026-05-22T02:00:00.000Z",
        metrics: null,
        metrics_updated_at: null,
      },
    ]);
    const publisher = {
      fetchEngagement: vi.fn(async () => ({
        impressions: 100,
        clicks: 4,
        likes: 8,
        raw: { source: "x" },
      })),
    };

    const deps = {
      now: new Date("2026-05-22T04:00:00.000Z"),
      supabase: store.supabase,
      publisher,
      logger: console,
    };

    const firstRun = await runSocialReconcileJob(deps);
    const secondRun = await runSocialReconcileJob(deps);

    expect(firstRun).toMatchObject({ scanned: 1, updated: 1, failed: 0 });
    expect(secondRun).toMatchObject({ scanned: 1, updated: 1, failed: 0 });
    expect(publisher.fetchEngagement).toHaveBeenCalledTimes(2);
    expect(publisher.fetchEngagement).toHaveBeenCalledWith("remote-post-1");
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({
      metrics: {
        impressions: 100,
        clicks: 4,
        likes: 8,
        raw: { source: "x" },
      },
      metrics_updated_at: "2026-05-22T04:00:00.000Z",
    });
  });
});
