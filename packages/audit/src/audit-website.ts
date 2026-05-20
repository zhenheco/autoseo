import { scanHtml } from "./scan-html";
import { scoreHealth } from "./score-health";
import { runChromiumAudit } from "./chromium-audit";
import {
  analyzeClarityScrollDepth,
  analyzeGa4ConversionPageNoCta,
  analyzeGscLowCtrHighImpression,
} from "./cross-analysis";
import type {
  AuditIssue,
  AuditReport,
  AuditWebsiteDeps,
  AuditWebsiteInput,
} from "./types";

export async function auditWebsite(
  input: AuditWebsiteInput,
  deps: AuditWebsiteDeps = {},
): Promise<AuditReport> {
  if (input.scope !== "single-page") {
    throw new Error(`scope_not_implemented: ${input.scope}`);
  }

  const fetchFn = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
  const chromiumAudit = deps.chromiumAudit ?? runChromiumAudit;
  const chromiumResultPromise = input.includeChromium
    ? chromiumAudit(input.url).then(
        (result) => ({ status: "fulfilled" as const, result }),
        (error: unknown) => ({ status: "rejected" as const, error }),
      )
    : undefined;

  let response: Response;
  try {
    response = await fetchFn(input.url, {
      headers: { "User-Agent": "Mozilla/5.0 (1waySEO audit)" },
    });
  } catch (cause) {
    throw new Error("audit_fetch_failed", { cause });
  }
  if (!response.ok) {
    throw new Error(`audit_fetch_failed: HTTP ${response.status}`);
  }

  const html = await response.text();
  const htmlIssues = scanHtml({ html, pageUrl: input.url });
  const crossAnalysisIssues = await collectCrossAnalysisIssues(input, deps);
  const chromiumResult = await chromiumResultPromise;
  const issues = [
    ...htmlIssues,
    ...crossAnalysisIssues,
    ...(chromiumResult?.status === "fulfilled"
      ? chromiumResult.result.a11yIssues
      : []),
    ...(chromiumResult?.status === "rejected"
      ? [createChromiumUnavailableIssue(input.url, chromiumResult.error)]
      : []),
  ];

  const report: AuditReport = {
    id: randomUuid(),
    url: input.url,
    scannedAt: now().toISOString(),
    pagesScanned: 1,
    healthScore: scoreHealth(issues),
    issues,
  };

  if (chromiumResult?.status === "fulfilled") {
    report.cwv = chromiumResult.result.cwv;
  }

  return report;
}

async function collectCrossAnalysisIssues(
  input: AuditWebsiteInput,
  deps: AuditWebsiteDeps,
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];

  if (input.gsc && deps.fetchGscMetrics) {
    try {
      const metrics = await deps.fetchGscMetrics({
        token: input.gsc.token,
        url: input.url,
      });
      issues.push(...analyzeGscLowCtrHighImpression(metrics));
    } catch (error) {
      issues.push(createMetricsUnavailableIssue("GSC", input.url, error));
    }
  }

  if (input.ga4 && deps.fetchGa4Metrics) {
    try {
      const metrics = await deps.fetchGa4Metrics({
        propertyId: input.ga4.propertyId,
        token: input.ga4.token,
      });
      issues.push(...analyzeGa4ConversionPageNoCta(metrics));
    } catch (error) {
      issues.push(createMetricsUnavailableIssue("GA4", input.url, error));
    }
  }

  if (input.clarity && deps.fetchClarityMetrics) {
    try {
      const metrics = await deps.fetchClarityMetrics({
        siteId: input.clarity.siteId,
        token: input.clarity.token,
      });
      issues.push(...analyzeClarityScrollDepth(metrics));
    } catch (error) {
      issues.push(createMetricsUnavailableIssue("Clarity", input.url, error));
    }
  }

  return issues;
}

function createMetricsUnavailableIssue(
  sourceName: "GSC" | "GA4" | "Clarity",
  pageUrl: string,
  error: unknown,
): AuditIssue {
  return {
    ruleId: `${sourceName.toLowerCase()}.metrics.unavailable`,
    severity: "warning",
    riskLevel: "low",
    page: pageUrl,
    current: `${sourceName} 暫時無法取得資料: ${errorMessage(error)}`,
    suggested: "稍後重試，或確認 OAuth scope、token 與站點權限設定。",
    source: "gsc-cross",
    estimatedImpact: "low",
  };
}

function createChromiumUnavailableIssue(
  pageUrl: string,
  error: unknown,
): AuditIssue {
  return {
    ruleId: "chromium.audit.unavailable",
    severity: "warning",
    riskLevel: "low",
    page: pageUrl,
    current: `Chromium audit unavailable: ${errorMessage(error)}`,
    suggested:
      "Enable Cloudflare Browser Rendering binding before relying on CWV and axe-core results.",
    source: "security",
    estimatedImpact: "low",
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}
