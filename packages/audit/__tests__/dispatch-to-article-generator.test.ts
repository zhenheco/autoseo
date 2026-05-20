import { describe, expect, it, vi } from "vitest";
import {
  dispatchAuditIssueToArticleGenerator,
  type DispatchToArticleGeneratorDeps,
} from "../src/dispatch-to-article-generator";
import type { AuditIssue } from "../src/types";

type DispatchableIssue = AuditIssue & { id: string };

function createIssue(overrides: Partial<DispatchableIssue> = {}): DispatchableIssue {
  return {
    id: "issue-1",
    ruleId: "meta.description.tooShort",
    severity: "warning",
    riskLevel: "low",
    page: "https://example.com/products/desk",
    selector: 'meta[name="description"]',
    current: "Short",
    source: "html-scan",
    estimatedImpact: "medium",
    ...overrides,
  };
}

function createDeps(): DispatchToArticleGeneratorDeps {
  return {
    findExistingJob: vi.fn(),
    generateArticleBrief: vi.fn(),
    insertArticleJob: vi.fn(),
  };
}

describe("dispatchAuditIssueToArticleGenerator", () => {
  it("returns rule_not_supported when ruleId is not eligible", async () => {
    const deps = createDeps();

    const result = await dispatchAuditIssueToArticleGenerator(
      { issue: createIssue(), companyId: "company-1" },
      deps,
    );

    expect(result).toEqual({ ok: false, reason: "rule_not_supported" });
    expect(deps.findExistingJob).not.toHaveBeenCalled();
    expect(deps.generateArticleBrief).not.toHaveBeenCalled();
    expect(deps.insertArticleJob).not.toHaveBeenCalled();
  });
});
