"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { WordPressClient } from "@/lib/wordpress/client";
import {
  encryptWordPressPassword,
  decryptWordPressPassword,
} from "@/lib/security/token-encryption";
import {
  generateApiKey,
  hashApiKey,
  regenerateApiKey,
} from "@/lib/api-key/api-key-service";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Website {
  id: string;
  website_name: string;
  wordpress_url: string;
  company_id: string;
  is_active: boolean | null;
}

type UserRole = "owner" | "admin" | "member";

/**
 * 檢查使用者是否有管理權限（owner 或 admin）
 */
async function checkAdminPermission(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
): Promise<{ hasPermission: boolean; role: UserRole | null }> {
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .single();

  if (!membership) {
    return { hasPermission: false, role: null };
  }

  const hasPermission =
    membership.role === "owner" || membership.role === "admin";
  return { hasPermission, role: membership.role as UserRole };
}

/**
 * 取得網站並驗證存在性
 */
async function getWebsiteCompanyId(
  supabase: SupabaseClient,
  websiteId: string,
): Promise<string | null> {
  const { data: website } = await supabase
    .from("website_configs")
    .select("company_id")
    .eq("id", websiteId)
    .single();

  return website?.company_id ?? null;
}

/**
 * 取得用戶的網站列表
 */
export async function getUserWebsites(): Promise<{
  websites: Website[];
  companyId: string | null;
}> {
  const user = await getUser();
  if (!user) {
    return { websites: [], companyId: null };
  }

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return { websites: [], companyId: null };
  }

  const { data: websites, error } = await supabase
    .from("website_configs")
    .select("id, website_name, wordpress_url, company_id, is_active")
    .eq("company_id", membership.company_id)
    .order("website_name");

  if (error) {
    console.error("Failed to fetch websites:", error);
    return { websites: [], companyId: membership.company_id };
  }

  return {
    websites: (websites || []) as Website[],
    companyId: membership.company_id,
  };
}

/**
 * 刪除 WordPress 網站
 */
export async function deleteWebsite(formData: FormData) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;
  if (!websiteId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("缺少網站 ID"));
  }

  const supabase = await createClient();

  const companyId = await getWebsiteCompanyId(supabase, websiteId);
  if (!companyId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到該網站"));
  }

  const { hasPermission } = await checkAdminPermission(
    supabase,
    companyId,
    user.id,
  );
  if (!hasPermission) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限刪除網站"),
    );
  }

  const { error } = await supabase
    .from("website_configs")
    .delete()
    .eq("id", websiteId);

  if (error) {
    redirect("/dashboard/websites?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/websites");
  redirect("/dashboard/websites?success=" + encodeURIComponent("網站已刪除"));
}

/**
 * 更新網站（支援 WordPress 網站、外部 API 網站、Platform Blog）
 */
export async function updateWebsite(formData: FormData) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;
  const companyId = formData.get("companyId") as string;
  const siteName = formData.get("siteName") as string;
  const siteUrl = formData.get("siteUrl") as string;
  const wpUsername = formData.get("wpUsername") as string;
  const wpPassword = formData.get("wpPassword") as string;
  const isExternalSite = formData.get("isExternalSite") === "true";

  // 外部網站不需要 WordPress 認證欄位
  if (!websiteId || !companyId || !siteName || !siteUrl) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent("缺少必要欄位"),
    );
  }

  // 非外部網站需要 WordPress 認證
  if (!isExternalSite && !wpUsername) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent("缺少 WordPress 使用者名稱"),
    );
  }

  // 檢查 URL 格式
  try {
    new URL(siteUrl);
  } catch {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent("無效的網站 URL"),
    );
  }

  const supabase = await createClient();

  // 檢查使用者是否有權限更新網站
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .single();

  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限更新網站"),
    );
  }

  // 取得現有網站設定（用於取得現有密碼）
  const { data: existingConfig } = await supabase
    .from("website_configs")
    .select("wp_app_password, is_platform_blog, is_external_site")
    .eq("id", websiteId)
    .single();

  // Platform Blog 和外部網站不需要 WordPress 驗證
  const isPlatformBlog = existingConfig?.is_platform_blog === true;
  const isExternalSiteFromDB = existingConfig?.is_external_site === true;

  // WordPress 連線驗證（非 Platform Blog 且非外部網站才需要）
  if (!isPlatformBlog && !isExternalSiteFromDB && !isExternalSite && wpUsername) {
    // 決定使用哪個密碼：新密碼 > 現有密碼
    let passwordToTest = wpPassword?.trim() || "";
    if (!passwordToTest && existingConfig?.wp_app_password) {
      try {
        passwordToTest = decryptWordPressPassword(
          existingConfig.wp_app_password,
        );
      } catch {
        // 解密失敗，可能是舊格式未加密的密碼
        passwordToTest = existingConfig.wp_app_password;
      }
    }

    if (passwordToTest) {
      const wordpressClient = new WordPressClient({
        url: siteUrl.replace(/\/$/, ""),
        username: wpUsername,
        applicationPassword: passwordToTest,
      });

      try {
        await wordpressClient.getCategories();
        console.log("[編輯網站] WordPress 連線驗證成功:", siteUrl);
      } catch (error) {
        console.error("[編輯網站] WordPress 連線驗證失敗:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "WordPress 連線失敗，請檢查網址、使用者名稱和應用密碼是否正確";
        redirect(
          `/dashboard/websites/${websiteId}/edit?error=` +
            encodeURIComponent(errorMessage),
        );
      }
    }
  }

  // 準備更新資料
  const updateData: {
    website_name: string;
    wordpress_url: string;
    wp_username?: string;
    wp_app_password?: string;
  } = {
    website_name: siteName,
    wordpress_url: siteUrl.replace(/\/$/, ""), // 移除尾部斜線
  };

  // 外部網站不需要更新 WordPress 認證欄位
  if (!isExternalSite && !isExternalSiteFromDB) {
    if (wpUsername) {
      updateData.wp_username = wpUsername;
    }
    // 只有在提供新密碼時才更新（加密儲存）
    if (wpPassword && wpPassword.trim() !== "") {
      updateData.wp_app_password = encryptWordPressPassword(wpPassword.trim());
    }
  }

  // 更新網站記錄
  const { error } = await supabase
    .from("website_configs")
    .update(updateData)
    .eq("id", websiteId);

  if (error) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/websites");
  redirect("/dashboard/websites?success=" + encodeURIComponent("網站已更新"));
}

