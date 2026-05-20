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

  await deps.browserRenderingFetch({ url });
  throw new Error("chromium_audit_parse_not_implemented");
}
