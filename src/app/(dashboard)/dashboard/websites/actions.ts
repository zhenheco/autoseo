"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

interface Website {
  id: string;
  website_name: string;
  wordpress_url: string;
  company_id: string;
  is_active: boolean | null;
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

  // 取得網站資訊以檢查權限
  const { data: website } = await supabase
    .from("website_configs")
    .select("company_id")
    .eq("id", websiteId)
    .single();

  if (!website) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到該網站"));
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
  redirect("/dashboard/websites?success=" + encodeURIComponent("網站已刪除"));
}

/**
 * 更新 WordPress 網站
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

  if (!websiteId || !companyId || !siteName || !siteUrl || !wpUsername) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent("缺少必要欄位"),
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

  // 準備更新資料
  const updateData: {
    website_name: string;
    wordpress_url: string;
    wp_username: string;
    wp_app_password?: string;
  } = {
    website_name: siteName,
    wordpress_url: siteUrl.replace(/\/$/, ""), // 移除尾部斜線
    wp_username: wpUsername,
  };

  // 只有在提供新密碼時才更新
  if (wpPassword && wpPassword.trim() !== "") {
    updateData.wp_app_password = wpPassword;
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

  // 取得網站資訊以檢查權限
  const { data: website } = await supabase
    .from("website_configs")
    .select("company_id")
    .eq("id", websiteId)
    .single();

  if (!website) {
    throw new Error("找不到該網站");
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
    throw new Error("您沒有權限修改網站狀態");
  }

  // 切換狀態
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

  const { data: website } = await supabase
    .from("website_configs")
    .select("company_id")
    .eq("id", websiteId)
    .single();

  if (!website) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到網站"));
  }

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

  const { data: website } = await supabase
    .from("website_configs")
    .select("company_id")
    .eq("id", websiteId)
    .single();

  if (!website) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到網站"));
  }

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

  if (!websiteId) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("缺少網站 ID"));
  }

  // 驗證數值範圍（1-3 篇）
  if (
    isNaN(dailyArticleLimit) ||
    dailyArticleLimit < 1 ||
    dailyArticleLimit > 3
  ) {
    redirect(
      `/dashboard/websites/${websiteId}/edit?error=` +
        encodeURIComponent("每日發布數量必須在 1-3 之間"),
    );
  }

  const supabase = await createClient();

  // 取得網站資訊以檢查權限
  const { data: website } = await supabase
    .from("website_configs")
    .select("company_id")
    .eq("id", websiteId)
    .single();

  if (!website) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到網站"));
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
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限編輯此網站"),
    );
  }

  // 更新自動排程設定
  const { error } = await supabase
    .from("website_configs")
    .update({
      daily_article_limit: dailyArticleLimit,
      auto_schedule_enabled: autoScheduleEnabled,
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
