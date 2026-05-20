import type { AuditImpact, AuditIssue, AuditRiskLevel, AuditSeverity } from "./types";

export interface CoreWebVitals {
  lcp: number;
  fid: number;
  cls: number;
  inp: number;
}

export interface ChromiumAuditResult {
  cwv: CoreWebVitals;
  a11yIssues: AuditIssue[];
}

export interface ChromiumAuditDeps {
  browserRenderingFetch?: (input: { url: string }) => Promise<{
    lighthouseJson: unknown;
    axeJson: unknown;
  }>;
}

export async function runChromiumAudit(
  url: string,
  deps: ChromiumAuditDeps = {},
): Promise<ChromiumAuditResult> {
  if (!deps.browserRenderingFetch) {
    throw new Error("chromium_binding_not_available");
  }

  const payload = await deps.browserRenderingFetch({ url });

  return {
    cwv: parseCoreWebVitals(payload.lighthouseJson),
    a11yIssues: parseAxeIssues(payload.axeJson, url),
  };
}

type LighthouseAudit = {
  numericValue?: unknown;
};

type LighthouseJson = {
  audits?: Record<string, LighthouseAudit | undefined>;
};

function parseCoreWebVitals(lighthouseJson: unknown): CoreWebVitals {
  const audits = asLighthouseJson(lighthouseJson).audits ?? {};

  return {
    lcp: readNumericAudit(audits, "largest-contentful-paint", "lcp"),
    fid: readNumericAudit(audits, "max-potential-fid", "fid"),
    cls: readNumericAudit(audits, "cumulative-layout-shift", "cls"),
    inp: readNumericAudit(audits, "interaction-to-next-paint", "inp"),
  };
}

function asLighthouseJson(value: unknown): LighthouseJson {
  return isRecord(value) ? (value as LighthouseJson) : {};
}

function readNumericAudit(
  audits: Record<string, LighthouseAudit | undefined>,
  auditId: string,
  metricName: keyof CoreWebVitals,
): number {
  const value = audits[auditId]?.numericValue;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`chromium_audit_lighthouse_metric_missing:${metricName}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type AxeViolation = {
  id?: unknown;
  impact?: unknown;
  help?: unknown;
  description?: unknown;
  nodes?: unknown;
};

type AxeNode = {
  target?: unknown;
  html?: unknown;
  failureSummary?: unknown;
};

function parseAxeIssues(axeJson: unknown, pageUrl: string): AuditIssue[] {
  const violations = isRecord(axeJson) && Array.isArray(axeJson.violations)
    ? axeJson.violations
    : [];

  return violations.flatMap((violation) => {
    if (!isRecord(violation)) return [];

    const parsedViolation = violation as AxeViolation;
    const nodes = Array.isArray(parsedViolation.nodes)
      ? parsedViolation.nodes
      : [];

    return nodes.flatMap((node) => {
      if (!isRecord(node)) return [];

      const parsedNode = node as AxeNode;
      const impact = normalizeAxeImpact(parsedViolation.impact);

      return [
        {
          ruleId: `axe.${readString(parsedViolation.id, "unknown")}`,
          severity: severityForAxeImpact(impact),
          riskLevel: riskForAxeImpact(impact),
          page: pageUrl,
          selector: readAxeSelector(parsedNode.target),
          current:
            readOptionalString(parsedNode.failureSummary) ??
            readOptionalString(parsedNode.html) ??
            readString(parsedViolation.description, "Axe violation detected"),
          suggested: readOptionalString(parsedViolation.help),
          source: "a11y",
          estimatedImpact: estimatedImpactForAxeImpact(impact),
        },
      ];
    });
  });
}

function readAxeSelector(target: unknown): string | undefined {
  if (!Array.isArray(target)) return undefined;

  const selectors = target.filter(
    (selector): selector is string => typeof selector === "string",
  );
  return selectors.length > 0 ? selectors.join(", ") : undefined;
}

function normalizeAxeImpact(value: unknown): string {
  return typeof value === "string" ? value : "moderate";
}

function severityForAxeImpact(impact: string): AuditSeverity {
  if (impact === "critical" || impact === "serious") return "critical";
  if (impact === "moderate") return "warning";
  return "info";
}

function riskForAxeImpact(impact: string): AuditRiskLevel {
  if (impact === "critical" || impact === "serious") return "high";
  if (impact === "moderate") return "medium";
  return "low";
}

function estimatedImpactForAxeImpact(impact: string): AuditImpact {
  if (impact === "critical" || impact === "serious") return "high";
  if (impact === "moderate") return "medium";
  return "low";
}

function readString(value: unknown, fallback: string): string {
  return readOptionalString(value) ?? fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}
