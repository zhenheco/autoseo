import * as cheerio from "cheerio";
import type { AuditIssue } from "./types";

type CheerioRoot = ReturnType<typeof cheerio.load>;

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

  issues.push(...checkOgImage($, input.pageUrl));
  issues.push(...checkOgTitle($, input.pageUrl));
  issues.push(...checkCanonical($, input.pageUrl));
  issues.push(...checkH1($, input.pageUrl));

  return issues;
}

function checkOgImage($: CheerioRoot, pageUrl: string): AuditIssue[] {
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() ?? "";
  if (ogImage) {
    return [];
  }

  return [
    {
      ruleId: "og.image.missing",
      severity: "warning",
      riskLevel: "low",
      page: pageUrl,
      selector: 'meta[property="og:image"]',
      current: "",
      source: "html-scan",
      estimatedImpact: "high",
    },
  ];
}

function checkH1($: CheerioRoot, pageUrl: string): AuditIssue[] {
  const h1Elements = $("h1");
  if (h1Elements.length > 0) {
    return [];
  }

  return [
    {
      ruleId: "h1.missing",
      severity: "critical",
      riskLevel: "medium",
      page: pageUrl,
      selector: "h1",
      current: "",
      source: "html-scan",
      estimatedImpact: "high",
    },
  ];
}

function checkCanonical($: CheerioRoot, pageUrl: string): AuditIssue[] {
  const canonicalHref = $('link[rel="canonical"]').attr("href")?.trim() ?? "";
  if (canonicalHref) {
    return [];
  }

  return [
    {
      ruleId: "canonical.missing",
      severity: "warning",
      riskLevel: "low",
      page: pageUrl,
      selector: 'link[rel="canonical"]',
      current: "",
      source: "html-scan",
      estimatedImpact: "medium",
    },
  ];
}

function checkOgTitle($: CheerioRoot, pageUrl: string): AuditIssue[] {
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
  if (ogTitle) {
    return [];
  }

  return [
    {
      ruleId: "og.title.missing",
      severity: "warning",
      riskLevel: "low",
      page: pageUrl,
      selector: 'meta[property="og:title"]',
      current: "",
      source: "html-scan",
      estimatedImpact: "medium",
    },
  ];
}
