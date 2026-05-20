import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanHtml } from "../src/scan-html";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(testDir, "../fixtures");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("scanHtml", () => {
  it("reports a critical issue when meta description is missing", () => {
    const issues = scanHtml({
      html: readFixture("no-meta-desc.html"),
      pageUrl: "https://example.com/no-meta",
    });

    expect(issues).toEqual([
      {
        ruleId: "meta.description.tooShort",
        severity: "critical",
        riskLevel: "low",
        page: "https://example.com/no-meta",
        selector: 'meta[name="description"]',
        current: "",
        source: "html-scan",
        estimatedImpact: "high",
      },
    ]);
  });

  it("reports a warning issue when meta description is too short", () => {
    const issues = scanHtml({
      html: readFixture("short-meta-desc.html"),
      pageUrl: "https://example.com/short-meta",
    });

    expect(issues).toEqual([
      {
        ruleId: "meta.description.tooShort",
        severity: "warning",
        riskLevel: "low",
        page: "https://example.com/short-meta",
        selector: 'meta[name="description"]',
        current: "too short",
        source: "html-scan",
        estimatedImpact: "medium",
      },
    ]);
  });

  it("does not report an issue when meta description length is acceptable", () => {
    const issues = scanHtml({
      html: readFixture("good-meta-desc.html"),
      pageUrl: "https://example.com/good-meta",
    });

    expect(issues).toEqual([]);
  });

  it("does not report issues for a complete HTML page", () => {
    const issues = scanHtml({
      html: readFixture("all-good.html"),
      pageUrl: "https://example.com/all-good",
    });

    expect(issues).toEqual([]);
  });

  it("reports a warning issue when og:image is missing", () => {
    const issues = scanHtml({
      html: readFixture("og-image-missing.html"),
      pageUrl: "https://example.com/og-image-missing",
    });

    expect(issues).toContainEqual({
      ruleId: "og.image.missing",
      severity: "warning",
      riskLevel: "low",
      page: "https://example.com/og-image-missing",
      selector: 'meta[property="og:image"]',
      current: "",
      source: "html-scan",
      estimatedImpact: "high",
    });
  });

  it("does not report og:image when it is present with content", () => {
    const issues = scanHtml({
      html: readFixture("all-good.html"),
      pageUrl: "https://example.com/all-good",
    });

    expect(issues.some((issue) => issue.ruleId === "og.image.missing")).toBe(false);
  });

  it("includes og:image in multi-issue scans", () => {
    const issues = scanHtml({
      html: readFixture("multi-issues.html"),
      pageUrl: "https://example.com/multi-issues",
    });

    expect(issues.length).toBeGreaterThan(1);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "og.image.missing" }),
      ]),
    );
  });

  it("reports a warning issue when og:title is missing", () => {
    const issues = scanHtml({
      html: readFixture("og-title-missing.html"),
      pageUrl: "https://example.com/og-title-missing",
    });

    expect(issues).toContainEqual({
      ruleId: "og.title.missing",
      severity: "warning",
      riskLevel: "low",
      page: "https://example.com/og-title-missing",
      selector: 'meta[property="og:title"]',
      current: "",
      source: "html-scan",
      estimatedImpact: "medium",
    });
  });

  it("does not report og:title when it is present", () => {
    const issues = scanHtml({
      html: readFixture("all-good.html"),
      pageUrl: "https://example.com/all-good",
    });

    expect(issues.some((issue) => issue.ruleId === "og.title.missing")).toBe(false);
  });

  it("includes og:title in multi-issue scans", () => {
    const issues = scanHtml({
      html: readFixture("multi-issues.html"),
      pageUrl: "https://example.com/multi-issues",
    });

    expect(issues.length).toBeGreaterThan(2);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "og.title.missing" }),
      ]),
    );
  });

  it("reports a warning issue when canonical is missing", () => {
    const issues = scanHtml({
      html: readFixture("canonical-missing.html"),
      pageUrl: "https://example.com/canonical-missing",
    });

    expect(issues).toContainEqual({
      ruleId: "canonical.missing",
      severity: "warning",
      riskLevel: "low",
      page: "https://example.com/canonical-missing",
      selector: 'link[rel="canonical"]',
      current: "",
      source: "html-scan",
      estimatedImpact: "medium",
    });
  });

  it("does not report canonical when it is present", () => {
    const issues = scanHtml({
      html: readFixture("all-good.html"),
      pageUrl: "https://example.com/all-good",
    });

    expect(issues.some((issue) => issue.ruleId === "canonical.missing")).toBe(false);
  });

  it("includes canonical in multi-issue scans", () => {
    const issues = scanHtml({
      html: readFixture("multi-issues.html"),
      pageUrl: "https://example.com/multi-issues",
    });

    expect(issues.length).toBeGreaterThan(3);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "canonical.missing" }),
      ]),
    );
  });

  it("reports a critical issue when h1 is missing", () => {
    const issues = scanHtml({
      html: readFixture("h1-missing.html"),
      pageUrl: "https://example.com/h1-missing",
    });

    expect(issues).toContainEqual({
      ruleId: "h1.missing",
      severity: "critical",
      riskLevel: "medium",
      page: "https://example.com/h1-missing",
      selector: "h1",
      current: "",
      source: "html-scan",
      estimatedImpact: "high",
    });
  });

  it("does not report h1 missing when one h1 is present", () => {
    const issues = scanHtml({
      html: readFixture("all-good.html"),
      pageUrl: "https://example.com/all-good",
    });

    expect(issues.some((issue) => issue.ruleId === "h1.missing")).toBe(false);
  });

  it("includes h1 missing in multi-issue scans", () => {
    const issues = scanHtml({
      html: readFixture("multi-h1-missing.html"),
      pageUrl: "https://example.com/multi-h1-missing",
    });

    expect(issues.length).toBeGreaterThan(1);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "h1.missing" }),
      ]),
    );
  });

  it("reports a warning issue when h1 appears more than once", () => {
    const issues = scanHtml({
      html: readFixture("h1-duplicate.html"),
      pageUrl: "https://example.com/h1-duplicate",
    });

    expect(issues).toContainEqual({
      ruleId: "h1.duplicate",
      severity: "warning",
      riskLevel: "medium",
      page: "https://example.com/h1-duplicate",
      selector: "h1",
      current: "Primary Heading|Secondary Heading",
      source: "html-scan",
      estimatedImpact: "medium",
    });
  });

  it("does not report h1 duplicate when exactly one h1 is present", () => {
    const issues = scanHtml({
      html: readFixture("all-good.html"),
      pageUrl: "https://example.com/all-good",
    });

    expect(issues.some((issue) => issue.ruleId === "h1.duplicate")).toBe(false);
  });

  it("includes h1 duplicate in multi-issue scans", () => {
    const issues = scanHtml({
      html: readFixture("multi-issues.html"),
      pageUrl: "https://example.com/multi-issues",
    });

    expect(issues.length).toBeGreaterThan(4);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "h1.duplicate",
          current: "First Heading|Second Heading",
        }),
      ]),
    );
  });

  it("reports a warning issue for each image missing alt text", () => {
    const issues = scanHtml({
      html: readFixture("alt-missing.html"),
      pageUrl: "https://example.com/alt-missing",
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        {
          ruleId: "alt.missing",
          severity: "warning",
          riskLevel: "low",
          page: "https://example.com/alt-missing",
          selector: 'img[src="/images/missing-alt.jpg"]:nth-of-type(1)',
          current: "",
          source: "html-scan",
          estimatedImpact: "medium",
        },
        {
          ruleId: "alt.missing",
          severity: "warning",
          riskLevel: "low",
          page: "https://example.com/alt-missing",
          selector: 'img[src="/images/empty-alt.jpg"]:nth-of-type(2)',
          current: "",
          source: "html-scan",
          estimatedImpact: "medium",
        },
      ]),
    );
  });

  it("does not report alt missing when every image has alt text", () => {
    const issues = scanHtml({
      html: readFixture("all-good.html"),
      pageUrl: "https://example.com/all-good",
    });

    expect(issues.some((issue) => issue.ruleId === "alt.missing")).toBe(false);
  });

  it("includes alt missing in multi-issue scans", () => {
    const issues = scanHtml({
      html: readFixture("multi-issues.html"),
      pageUrl: "https://example.com/multi-issues",
    });

    expect(issues.filter((issue) => issue.ruleId === "alt.missing")).toHaveLength(2);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "alt.missing",
          selector: 'img[src="/images/missing-alt.jpg"]:nth-of-type(1)',
        }),
        expect.objectContaining({
          ruleId: "alt.missing",
          selector: 'img[src="/images/empty-alt.jpg"]:nth-of-type(2)',
        }),
      ]),
    );
  });
});
