import { describe, expect, it } from "vitest";

import {
  sanitizeArticleHtml,
  serializeJsonLd,
} from "@/lib/security/html-sanitizer";

describe("security html helpers", () => {
  it("removes executable HTML from article content", () => {
    const dirty =
      '<p>Hello</p><img src="x" onerror="alert(1)"><script>alert(1)</script>';

    const clean = sanitizeArticleHtml(dirty);

    expect(clean).toContain("<p>Hello</p>");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("<script");
  });

  it("serializes JSON-LD without allowing script termination", () => {
    const serialized = serializeJsonLd({
      "@context": "https://schema.org",
      headline: '</script><script>alert("xss")</script>',
      separator: "\u2028\u2029",
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script");
    expect(serialized).toContain("\\u003c/script");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
    expect(JSON.parse(serialized).headline).toBe(
      '</script><script>alert("xss")</script>',
    );
  });
});
