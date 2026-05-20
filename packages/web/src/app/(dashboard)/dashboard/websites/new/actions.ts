"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { WordPressClient } from "@/lib/wordpress/client";
import { encryptWordPressPassword } from "@/lib/security/token-encryption";

/**
 * 新增 WordPress 網站
 */
export async function createWebsite(formData: FormData) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const companyId = formData.get("companyId") as string;
  const siteName = formData.get("siteName") as string;
  const siteUrl = formData.get("siteUrl") as string;
  const wpUsername = formData.get("wpUsername") as string;
  const wpPassword = formData.get("wpPassword") as string;

  // 文章生成設定
  const industry = formData.get("industry") as string;
  const region = formData.get("region") as string;
  const language = formData.get("language") as string;

  // 品牌聲音設定
  const brandName = formData.get("brandName") as string;
  const toneOfVoice = formData.get("toneOfVoice") as string;
  const targetAudience = formData.get("targetAudience") as string;
  const writingStyle = formData.get("writingStyle") as string;

  // 自動發文設定
  const autoScheduleEnabled =
    formData.get("autoScheduleEnabled")?.toString().trim() === "true";
  const scheduleType =
    (formData.get("scheduleType")?.toString().trim() as "daily" | "interval") ||
    "daily";
  const dailyArticleLimit =
    parseInt(formData.get("dailyArticleLimit")?.toString().trim() || "3") || 3;
  const scheduleIntervalDays =
    parseInt(formData.get("scheduleIntervalDays")?.toString().trim() || "3") ||
    3;

  if (!companyId || !siteName || !siteUrl || !wpUsername || !wpPassword) {
    redirect(
      "/dashboard/websites/new?error=" + encodeURIComponent("缺少必要欄位"),
    );
  }

  // 檢查 URL 格式
  try {
    new URL(siteUrl);
  } catch {
    redirect(
      "/dashboard/websites/new?error=" + encodeURIComponent("無效的網站 URL"),
    );
  }

  const supabase = await createClient();

  // 檢查使用者是否有權限新增網站
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限新增網站"),
    );
  }

  // 檢查是否有相同網址的網站
  const normalizedUrl = siteUrl.replace(/\/$/, "");
  const { data: existingWebsite } = await supabase
    .from("website_configs")
    .select("id")
    .eq("company_id", companyId)
    .eq("wordpress_url", normalizedUrl)
    .single();

  if (existingWebsite) {
    redirect(
      "/dashboard/websites/new?error=" +
        encodeURIComponent("此網址已存在，無法重複新增"),
    );
  }

  // 驗證 WordPress 連線
  const wordpressClient = new WordPressClient({
    url: siteUrl.replace(/\/$/, ""),
    username: wpUsername,
    applicationPassword: wpPassword,
  });

  try {
    // 測試連線：嘗試取得分類列表（驗證認證是否有效）
    await wordpressClient.getCategories();
    console.log("[新增網站] WordPress 連線驗證成功:", siteUrl);
  } catch (error) {
    console.error("[新增網站] WordPress 連線驗證失敗:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "WordPress 連線失敗，請檢查網址、使用者名稱和應用密碼是否正確";
    redirect(
      "/dashboard/websites/new?error=" + encodeURIComponent(errorMessage),
    );
  }

  // 加密 WordPress 密碼
  const encryptedPassword = encryptWordPressPassword(wpPassword);

  // 建立網站記錄（連線驗證成功後）
  const { error } = await supabase.from("website_configs").insert({
    company_id: companyId,
    website_name: siteName,
    wordpress_url: siteUrl.replace(/\/$/, ""), // 移除尾部斜線
    wp_username: wpUsername,
    wp_app_password: encryptedPassword, // 加密儲存
    wp_enabled: true, // 連線驗證成功，啟用 WordPress 發佈
    is_active: true,
    // 文章生成設定
    industry: industry || null,
    region: region || null,
    language: language || "zh-TW",
    // 品牌聲音設定
    brand_voice: {
      brand_name: brandName || "",
      tone_of_voice: toneOfVoice || "專業親切",
      target_audience: targetAudience || "",
      writing_style: writingStyle || "專業正式",
    },
    // 自動發文設定
    auto_schedule_enabled: autoScheduleEnabled,
    schedule_type: scheduleType,
    daily_article_limit: dailyArticleLimit,
    schedule_interval_days: scheduleIntervalDays,
  });

  if (error) {
    console.error("新增網站錯誤:", error);
    redirect(
      "/dashboard/websites/new?error=" +
        encodeURIComponent(error.message || "新增網站失敗"),
    );
  }

  revalidatePath("/dashboard/websites");
  redirect(
    "/dashboard/websites?success=" + encodeURIComponent("網站已成功新增"),
  );
}
