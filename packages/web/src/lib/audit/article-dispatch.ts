import { randomUUID } from "node:crypto";
import type { AuditIssue, DispatchToArticleGeneratorDeps } from "@audit";
import type { Json } from "@/types/database.types";

interface SupabaseResponse<T> {
  data?: T | null;
  error?: { message?: string } | null;
}

interface SupabaseFilterBuilder {
  select(columns: string): SupabaseFilterBuilder;
  eq(column: string, value: unknown): SupabaseFilterBuilder;
  maybeSingle<T>(): PromiseLike<SupabaseResponse<T>>;
  single<T>(): PromiseLike<SupabaseResponse<T>>;
}

interface SupabaseQueryBuilder {
  select(columns: string): SupabaseFilterBuilder;
  insert(values: unknown): SupabaseFilterBuilder;
}

export interface AuditArticleDispatchSupabaseClient {
  from(table: string): SupabaseQueryBuilder;
}

export type AuditIssueRowForDispatch = {
  id: string;
  rule_id: string;
  severity: AuditIssue["severity"];
  risk_level: AuditIssue["riskLevel"];
  page: string;
  selector: string | null;
  current: string;
  suggested: string | null;
  source: AuditIssue["source"];
  estimated_impact: AuditIssue["estimatedImpact"];
};

export function createAuditArticleDispatchDeps(
  supabase: AuditArticleDispatchSupabaseClient,
): DispatchToArticleGeneratorDeps {
  return {
    async findExistingJob(auditIssueId) {
      const { data, error } = await supabase
        .from("article_jobs")
        .select("id")
        .eq("audit_issue_id", auditIssueId)
        .maybeSingle<{ id: string }>();

      if (error) throw new Error(error.message || "article_job_lookup_failed");
      return data?.id ?? null;
    },

    generateArticleBrief: async (issue) => generateStaticArticleBrief(issue),

    async insertArticleJob(job) {
      const { data, error } = await supabase
        .from("article_jobs")
        .insert({
          job_id: randomUUID(),
          company_id: job.company_id,
          audit_issue_id: job.audit_issue_id,
          source_type: job.source_type,
          keywords: job.target_keywords,
          status: job.status,
          metadata: {
            source: job.source_type,
            audit_issue_id: job.audit_issue_id,
            title: job.title,
            outline: job.outline,
            target_keywords: job.target_keywords,
          } satisfies Json,
        })
        .select("id")
        .single<{ id: string }>();

      if (error || !data?.id) {
        throw new Error(error?.message || "article_job_insert_failed");
      }

      return { id: data.id };
    },
  };
}

export function toDispatchableAuditIssue(
  issue: AuditIssueRowForDispatch,
): AuditIssue & { id: string } {
  return {
    id: issue.id,
    ruleId: issue.rule_id,
    severity: issue.severity,
    riskLevel: issue.risk_level,
    page: issue.page,
    selector: issue.selector ?? undefined,
    current: issue.current,
    suggested: issue.suggested ?? undefined,
    source: issue.source,
    estimatedImpact: issue.estimated_impact,
  };
}

function generateStaticArticleBrief(issue: AuditIssue): {
  title: string;
  outline: string;
  target_keywords: string[];
} {
  const keywords = extractTargetKeywords(issue);
  const primaryKeyword = keywords[0] ?? issue.current.trim() ?? "SEO content";

  if (issue.ruleId === "h1.duplicate") {
    return {
      title: `Resolve content intent for ${primaryKeyword}`,
      outline: [
        `Audit found duplicate H1 values on ${issue.page}.`,
        "Draft one focused article brief that separates the overlapping search intent.",
        `Use these headings as keyword seeds: ${keywords.join(", ")}.`,
      ].join("\n"),
      target_keywords: keywords,
    };
  }

  return {
    title: `${primaryKeyword} article brief`,
    outline: [
      `Audit found a missing content topic signal on ${issue.page}.`,
      `Create a blog article targeting "${primaryKeyword}" with practical buyer-intent sections.`,
      "Include internal links back to the relevant collection or product page.",
    ].join("\n"),
    target_keywords: keywords,
  };
}

function extractTargetKeywords(issue: AuditIssue): string[] {
  const raw =
    issue.ruleId === "h1.duplicate"
      ? issue.current.split("|")
      : issue.current.split(/[,，|]/);

  const keywords = raw
    .map((keyword) => keyword.trim())
    .filter((keyword, index, all) => keyword && all.indexOf(keyword) === index);

  return keywords.length > 0 ? keywords : ["SEO content"];
}
