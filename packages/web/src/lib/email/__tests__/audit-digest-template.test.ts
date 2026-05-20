import { describe, expect, it } from "vitest";
import {
  renderAuditDigestEmail,
  type AuditDigestEmailInput,
} from "../audit-digest-template";

function input(
  overrides: Partial<AuditDigestEmailInput> = {},
): AuditDigestEmailInput {
  return {
    companyName: "Acme SEO",
    weekStart: "2026-05-14",
    weekEnd: "2026-05-21",
    delta: {
      newIssues: 3,
      resolvedIssues: 2,
      healthScoreCurrent: 88,
      healthScoreDelta: 5,
    },
    topRecommendations: [
      {
        ruleId: "missing-title",
        page: "/products/a",
        suggested: "補上唯一商品標題",
      },
      {
        ruleId: "thin-copy",
        page: "/products/b",
        suggested: "擴充商品描述",
      },
    ],
    dashboardUrl: "https://app.1wayseo.com/dashboard/audit",
    locale: "zh-TW",
    ...overrides,
  };
}

describe("renderAuditDigestEmail", () => {
  it("renders the zh-TW template with company, score, delta, and CTA", () => {
    const rendered = renderAuditDigestEmail(input());

    expect(rendered.subject).toContain("Acme SEO");
    expect(rendered.subject).toContain("每週");
    expect(rendered.text).toContain("健康分數：88（+5）");
    expect(rendered.text).toContain("本週新發現：3");
    expect(rendered.text).toContain("本週已解決：2");
    expect(rendered.text).toContain("查看儀表板");
    expect(rendered.html).toContain("https://app.1wayseo.com/dashboard/audit");
  });

  it("renders the en-US template", () => {
    const rendered = renderAuditDigestEmail(input({ locale: "en-US" }));

    expect(rendered.subject).toBe("Acme SEO weekly SEO audit digest");
    expect(rendered.text).toContain("Health score: 88 (+5)");
    expect(rendered.text).toContain("New issues: 3");
    expect(rendered.text).toContain("Resolved issues: 2");
    expect(rendered.text).toContain("Top recommendations");
    expect(rendered.html).toContain("Open dashboard");
  });

  it("renders the ja-JP template", () => {
    const rendered = renderAuditDigestEmail(
      input({
        locale: "ja-JP",
        topRecommendations: [
          {
            ruleId: "missing-title",
            page: "/products/a",
            suggested: "固有の商品タイトルを追加",
          },
        ],
      }),
    );

    expect(rendered.subject).toBe("Acme SEO 週次SEO監査ダイジェスト");
    expect(rendered.text).toContain("ヘルススコア：88（+5）");
    expect(rendered.text).toContain("今週の新規課題：3");
    expect(rendered.text).toContain("ダッシュボードを開く");
  });

  it.each(["ko-KR", "de-DE", "es-ES", "fr-FR"] as const)(
    "renders a stable %s text snapshot",
    (locale) => {
      const rendered = renderAuditDigestEmail(input({ locale }));

      expect({
        subject: rendered.subject,
        text: rendered.text,
      }).toMatchSnapshot();
    },
  );
});
