/**
 * 自動排程模組
 * 用於文章生成完成後自動排入發布佇列
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getGoldenSlotsForDate, GOLDEN_SLOTS_UTC } from "./golden-slots";
import type { Database } from "@/types/database.types";

interface ScheduleResult {
  success: boolean;
  scheduledAt?: string;
  error?: string;
}

/**
 * 計算下一個可用的黃金時段
 * 考慮每日發布上限，找到最近的空位
 *
 * @param supabase Supabase client
 * @param websiteId 網站 ID
 * @param dailyLimit 每日發布上限（1-3 篇）
 * @returns 下一個可用的時段，或 null 表示 30 天內沒有空位
 */
export async function getNextAvailableSlot(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  dailyLimit: number,
): Promise<Date | null> {
  const now = new Date();

  // 檢查未來 30 天
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const targetDate = new Date(now);
    targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // 查詢該網站當天已排程的文章數
    const { count } = await supabase
      .from("article_jobs")
      .select("id", { count: "exact", head: true })
      .eq("website_id", websiteId)
      .eq("status", "scheduled")
      .gte("scheduled_publish_at", startOfDay.toISOString())
      .lte("scheduled_publish_at", endOfDay.toISOString());

    const scheduledCount = count || 0;

    // 如果當天還有空位
    if (scheduledCount < dailyLimit) {
      // 取得當天的黃金時段
      const goldenSlots = getGoldenSlotsForDate(targetDate);

      // 查詢已使用的時段
      const { data: usedSlots } = await supabase
        .from("article_jobs")
        .select("scheduled_publish_at")
        .eq("website_id", websiteId)
        .eq("status", "scheduled")
        .gte("scheduled_publish_at", startOfDay.toISOString())
        .lte("scheduled_publish_at", endOfDay.toISOString());

      const usedHours = new Set(
        usedSlots?.map((s) =>
          new Date(s.scheduled_publish_at!).getUTCHours(),
        ) || [],
      );

      // 找第一個可用的黃金時段
      for (const slot of goldenSlots) {
        // 如果是今天，跳過已過的時段
        if (dayOffset === 0 && slot <= now) continue;

        // 跳過已使用的時段
        if (usedHours.has(slot.getUTCHours())) continue;

        // 加入隨機偏移 (0-15 分鐘)，讓發布時間更自然
        const randomOffset = Math.floor(Math.random() * 16);
        slot.setUTCMinutes(randomOffset);

        return slot;
      }
    }
  }

  return null; // 30 天內沒有可用時段
}

/**
 * 自動排程文章
 * 文章生成完成後呼叫此函數，將文章排入發布佇列
 *
 * @param supabase Supabase client
 * @param articleJobId 文章任務 ID
 * @param websiteId 網站 ID
 * @returns 排程結果
 */
export async function autoScheduleArticle(
  supabase: SupabaseClient<Database>,
  articleJobId: string,
  websiteId: string,
): Promise<ScheduleResult> {
  // 1. 查詢網站設定
  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select(
      "id, auto_schedule_enabled, daily_article_limit, is_active, wp_enabled, is_platform_blog",
    )
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) {
    return { success: false, error: "找不到網站配置" };
  }

  // 2. 檢查自動排程是否啟用
  if (!website.auto_schedule_enabled) {
    return { success: false, error: "自動排程未啟用" };
  }

  // 3. 檢查網站是否啟用
  if (!website.is_active) {
    return { success: false, error: "網站已停用" };
  }

  // 4. 檢查網站配置是否完整（非 Platform Blog 需要 WordPress 設定）
  const isPlatformBlog = website.is_platform_blog === true;
  if (!isPlatformBlog && !website.wp_enabled) {
    return { success: false, error: "WordPress 功能未啟用" };
  }

  // 5. 檢查文章當前狀態（避免重複排程）
  const { data: job, error: jobError } = await supabase
    .from("article_jobs")
    .select("id, status")
    .eq("id", articleJobId)
    .single();

  if (jobError || !job) {
    return { success: false, error: "找不到文章任務" };
  }

  // 只有 completed 狀態的文章才能排程
  if (job.status !== "completed") {
    return {
      success: false,
      error: `文章狀態為 ${job.status}，無法排程`,
    };
  }

  // 6. 計算下一個可用時段
  const dailyLimit = website.daily_article_limit || 3;
  const nextSlot = await getNextAvailableSlot(supabase, websiteId, dailyLimit);

  if (!nextSlot) {
    return { success: false, error: "未來 30 天內沒有可用的發布時段" };
  }

  // 7. 更新文章任務狀態
  const { error: updateError } = await supabase
    .from("article_jobs")
    .update({
      status: "scheduled",
      scheduled_publish_at: nextSlot.toISOString(),
      auto_publish: true,
      publish_retry_count: 0,
      last_publish_error: null,
    })
    .eq("id", articleJobId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return {
    success: true,
    scheduledAt: nextSlot.toISOString(),
  };
}
