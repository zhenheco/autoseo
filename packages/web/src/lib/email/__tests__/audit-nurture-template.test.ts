import { describe, expect, it } from "vitest";
import {
  renderAuditNurtureEmail,
  type AuditNurtureEmailInput,
} from "../audit-nurture-template";

function input(
  overrides: Partial<AuditNurtureEmailInput> = {},
): AuditNurtureEmailInput {
  return {
    stage: 0,
    recipientEmail: "lead@example.com",
    scannedUrl: "https://shop.example/",
    healthScore: 76,
    topIssues: [
      {
        ruleId: "meta.description.missing",
        page: "https://shop.example/",
      },
      {
        ruleId: "image.alt.missing",
        page: "https://shop.example/products/a",
      },
    ],
    unsubscribeUrl:
      "https://app.1wayseo.com/api/public/audit/lead-email/unsubscribe?token=lead-token",
    ctaUrl: "https://app.1wayseo.com/signup?intent=connect-shopline",
    locale: "zh-TW",
    ...overrides,
  };
}

describe("renderAuditNurtureEmail", () => {
  it("renders zh-TW stage0 with score, top issues, CTA, and unsubscribe link", () => {
    const rendered = renderAuditNurtureEmail(input());

    expect(rendered.subject).toBe("您的 SEO 健檢完整報告 - 76/100");
    expect(rendered.text).toContain("SEO 健康分數: 76/100");
    expect(rendered.text).toContain("meta.description.missing");
    expect(rendered.text).toContain("綁定 1waySEO 自動修補");
    expect(rendered.text).toContain("取消訂閱");
    expect(rendered.html).toContain('data-action="unsubscribe"');
  });

  it("renders en-US stage1 with customer story CTA", () => {
    const rendered = renderAuditNurtureEmail(
      input({
        stage: 1,
        locale: "en-US",
      }),
    );

    expect(rendered.subject).toBe("Customer story: SEO progress after 30 days");
    expect(rendered.text).toContain("SEO health score: 76/100");
    expect(rendered.text).toContain("See the 30-day progress report");
    expect(rendered.text).toContain("Unsubscribe");
    expect(rendered.html).toContain("https://app.1wayseo.com/signup");
  });

  it("renders ja-JP stage2 with consultation CTA", () => {
    const rendered = renderAuditNurtureEmail(
      input({
        stage: 2,
        locale: "ja-JP",
      }),
    );

    expect(rendered.subject).toBe("SEO健診結果を一緒に確認しませんか？");
    expect(rendered.text).toContain("SEOヘルススコア: 76/100");
    expect(rendered.text).toContain("無料相談を予約");
    expect(rendered.text).toContain("配信停止");
    expect(rendered.html).toContain("image.alt.missing");
  });
});
