"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { createAdminClient } from "@/lib/supabase/server";

const EXTERNAL_WEBSITES_PATH = "/dashboard/websites/external";

/**
 * 驗證管理員權限
 */
async function verifyAdmin(): Promise<boolean> {
  const user = await getUser();
  return user !== null && isAdminEmail(user.email);
}

/**
 * 建立重導向 URL
 */
function buildRedirectUrl(
  websiteId: string | null,
  type: "success" | "error",
  message: string,
): string {
  const base = websiteId
    ? `${EXTERNAL_WEBSITES_PATH}/${websiteId}/edit`
    : EXTERNAL_WEBSITES_PATH;
  return `${base}?${type}=${encodeURIComponent(message)}`;
}

/**
 * 更新網站設定的通用函數
 */
async function updateWebsiteConfig(
  websiteId: string,
  updateData: Record<string, unknown>,
  successMessage: string,
): Promise<void> {
  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from("website_configs")
    .update(updateData)
    .eq("id", websiteId)
    .eq("website_type", "external");

  if (error) {
    redirect(buildRedirectUrl(websiteId, "error", error.message));
  }

  revalidatePath(EXTERNAL_WEBSITES_PATH);
  redirect(buildRedirectUrl(websiteId, "success", successMessage));
}

/**
 * 更新外部網站基本資訊
 */
export async function updateExternalWebsite(formData: FormData): Promise<void> {
  if (!(await verifyAdmin())) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;
  const name = formData.get("name") as string;
  const webhookUrl = formData.get("webhookUrl") as string;

  if (!websiteId || !name) {
    redirect(buildRedirectUrl(websiteId, "error", "缺少必要欄位"));
  }

  // 驗證 webhook_url 格式
  if (webhookUrl) {
    try {
      new URL(webhookUrl);
    } catch {
      redirect(buildRedirectUrl(websiteId, "error", "Webhook URL 格式無效"));
    }
  }

  const updateData: Record<string, unknown> = { website_name: name };
  if (webhookUrl) {
    updateData.webhook_url = webhookUrl;
  }

  await updateWebsiteConfig(websiteId, updateData, "網站資訊已更新");
}

/**
 * 更新外部網站同步設定
 */
export async function updateExternalWebsiteSyncSettings(
  formData: FormData,
): Promise<void> {
  if (!(await verifyAdmin())) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;

  if (!websiteId) {
    redirect(buildRedirectUrl(null, "error", "缺少網站 ID"));
  }

  await updateWebsiteConfig(
    websiteId,
    {
      sync_on_publish: formData.get("syncOnPublish") === "true",
      sync_on_update: formData.get("syncOnUpdate") === "true",
      sync_on_unpublish: formData.get("syncOnUnpublish") === "true",
      sync_translations: formData.get("syncTranslations") === "true",
    },
    "同步設定已更新",
  );
}

/**
 * 更新外部網站品牌聲音設定
 */
export async function updateExternalWebsiteBrandVoice(
  formData: FormData,
): Promise<void> {
  if (!(await verifyAdmin())) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;

  if (!websiteId) {
    redirect(buildRedirectUrl(null, "error", "缺少網站 ID"));
  }

  const brandVoice = {
    brand_name: (formData.get("brandName") as string) || "",
    tone_of_voice: (formData.get("toneOfVoice") as string) || "專業親切",
    target_audience: (formData.get("targetAudience") as string) || "",
    writing_style: (formData.get("writingStyle") as string) || "專業正式",
  };

  await updateWebsiteConfig(
    websiteId,
    { brand_voice: brandVoice },
    "品牌設定已更新",
  );
}

/**
 * 更新外部網站自動排程設定
 */
export async function updateExternalWebsiteAutoSchedule(
  formData: FormData,
): Promise<void> {
  if (!(await verifyAdmin())) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;
  const dailyArticleLimit = parseInt(
    formData.get("dailyArticleLimit") as string,
  );
  const autoScheduleEnabled = formData.get("autoScheduleEnabled") === "true";
  const scheduleType = formData.get("scheduleType") as "daily" | "interval";
  const scheduleIntervalDays = parseInt(
    formData.get("scheduleIntervalDays") as string,
  );

  if (!websiteId) {
    redirect(buildRedirectUrl(null, "error", "缺少網站 ID"));
  }

  // 驗證排程模式
  if (scheduleType !== "daily" && scheduleType !== "interval") {
    redirect(buildRedirectUrl(websiteId, "error", "無效的排程模式"));
  }

  // 驗證每日篇數（1-5）
  if (isNaN(dailyArticleLimit) || dailyArticleLimit < 1 || dailyArticleLimit > 5) {
    redirect(
      buildRedirectUrl(websiteId, "error", "每日發布數量必須在 1-5 之間"),
    );
  }

  // 驗證間隔天數（2-7，僅 interval 模式檢查）
  if (scheduleType === "interval") {
    if (
      isNaN(scheduleIntervalDays) ||
      scheduleIntervalDays < 2 ||
      scheduleIntervalDays > 7
    ) {
      redirect(buildRedirectUrl(websiteId, "error", "間隔天數必須在 2-7 之間"));
    }
  }

  await updateWebsiteConfig(
    websiteId,
    {
      daily_article_limit: dailyArticleLimit,
      auto_schedule_enabled: autoScheduleEnabled,
      schedule_type: scheduleType,
      schedule_interval_days: scheduleType === "interval" ? scheduleIntervalDays : 1,
    },
    "自動排程設定已更新",
  );
}

/**
 * 更新外部網站文章設定（行業、地區、語言）
 */
export async function updateExternalWebsiteSettings(
  formData: FormData,
): Promise<void> {
  if (!(await verifyAdmin())) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;
  const industry = formData.get("industry") as string;
  const region = formData.get("region") as string;
  const language = formData.get("language") as string;

  if (!websiteId) {
    redirect(buildRedirectUrl(null, "error", "缺少網站 ID"));
  }

  await updateWebsiteConfig(
    websiteId,
    {
      industry: industry || null,
      region: region || null,
      language: language || null,
    },
    "文章生成設定已更新",
  );
}
