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

  if (!input.issue.id) {
    return { ok: false, reason: "missing_audit_issue_id" };
  }

  const existingJobId = await deps.findExistingJob(input.issue.id);
  if (existingJobId) {
    return { ok: false, reason: "idempotent_existing" };
  }

  const brief = await deps.generateArticleBrief(input.issue);
  const job = await deps.insertArticleJob({
    audit_issue_id: input.issue.id,
    source_type: "audit-driven",
    company_id: input.companyId,
    title: brief.title,
    outline: brief.outline,
    target_keywords: brief.target_keywords,
    status: "pending",
  });

  return { ok: true, jobId: job.id };
}
