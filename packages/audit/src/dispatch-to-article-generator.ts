import type { AuditIssue } from "./types";

export interface DispatchToArticleGeneratorDeps {
  insertArticleJob: (job: {
    audit_issue_id: string;
    source_type: "audit-driven";
    company_id: string;
    title: string;
    outline: string;
    target_keywords: string[];
    status: "pending";
  }) => Promise<{ id: string }>;
  generateArticleBrief: (issue: AuditIssue) => Promise<{
    title: string;
    outline: string;
    target_keywords: string[];
  }>;
  findExistingJob: (auditIssueId: string) => Promise<string | null>;
}

type DispatchableAuditIssue = AuditIssue & { id?: string };

const supportedRuleIds = new Set(["content.missing-topic", "h1.duplicate"]);

export async function dispatchAuditIssueToArticleGenerator(
  input: { issue: DispatchableAuditIssue; companyId: string },
  deps: DispatchToArticleGeneratorDeps,
): Promise<{ ok: true; jobId: string } | { ok: false; reason: string }> {
  if (!supportedRuleIds.has(input.issue.ruleId)) {
    return { ok: false, reason: "rule_not_supported" };
  }

  return { ok: false, reason: "not_implemented" };
}
