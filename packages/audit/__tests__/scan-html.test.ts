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
});
