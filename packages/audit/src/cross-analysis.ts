import type { AuditIssue } from "./types";

export interface GSCPageMetric {
  page: string;
  query: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface GA4PageMetric {
  page: string;
  conversions: number;
  sessions: number;
  hasCTA?: boolean;
}

export interface ClarityPageMetric {
  page: string;
  avgScrollDepth: number;
  bounceRate: number;
}

export function analyzeGscLowCtrHighImpression(
  metrics: GSCPageMetric[],
): AuditIssue[] {
  return metrics
    .filter(
      (metric) =>
        metric.position >= 4 &&
        metric.position <= 15 &&
        metric.impressions > 100 &&
        metric.ctr < 0.02,
    )
    .map((metric) => ({
      ruleId: "gsc.low-ctr-high-impression",
      severity: "warning",
      riskLevel: "medium",
      page: metric.page,
      current: `position=${metric.position}, ctr=${formatPercent(metric.ctr)}, impressions=${metric.impressions}`,
      suggested:
        "重寫 meta title 加吸引點擊的詞 (例：「2026 最新」、「免費」、「指南」)",
      source: "gsc-cross",
      estimatedImpact: "high",
    }));
}

export function analyzeClarityScrollDepth(
  _metrics: ClarityPageMetric[],
): AuditIssue[] {
  return [];
}

export function analyzeGa4ConversionPageNoCta(
  _metrics: GA4PageMetric[],
): AuditIssue[] {
  return [];
}

function formatPercent(value: number): string {
  return `${value * 100}%`;
}
