import { describe, expect, it } from "vitest";
import { runChromiumAudit } from "../src/chromium-audit";

describe("runChromiumAudit", () => {
  it("throws chromium_binding_not_available when no browser rendering fetcher is provided", async () => {
    await expect(runChromiumAudit("https://example.com")).rejects.toThrow(
      "chromium_binding_not_available",
    );
  });

  it("parses core web vitals from Lighthouse JSON", async () => {
    const result = await runChromiumAudit("https://example.com", {
      browserRenderingFetch: async () => ({
        lighthouseJson: {
          audits: {
            "largest-contentful-paint": { numericValue: 2410 },
            "max-potential-fid": { numericValue: 78 },
            "cumulative-layout-shift": { numericValue: 0.08 },
            "interaction-to-next-paint": { numericValue: 120 },
          },
        },
        axeJson: { violations: [] },
      }),
    });

    expect(result.cwv).toEqual({
      lcp: 2410,
      fid: 78,
      cls: 0.08,
      inp: 120,
    });
    expect(result.a11yIssues).toEqual([]);
  });
});
