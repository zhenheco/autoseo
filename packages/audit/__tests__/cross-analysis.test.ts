import { describe, expect, it } from "vitest";
import { analyzeGscLowCtrHighImpression } from "../src/cross-analysis";

describe("cross-analysis audit rules", () => {
  it("flags GSC pages with low CTR and high impressions outside top positions", () => {
    const issues = analyzeGscLowCtrHighImpression([
      {
        page: "https://example.com/guide",
        query: "seo guide",
        position: 8,
        impressions: 200,
        clicks: 2,
        ctr: 0.01,
      },
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "gsc.low-ctr-high-impression",
      severity: "warning",
      riskLevel: "medium",
      page: "https://example.com/guide",
      current: "position=8, ctr=1%, impressions=200",
      suggested:
        "重寫 meta title 加吸引點擊的詞 (例：「2026 最新」、「免費」、「指南」)",
      source: "gsc-cross",
      estimatedImpact: "high",
    });
  });

  it("skips GSC pages already in top positions", () => {
    const issues = analyzeGscLowCtrHighImpression([
      {
        page: "https://example.com/guide",
        query: "seo guide",
        position: 3,
        impressions: 200,
        clicks: 2,
        ctr: 0.01,
      },
    ]);

    expect(issues).toEqual([]);
  });

  it("skips GSC pages with low impressions", () => {
    const issues = analyzeGscLowCtrHighImpression([
      {
        page: "https://example.com/guide",
        query: "seo guide",
        position: 8,
        impressions: 100,
        clicks: 1,
        ctr: 0.01,
      },
    ]);

    expect(issues).toEqual([]);
  });
});
