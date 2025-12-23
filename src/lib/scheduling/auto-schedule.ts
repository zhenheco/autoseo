/**
 * 自動排程模組
 * 用於文章生成完成後自動排入發布佇列
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  getGoldenSlotsForDate,
  GOLDEN_SLOTS_UTC,
  getExtendedSlotsForCount,
} from "./golden-slots";
import type { Database } from "@/types/database.types";

interface ScheduleResult {
  success: boolean;
  scheduledAt?: string;
  error?: string;
}

/**
 * 排程選項
 */
interface ScheduleOptions {
  /** 排程模式：daily（每日 N 篇）或 interval（每 X 天 1 篇） */
  scheduleType?: "daily" | "interval" | null;
  /** 間隔天數（僅在 interval 模式使用，2-7） */
  intervalDays?: number | null;
}

/**
 * 計算下一個可用的發布時段
 * 支援兩種模式：
 * 1. daily: 每日發布 N 篇，使用黃金時段和補位時段
 * 2. interval: 每 X 天發布 1 篇，固定使用第一個黃金時段
 *
 * @param supabase Supabase client
 * @param websiteId 網站 ID
 * @param dailyLimit 每日發布上限（1-5 篇）
 * @param options 排程選項
 * @returns 下一個可用的時段，或 null 表示 30 天內沒有空位
 */
export async function getNextAvailableSlot(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  dailyLimit: number,
  options?: ScheduleOptions,
): Promise<Date | null> {
  const now = new Date();
  const scheduleType = options?.scheduleType || "daily";
  const intervalDays = options?.intervalDays || 1;

  // interval 模式：每 X 天發布 1 篇
  if (scheduleType === "interval" && intervalDays > 1) {
    return getNextIntervalSlot(supabase, websiteId, intervalDays, now);
  }

  // daily 模式：每日發布 N 篇
  return getNextDailySlot(supabase, websiteId, dailyLimit, now);
}

/**
 * daily 模式：計算下一個可用的每日時段
 */
async function getNextDailySlot(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  dailyLimit: number,
  now: Date,
): Promise<Date | null> {
  // 取得對應篇數的時段
  const slotsUTC = getExtendedSlotsForCount(dailyLimit);

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

      // 找第一個可用的時段
      for (const slotHour of slotsUTC) {
        // 跳過已使用的時段
        if (usedHours.has(slotHour)) continue;

        const slot = new Date(targetDate);
        slot.setUTCHours(slotHour, 0, 0, 0);

        // 如果是今天，跳過已過的時段
        if (dayOffset === 0 && slot <= now) continue;

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
 * interval 模式：計算下一個間隔時段
 * 確保與上次發布間隔至少 intervalDays 天
 */
async function getNextIntervalSlot(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  intervalDays: number,
  now: Date,
): Promise<Date | null> {
  // 查詢該網站最近一次排程或已發布的文章
  const { data: lastArticle } = await supabase
    .from("article_jobs")
    .select("scheduled_publish_at, completed_at")
    .eq("website_id", websiteId)
    .in("status", ["scheduled", "published"])
    .order("scheduled_publish_at", { ascending: false })
    .limit(1)
    .single();

  let nextDate: Date;

  if (lastArticle?.scheduled_publish_at) {
    // 有上次排程：從上次排程日期 + 間隔天數開始
    const lastDate = new Date(lastArticle.scheduled_publish_at);
    nextDate = new Date(lastDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + intervalDays);
  } else {
    // 沒有排程紀錄：從明天開始
    nextDate = new Date(now);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  }

  // 如果計算出的日期已過，調整到今天或明天
  if (nextDate < now) {
    nextDate = new Date(now);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  }

  // 設定為第一個黃金時段（09:00 台灣時間 = UTC 01:00）
  nextDate.setUTCHours(GOLDEN_SLOTS_UTC[0], 0, 0, 0);

  // 加入隨機偏移 (0-15 分鐘)
  const randomOffset = Math.floor(Math.random() * 16);
  nextDate.setUTCMinutes(randomOffset);

  // 確保不超過 30 天
  const maxDate = new Date(now);
  maxDate.setUTCDate(maxDate.getUTCDate() + 30);

  if (nextDate > maxDate) {
    return null;
  }

  return nextDate;
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
      "id, auto_schedule_enabled, daily_article_limit, is_active, wp_enabled, is_platform_blog, schedule_type, schedule_interval_days",
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
  const scheduleType = website.schedule_type || "daily";
  const intervalDays = website.schedule_interval_days || 1;

  const nextSlot = await getNextAvailableSlot(supabase, websiteId, dailyLimit, {
    scheduleType,
    intervalDays,
  });

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
