import { describe, expect, it, vi } from "vitest";
import { runAudit } from "../src/audit-cli";

describe("audit-cli", () => {
  it("throws a missing args error without --website-id or --url", async () => {
    await expect(
      runAudit([], {
        adminClient: {} as never,
        auditWebsiteFn: vi.fn(),
      }),
    ).rejects.toThrow("missing required argument: --website-id or --url");
  });
});
