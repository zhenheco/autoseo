import type { AuditIssue } from "./types";

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
    a11yIssues: [],
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