/**
 * 切換網站啟用狀態
 */
export async function toggleWebsiteStatus(formData: FormData) {
  const user = await getUser();
  if (!user) {
    throw new Error("未登入");
  }

  const websiteId = formData.get("websiteId") as string;
  const currentStatus = formData.get("currentStatus") === "true";

  if (!websiteId) {
    throw new Error("缺少網站 ID");
  }

  const supabase = await createClient();

  const companyId = await getWebsiteCompanyId(supabase, websiteId);
  if (!companyId) {
    throw new Error("找不到該網站");
  }

  const { hasPermission } = await checkAdminPermission(
    supabase,
    companyId,
    user.id,
  );
  if (!hasPermission) {
    throw new Error("您沒有權限修改網站狀態");
  }

  const { error } = await supabase
    .from("website_configs")
    .update({ is_active: !currentStatus })
    .eq("id", websiteId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/websites");
}

/**
 * 更新網站文章生成設定（產業、地區、語言）
 */
export async function updateWebsiteSettings(formData: FormData) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;
  const industry = formData.get("industry") as string;
  const region = formData.get("region") as string;
  const language = formData.get("language") as string;

  if (!websiteId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("缺少網站 ID"));
  }

  const supabase = await createClient();

  const companyId = await getWebsiteCompanyId(supabase, websiteId);
  if (!companyId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到網站"));
  }

  const { hasPermission } = await checkAdminPermission(
    supabase,
    companyId,
    user.id,
  );
  if (!hasPermission) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限編輯此網站"),
    );
  }

  const { error } = await supabase
    .from("website_configs")
    .update({
      industry: industry || null,
      region: region || null,
      language: language || null,
    })
    .eq("id", websiteId);

  if (error) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/websites");
  redirect(
    `/dashboard/websites/${websiteId}/edit?success=` +
      encodeURIComponent("文章生成設定已更新"),
  );
}

/**
 * 更新 Brand Voice 設定
 */
export async function updateWebsiteBrandVoice(formData: FormData) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;
  const brandName = formData.get("brandName") as string;
  const toneOfVoice = formData.get("toneOfVoice") as string;
  const targetAudience = formData.get("targetAudience") as string;
  const writingStyle = formData.get("writingStyle") as string;

  if (!websiteId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("缺少網站 ID"));
  }

  const supabase = await createClient();

  const companyId = await getWebsiteCompanyId(supabase, websiteId);
  if (!companyId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到網站"));
  }

  const { hasPermission } = await checkAdminPermission(
    supabase,
    companyId,
    user.id,
  );
  if (!hasPermission) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限編輯此網站"),
    );
  }

  const brandVoice = {
    brand_name: brandName || "",
    tone_of_voice: toneOfVoice || "專業親切",
    target_audience: targetAudience || "",
    writing_style: writingStyle || "專業正式",
  };

  const { error } = await supabase
    .from("website_configs")
    .update({ brand_voice: brandVoice })
    .eq("id", websiteId);

  if (error) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/websites");
  redirect(
    `/dashboard/websites/${websiteId}/edit?success=` +
      encodeURIComponent("品牌設定已更新"),
  );
}

