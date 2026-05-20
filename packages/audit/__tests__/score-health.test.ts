import { describe, expect, it } from "vitest";
import { scoreHealth } from "../src/score-health";
import type { AuditIssue } from "../src/types";

function issue(severity: AuditIssue["severity"]): AuditIssue {
  return {
    ruleId: `rule.${severity}`,
    severity,
    riskLevel: "low",
    page: "https://example.com",
    current: "current value",
    source: "html-scan",
    estimatedImpact: "low",
  };
}

describe("scoreHealth", () => {
  it("returns 100 for empty issues", () => {
    expect(scoreHealth([])).toBe(100);
  });

  it("subtracts 10 for one critical issue", () => {
    expect(scoreHealth([issue("critical")])).toBe(90);
  });
});
