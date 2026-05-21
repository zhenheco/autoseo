import { describe, expect, it } from "vitest";
import { resolveScheduledPublishTarget } from "./scheduled-target";

describe("resolveScheduledPublishTarget", () => {
  it("rejects inactive websites", () => {
    expect(
      resolveScheduledPublishTarget({
        is_active: false,
      }),
    ).toEqual({
      success: false,
      error: "網站已停用",
    });
  });

  it("resolves platform blog websites", () => {
    expect(
      resolveScheduledPublishTarget({
        is_active: true,
        is_platform_blog: true,
        website_type: "external",
      }),
    ).toEqual({
      success: true,
      target: "platform_blog",
    });
  });

  it("requires a webhook URL for external websites", () => {
    expect(
      resolveScheduledPublishTarget({
        is_active: true,
        website_type: "external",
      }),
    ).toEqual({
      success: false,
      error: "外部網站未設定 webhook URL",
    });
  });

  it("resolves external webhook websites", () => {
    expect(
      resolveScheduledPublishTarget({
        is_active: true,
        website_type: "external",
        webhook_url: "https://webhook.test",
      }),
    ).toEqual({
      success: true,
      target: "external_webhook",
    });
  });

  it("requires WordPress to be enabled for WordPress targets", () => {
    expect(
      resolveScheduledPublishTarget({
        is_active: true,
        wp_enabled: false,
      }),
    ).toEqual({
      success: false,
      error: "WordPress 功能未啟用",
    });
  });

  it("resolves WordPress websites", () => {
    expect(
      resolveScheduledPublishTarget({
        is_active: true,
        wp_enabled: true,
      }),
    ).toEqual({
      success: true,
      target: "wordpress",
    });
  });
});
