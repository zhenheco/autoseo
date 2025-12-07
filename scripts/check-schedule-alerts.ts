#!/usr/bin/env tsx

/**
 * 檢查排程文章不足，發送警告通知
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

type AlertLevel = (typeof ALERT_LEVELS)[number];

interface Company {
  id: string;
  name: string;
  owner_id: string | null;
  schedule_alerts_sent: Record<string, string> | null;
}

async function main() {
  console.log("[Schedule Alert] 🚀 開始檢查排程警告...");

  const supabaseUrl = process.env.SUPABASE_URL;
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

  // 查詢所有有 owner_id 的公司
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, owner_id, schedule_alerts_sent")
    .not("owner_id", "is", null);

  if (companiesError) {
    console.error("[Schedule Alert] ❌ 查詢公司失敗:", companiesError);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.log("[Schedule Alert] ✅ 沒有需要檢查的公司");
    return;
  }

  console.log(`[Schedule Alert] 📊 檢查 ${companies.length} 個公司...`);

  const now = new Date();
  let alertsSentCount = 0;

  for (const company of companies as Company[]) {
    if (!company.owner_id) continue;

    // 查詢該公司最晚的排程文章日期
    const { data: latestArticle } = await supabase
      .from("generated_articles")
      .select("scheduled_publish_at")
      .eq("company_id", company.id)
      .eq("status", "scheduled")
      .is("wordpress_post_id", null)
      .order("scheduled_publish_at", { ascending: false })
      .limit(1)
      .single();

    const latestDate = latestArticle?.scheduled_publish_at
      ? new Date(latestArticle.scheduled_publish_at)
      : null;

    // 計算還剩幾天
    const daysUntilEmpty = latestDate
      ? Math.ceil(
          (latestDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;

    console.log(
      `[Schedule Alert] 📝 ${company.name}: 還有 ${daysUntilEmpty} 天排程`,
    );

    // 檢查每個警告級別
    const alertsSent =
      (company.schedule_alerts_sent as Record<string, string>) || {};

    for (const level of ALERT_LEVELS) {
      if (daysUntilEmpty <= level.days) {
        // 檢查是否已發送過
        const lastSent = alertsSent[level.key];
        if (lastSent) {
          console.log(
            `[Schedule Alert] ⏭️ ${company.name} 的 ${level.days}天警告已於 ${lastSent} 發送過，跳過`,
          );
          continue;
        }

        // 獲取用戶 email
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(company.owner_id);

        if (userError || !userData?.user?.email) {
          console.error(
            `[Schedule Alert] ⚠️ 無法獲取 ${company.name} 擁有者的 email`,
          );
          continue;
        }

        const email = userData.user.email;

        // 發送郵件
        console.log(
          `[Schedule Alert] 📧 發送 ${level.days}天警告給 ${company.name} (${email})...`,
        );

        const success = await sendScheduleAlertEmail({
          to: email,
          companyName: company.name,
          daysRemaining: Math.max(daysUntilEmpty, 0),
          alertLevel: level.days as 7 | 3 | 1,
        });

        if (success) {
          // 更新已發送記錄
          const updatedAlerts = {
            ...alertsSent,
            [level.key]: now.toISOString(),
          };

          await supabase
            .from("companies")
            .update({ schedule_alerts_sent: updatedAlerts })
            .eq("id", company.id);

          console.log(
            `[Schedule Alert] ✅ ${company.name} 的 ${level.days}天警告已發送`,
          );
          alertsSentCount++;
        } else {
          console.error(
            `[Schedule Alert] ❌ ${company.name} 的 ${level.days}天警告發送失敗`,
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
