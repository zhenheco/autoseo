import { describe, expect, it } from "vitest";
import { runChromiumAudit } from "../src/chromium-audit";

describe("runChromiumAudit", () => {
  it("throws chromium_binding_not_available when no browser rendering fetcher is provided", async () => {
    await expect(runChromiumAudit("https://example.com")).rejects.toThrow(
      "chromium_binding_not_available",
    );
  });
});
