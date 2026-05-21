import type { CoreWebVitals, runChromiumAudit } from "./chromium-audit";
import type {
  ClarityPageMetric,
  GA4PageMetric,
  GSCPageMetric,
} from "./cross-analysis";

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
  cwv?: CoreWebVitals;
}

export type AuditScope = "single-page" | "sitemap" | "crawl";

export interface AuditWebsiteInput {
  url: string;
  scope: AuditScope;
  maxPages?: number;
  includeChromium?: boolean;
  gsc?: { token: string };
  ga4?: { propertyId: string; token: string };
  clarity?: { siteId: string; token: string };
}

export interface AuditWebsiteDeps {
  fetch?: typeof fetch;
  now?: () => Date;
  randomUuid?: () => string;
  chromiumAudit?: typeof runChromiumAudit;
  fetchGscMetrics?: (input: {
    token: string;
    url: string;
  }) => Promise<GSCPageMetric[]>;
  fetchGa4Metrics?: (input: {
    propertyId: string;
    token: string;
  }) => Promise<GA4PageMetric[]>;
  fetchClarityMetrics?: (input: {
    siteId: string;
    token: string;
  }) => Promise<ClarityPageMetric[]>;
}
