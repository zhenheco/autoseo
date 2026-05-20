import * as cheerio from "cheerio";
import type { AuditIssue } from "./types";

export interface ScanHtmlInput {
  html: string;
  pageUrl: string;
}

export function scanHtml(input: ScanHtmlInput): AuditIssue[] {
  const $ = cheerio.load(input.html);
  const issues: AuditIssue[] = [];

  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!metaDesc) {
    issues.push({
      ruleId: "meta.description.tooShort",
      severity: "critical",
      riskLevel: "low",
      page: input.pageUrl,
      selector: 'meta[name="description"]',
      current: "",
      source: "html-scan",
      estimatedImpact: "high",
    });
  } else if (metaDesc.length < 50) {
    issues.push({
      ruleId: "meta.description.tooShort",
      severity: "warning",
      riskLevel: "low",
      page: input.pageUrl,
      selector: 'meta[name="description"]',
      current: metaDesc,
      source: "html-scan",
      estimatedImpact: "medium",
    });
  }

  return issues;
}
