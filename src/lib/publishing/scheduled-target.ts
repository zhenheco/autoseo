export type ScheduledPublishTarget =
  | "platform_blog"
  | "external_webhook"
  | "wordpress";

export interface ScheduledPublishWebsiteConfig {
  is_active?: boolean | null;
  is_platform_blog?: boolean | null;
  website_type?: string | null;
  webhook_url?: string | null;
  wp_enabled?: boolean | null;
}

export type ScheduledPublishTargetResult =
  | {
      success: true;
      target: ScheduledPublishTarget;
    }
  | {
      success: false;
      error: string;
    };

export function resolveScheduledPublishTarget(
  website: ScheduledPublishWebsiteConfig,
): ScheduledPublishTargetResult {
  if (!website.is_active) {
    return {
      success: false,
      error: "網站已停用",
    };
  }

  if (website.is_platform_blog === true) {
    return {
      success: true,
      target: "platform_blog",
    };
  }

  if (website.website_type === "external") {
    if (!website.webhook_url) {
      return {
        success: false,
        error: "外部網站未設定 webhook URL",
      };
    }

    return {
      success: true,
      target: "external_webhook",
    };
  }

  if (!website.wp_enabled) {
    return {
      success: false,
      error: "WordPress 功能未啟用",
    };
  }

  return {
    success: true,
    target: "wordpress",
  };
}
