#!/usr/bin/env tsx

/**
 * 檢查排程文章不足，發送警告通知（按網站檢查）
 * 由 GitHub Actions 每天執行一次
 */

import { createClient } from "@supabase/supabase-js";
import { sendScheduleAlertEmail } from "../src/lib/email";
import type { Database } from "../src/types/database.types";

const ALERT_LEVELS = [
  { days: 7, key: "7_day" },
  { days: 3, key: "3_day" },
  { days: 1, key: "1_day" },
] as const;

interface Website {
  id: string;
  website_name: string;
  company_id: string;
  daily_article_limit: number | null;
}

interface Company {
  id: string;
  owner_id: string | null;
  schedule_alerts_sent: Record<string, string> | null;
}

async function main() {
  console.log("[Schedule Alert] 🚀 開始檢查排程警告（按網站）...");

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[Schedule Alert] ❌ 缺少環境變數 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 查詢所有啟用的網站，並關聯公司資訊
  const { data: websites, error: websitesError } = await supabase
    .from("website_configs")
    .select("id, website_name, company_id, daily_article_limit")
    .eq("is_active", true);

  if (websitesError) {
    console.error("[Schedule Alert] ❌ 查詢網站失敗:", websitesError);
    process.exit(1);
  }

  if (!websites || websites.length === 0) {
    console.log("[Schedule Alert] ✅ 沒有需要檢查的網站");
    return;
  }

  console.log(`[Schedule Alert] 📊 檢查 ${websites.length} 個網站...`);

  // 獲取所有相關公司的資訊（用於 owner_id 和 alerts_sent）
  const companyIds = [...new Set(websites.map((w) => w.company_id))];
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, owner_id, schedule_alerts_sent")
    .in("id", companyIds);

  if (companiesError) {
    console.error("[Schedule Alert] ❌ 查詢公司失敗:", companiesError);
    process.exit(1);
  }

  const companyMap = new Map<string, Company>(
    (companies || []).map((c) => [c.id, c as Company]),
  );

  const now = new Date();
  let alertsSentCount = 0;

  for (const website of websites as Website[]) {
    const company = companyMap.get(website.company_id);
    if (!company?.owner_id) {
      console.log(
        `[Schedule Alert] ⏭️ ${website.website_name}: 公司沒有 owner，跳過`,
      );
      continue;
    }

    // 查詢該網站最晚的排程文章日期（從 article_jobs 表查詢）
    const { data: latestJob } = await supabase
      .from("article_jobs")
      .select("scheduled_publish_at")
      .eq("website_id", website.id)
      .eq("status", "scheduled")
      .gte("scheduled_publish_at", now.toISOString())
      .order("scheduled_publish_at", { ascending: false })
      .limit(1)
      .single();

    const latestDate = latestJob?.scheduled_publish_at
      ? new Date(latestJob.scheduled_publish_at)
      : null;

    // 計算還剩幾天
    const daysUntilEmpty = latestDate
      ? Math.ceil(
          (latestDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;

    console.log(
      `[Schedule Alert] 📝 ${website.website_name}: 還有 ${daysUntilEmpty} 天排程`,
    );

    // 檢查每個警告級別
    const alertsSent =
      (company.schedule_alerts_sent as Record<string, string>) || {};

    for (const level of ALERT_LEVELS) {
      if (daysUntilEmpty <= level.days) {
        // 使用 website_id + level 作為 key
        const alertKey = `${website.id}_${level.key}`;

        // 檢查是否已發送過
        const lastSent = alertsSent[alertKey];
        if (lastSent) {
          console.log(
            `[Schedule Alert] ⏭️ ${website.website_name} 的 ${level.days}天警告已於 ${lastSent} 發送過，跳過`,
          );
          continue;
        }

        // 獲取用戶 email
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(company.owner_id);

        if (userError || !userData?.user?.email) {
          console.error(
            `[Schedule Alert] ⚠️ 無法獲取 ${website.website_name} 擁有者的 email`,
          );
          continue;
        }

        const email = userData.user.email;

        // 發送郵件
        console.log(
          `[Schedule Alert] 📧 發送 ${level.days}天警告給 ${website.website_name} (${email})...`,
        );

        const success = await sendScheduleAlertEmail({
          to: email,
          websiteName: website.website_name,
          daysRemaining: Math.max(daysUntilEmpty, 0),
          alertLevel: level.days as 7 | 3 | 1,
        });

        if (success) {
          // 更新已發送記錄
          const updatedAlerts = {
            ...alertsSent,
            [alertKey]: now.toISOString(),
          };

          await supabase
            .from("companies")
            .update({ schedule_alerts_sent: updatedAlerts })
            .eq("id", company.id);

          // 更新本地 map 以便後續網站使用
          company.schedule_alerts_sent = updatedAlerts;

          console.log(
            `[Schedule Alert] ✅ ${website.website_name} 的 ${level.days}天警告已發送`,
          );
          alertsSentCount++;
        } else {
          console.error(
            `[Schedule Alert] ❌ ${website.website_name} 的 ${level.days}天警告發送失敗`,
          );
        }

        // 只發送最緊急的警告級別，不發多個
        break;
      }
    }
  }

  console.log(`[Schedule Alert] 📊 總共發送 ${alertsSentCount} 封警告郵件`);
  console.log("[Schedule Alert] 🎉 檢查完成");
}

main().catch((err) => {
  console.error("[Schedule Alert] ❌ Fatal error:", err);
  process.exit(1);
});