/**
 * 建立平台官方 Blog 站點
 */
export async function createPlatformBlog(formData: FormData) {
  try {
    const user = await getUser();
    if (!user) {
      redirect("/login");
    }

    const companyId = formData.get("companyId") as string;

    if (!companyId) {
      redirect(
        "/dashboard/websites?error=" + encodeURIComponent("缺少公司 ID"),
      );
    }

    const supabase = await createClient();

    // 檢查使用者是否有權限
    const { data: membership, error: membershipError } = await supabase
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .single();

    if (membershipError) {
      console.error("Membership check error:", membershipError);
      redirect(
        "/dashboard/websites?error=" +
          encodeURIComponent("權限檢查失敗：" + membershipError.message),
      );
    }

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      redirect(
        "/dashboard/websites?error=" +
          encodeURIComponent("您沒有權限建立官方 Blog"),
      );
    }

    // 檢查是否已經存在官方 Blog（使用 maybeSingle 避免錯誤）
    const { data: existingBlog, error: checkError } = await supabase
      .from("website_configs")
      .select("id")
      .eq("is_platform_blog", true)
      .maybeSingle();

    if (checkError) {
      console.error("Platform blog check error:", checkError);
      redirect(
        "/dashboard/websites?error=" +
          encodeURIComponent("檢查官方 Blog 失敗：" + checkError.message),
      );
    }

    if (existingBlog) {
      redirect(
        "/dashboard/websites?error=" +
          encodeURIComponent("官方 Blog 已存在，無法重複建立"),
      );
    }

    // 建立官方 Blog 站點
    const { error } = await supabase.from("website_configs").insert({
      company_id: companyId,
      website_name: "1waySEO 官方 Blog",
      wordpress_url: "https://1wayseo.com/blog",
      is_platform_blog: true,
      is_active: true,
      language: "zh-TW",
      brand_voice: {
        brand_name: "1waySEO",
        tone_of_voice: "專業親切",
        target_audience: "SEO 初學者、內容行銷人員、網站經營者",
        writing_style: "教學導向、實用案例分享",
      },
      created_by: user.id,
    });

    if (error) {
      console.error("Create platform blog error:", error);
      redirect(
        "/dashboard/websites?error=" + encodeURIComponent(error.message),
      );
    }

    revalidatePath("/dashboard/websites");
    redirect(
      "/dashboard/websites?success=" +
        encodeURIComponent("官方 Blog 已建立成功！現在可以開始發布文章了。"),
    );
  } catch (err) {
    // 如果是 redirect 錯誤，重新拋出
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest: string }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    // 其他錯誤，記錄並返回錯誤頁面
    console.error("Unexpected error in createPlatformBlog:", err);
    redirect(
      "/dashboard/websites?error=" +
        encodeURIComponent(
          "發生未預期的錯誤：" + (err instanceof Error ? err.message : "未知"),
        ),
    );
  }
}

/**
 * 更新網站自動排程設定
 */
export async function updateWebsiteAutoSchedule(formData: FormData) {
  const user = await getUser();
  if (!user) {
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
    redirect("/dashboard/websites?error=" + encodeURIComponent("缺少網站 ID"));
  }

  // 驗證排程模式
  if (scheduleType !== "daily" && scheduleType !== "interval") {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent("無效的排程模式"),
    );
  }

  // 驗證數值範圍（每日 1-5 篇）
  if (
    isNaN(dailyArticleLimit) ||
    dailyArticleLimit < 1 ||
    dailyArticleLimit > 5
  ) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent("每日發布數量必須在 1-5 之間"),
    );
  }

  // 驗證間隔天數（2-7 天，interval 模式才檢查）
  if (scheduleType === "interval") {
    if (
      isNaN(scheduleIntervalDays) ||
      scheduleIntervalDays < 2 ||
      scheduleIntervalDays > 7
    ) {
      redirect(
        `/dashboard/websites/${websiteId}/edit?error=` +
          encodeURIComponent("間隔天數必須在 2-7 之間"),
      );
    }
  }

  const supabase = await createClient();

  const companyId = await getWebsiteCompanyId(supabase, websiteId);
  if (!companyId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到網站"));
  }

  const { hasPermission } = await checkAdminPermission(
    supabase,
    companyId,
    user.id,
  );
  if (!hasPermission) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限編輯此網站"),
    );
  }

  const { error } = await supabase
    .from("website_configs")
    .update({
      daily_article_limit: dailyArticleLimit,
      auto_schedule_enabled: autoScheduleEnabled,
      schedule_type: scheduleType,
      schedule_interval_days:
        scheduleType === "interval" ? scheduleIntervalDays : 1,
    })
    .eq("id", websiteId);

  if (error) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/websites");
  redirect(
    `/dashboard/websites/${websiteId}/edit?success=` +
      encodeURIComponent("自動排程設定已更新"),
  );
}

