#!/usr/bin/env tsx

import { auditWebsite, type AuditReport, type AuditScope } from "@audit";
import { createAdminClient } from "@shared/supabase";

type Args = Record<string, string | boolean>;
type Source = "cli";

interface QueryResult<T> {
  data: T | null;
  error: { message?: string } | null;
}

interface AdminClient {
  from(table: string): {
    insert(payload: unknown): {
      select(columns: string): {
        single(): Promise<QueryResult<{ id: string }>>;
      };
    } | Promise<QueryResult<unknown>>;
  };
}

interface RunAuditDeps {
  adminClient?: AdminClient;
  auditWebsiteFn?: typeof auditWebsite;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;

    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index++;
  }

  return args;
}

function arg(args: Args, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function runAudit(
  argv: string[],
  deps: RunAuditDeps = {},
): Promise<string> {
  const args = parseArgs(argv);
  const websiteId = arg(args, "website-id");
  const url = arg(args, "url");
  const companyId = arg(args, "company-id") ?? null;
  const scope = (arg(args, "scope") ?? "single-page") as AuditScope;

  if (!websiteId && !url) {
    throw new Error("missing required argument: --website-id or --url");
  }

  const adminClient = deps.adminClient ?? createAdminClient();
  const auditWebsiteFn = deps.auditWebsiteFn ?? auditWebsite;
  const auditUrl = url;

  if (!auditUrl) {
    throw new Error("missing required argument: --url");
  }

  const report = await auditWebsiteFn({
    url: auditUrl,
    scope,
  });
  await persistAuditReport(adminClient, {
    report,
    companyId,
    websiteId: websiteId ?? null,
    scope,
    source: "cli",
  });

  return `# Audit Report — ${report.url}`;
}

async function persistAuditReport(
  adminClient: AdminClient,
  input: {
    report: AuditReport;
    companyId: string | null;
    websiteId: string | null;
    scope: AuditScope;
    source: Source;
  },
): Promise<void> {
  const reportInsert = adminClient.from("audit_reports").insert({
    company_id: input.companyId,
    website_id: input.websiteId,
    url: input.report.url,
    scope: input.scope,
    health_score: input.report.healthScore,
    pages_scanned: input.report.pagesScanned,
    raw_payload: input.report,
    source: input.source,
    scanned_at: input.report.scannedAt,
    created_by: null,
  });
  if (reportInsert instanceof Promise) {
    throw new Error("audit_report_insert_builder_missing_select");
  }

  const { data, error } = await reportInsert.select("id").single();
  if (error || !data) {
    throw new Error(`audit_report_persist_failed: ${error?.message ?? "no id"}`);
  }

  if (input.report.issues.length === 0) return;

  const issuesPayload = input.report.issues.map((issue) => ({
    report_id: data.id,
    rule_id: issue.ruleId,
    severity: issue.severity,
    risk_level: issue.riskLevel,
    page: issue.page,
    selector: issue.selector,
    current: issue.current,
    suggested: issue.suggested,
    source: issue.source,
    estimated_impact: issue.estimatedImpact,
  }));
  const issuesResult = adminClient.from("audit_issues").insert(issuesPayload);
  const { error: issuesError } =
    issuesResult instanceof Promise ? await issuesResult : await issuesResult;
  if (issuesError) {
    throw new Error(`audit_issues_persist_failed: ${issuesError.message}`);
  }
}

async function main(): Promise<void> {
  console.log(await runAudit(process.argv.slice(2)));
}

if (process.argv[1]?.endsWith("audit-cli.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
