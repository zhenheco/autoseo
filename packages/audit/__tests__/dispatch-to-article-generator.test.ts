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

  it("dispatches content.missing-topic by generating a brief and inserting an article job", async () => {
    const deps = createDeps();
    vi.mocked(deps.findExistingJob).mockResolvedValue(null);
    vi.mocked(deps.generateArticleBrief).mockResolvedValue({
      title: "Ergonomic desk buying guide",
      outline: "Cover buyer intent, comparison points, and CTA.",
      target_keywords: ["ergonomic desk"],
    });
    vi.mocked(deps.insertArticleJob).mockResolvedValue({ id: "job-1" });
    const issue = createIssue({
      ruleId: "content.missing-topic",
      severity: "info",
      riskLevel: "medium",
      current: "ergonomic desk",
      estimatedImpact: "high",
    });

    const result = await dispatchAuditIssueToArticleGenerator(
      { issue, companyId: "company-1" },
      deps,
    );

    expect(result).toEqual({ ok: true, jobId: "job-1" });
    expect(deps.findExistingJob).toHaveBeenCalledWith("issue-1");
    expect(deps.generateArticleBrief).toHaveBeenCalledWith(issue);
    expect(deps.insertArticleJob).toHaveBeenCalledWith({
      audit_issue_id: "issue-1",
      source_type: "audit-driven",
      company_id: "company-1",
      title: "Ergonomic desk buying guide",
      outline: "Cover buyer intent, comparison points, and CTA.",
      target_keywords: ["ergonomic desk"],
      status: "pending",
    });
  });

  it("returns idempotent_existing and does not create another job for the same audit issue", async () => {
    const deps = createDeps();
    vi.mocked(deps.findExistingJob).mockResolvedValue("job-existing");

    const result = await dispatchAuditIssueToArticleGenerator(
      {
        issue: createIssue({
          ruleId: "content.missing-topic",
          severity: "info",
          riskLevel: "medium",
        }),
        companyId: "company-1",
      },
      deps,
    );

    expect(result).toEqual({ ok: false, reason: "idempotent_existing" });
    expect(deps.findExistingJob).toHaveBeenCalledWith("issue-1");
    expect(deps.generateArticleBrief).not.toHaveBeenCalled();
    expect(deps.insertArticleJob).not.toHaveBeenCalled();
  });
});