/**
 * 註冊外部網站
 */
export async function registerExternalSite(formData: FormData): Promise<{
  success: boolean;
  apiKey?: string;
  websiteId?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "未登入" };
  }

  const websiteName = formData.get("websiteName") as string;
  const websiteUrl = formData.get("websiteUrl") as string;
  const companyId = formData.get("companyId") as string;

  if (!websiteName || !websiteUrl || !companyId) {
    return { success: false, error: "缺少必要欄位" };
  }

  // 驗證 URL 格式
  try {
    new URL(websiteUrl);
  } catch {
    return { success: false, error: "無效的網站 URL" };
  }

  const supabase = await createClient();

  // 檢查使用者是否有權限
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .single();

  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return { success: false, error: "您沒有權限註冊外部網站" };
  }

  // 檢查網址是否已被使用
  const { data: existingWebsite } = await supabase
    .from("website_configs")
    .select("id")
    .eq("wordpress_url", websiteUrl)
    .single();

  if (existingWebsite) {
    return { success: false, error: "此網址已被註冊" };
  }

  // 生成 API Key
  const apiKey = await generateApiKey();
  const hashedApiKey = await hashApiKey(apiKey);

  // 建立網站記錄
  const { data: website, error } = await supabase
    .from("website_configs")
    .insert({
      company_id: companyId,
      website_name: websiteName,
      wordpress_url: websiteUrl.replace(/\/$/, ""),
      site_type: "external",
      is_external_site: true,
      wp_enabled: false,
      api_key: hashedApiKey,
      api_key_created_at: new Date().toISOString(),
      is_active: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[External Site Register] Database error:", error);
    return { success: false, error: "建立網站失敗：" + error.message };
  }

  revalidatePath("/dashboard/websites");

  return {
    success: true,
    apiKey: apiKey,
    websiteId: website.id,
  };
}

/**
 * 重新生成外部網站 API Key
 */
export async function regenerateExternalSiteApiKey(
  formData: FormData,
): Promise<{
  success: boolean;
  apiKey?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "未登入" };
  }

  const websiteId = formData.get("websiteId") as string;

  if (!websiteId) {
    return { success: false, error: "缺少網站 ID" };
  }

  const supabase = await createClient();

  // 取得網站資訊
  const { data: website } = await supabase
    .from("website_configs")
    .select("company_id, is_external_site")
    .eq("id", websiteId)
    .single();

  if (!website) {
    return { success: false, error: "找不到該網站" };
  }

  if (!website.is_external_site) {
    return { success: false, error: "此網站不是外部網站" };
  }

  // 檢查使用者是否有權限
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", website.company_id)
    .eq("user_id", user.id)
    .single();

  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return { success: false, error: "您沒有權限重新生成 API Key" };
  }

  // 重新生成 API Key
  const newApiKey = await regenerateApiKey(websiteId, website.company_id);

  if (!newApiKey) {
    return { success: false, error: "重新生成 API Key 失敗" };
  }

  revalidatePath("/dashboard/websites");

  return {
    success: true,
    apiKey: newApiKey,
  };
}

/**
 * 刪除外部網站
 */
export async function deleteExternalSite(formData: FormData) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const websiteId = formData.get("websiteId") as string;

  if (!websiteId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("缺少網站 ID"));
  }

  const supabase = await createClient();

  // 取得網站資訊以檢查權限
  const { data: website } = await supabase
    .from("website_configs")
    .select("company_id, is_external_site")
    .eq("id", websiteId)
    .single();

  if (!website) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到該網站"));
  }

  if (!website.is_external_site) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("此網站不是外部網站"),
    );
  }

  // 檢查使用者是否有權限刪除
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", website.company_id)
    .eq("user_id", user.id)
    .single();

  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限刪除網站"),
    );
  }

  // 刪除網站
  const { error } = await supabase
    .from("website_configs")
    .delete()
    .eq("id", websiteId);

  if (error) {
    redirect("/dashboard/websites?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/websites");
  redirect(
    "/dashboard/websites?success=" + encodeURIComponent("外部網站已刪除"),
  );
}

/**
 * 取得外部網站的 masked API Key
 */
export async function getExternalSiteMaskedApiKey(
  websiteId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("website_configs")
    .select("api_key")
    .eq("id", websiteId)
    .eq("is_external_site", true)
    .single();

  if (!data?.api_key) {
    return null;
  }

  // API Key 已經是 hash 過的，我們返回一個提示格式
  return "sk_site_••••••••";
}
