export type AuditSeverity = "critical" | "warning" | "info";
export type AuditRiskLevel = "low" | "medium" | "high";
export type AuditIssueSource =
  | "html-scan"
  | "cwv"
  | "gsc-cross"
  | "a11y"
  | "security";
export type AuditImpact = "high" | "medium" | "low";

export interface AuditIssue {
  ruleId: string;
  severity: AuditSeverity;
  riskLevel: AuditRiskLevel;
  page: string;
  selector?: string;
  current: string;
  suggested?: string;
  source: AuditIssueSource;
  estimatedImpact: AuditImpact;
}

export interface AuditReport {
  id: string;
  url: string;
  scannedAt: string;
  pagesScanned: number;
  healthScore: number;
  issues: AuditIssue[];
}

export type AuditScope = "single-page" | "sitemap" | "crawl";

export interface AuditWebsiteInput {
  url: string;
  scope: AuditScope;
  maxPages?: number;
  includeChromium?: boolean;
}

export interface AuditWebsiteDeps {
  fetch?: typeof fetch;
  now?: () => Date;
  randomUuid?: () => string;
}
