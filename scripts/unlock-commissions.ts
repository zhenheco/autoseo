import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("缺少必要的環境變數: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function unlockCommissions(): Promise<void> {
  console.log("[UnlockCommissions] 開始執行佣金解鎖任務...");
  const now = new Date().toISOString();

  const { data: lockedCommissions, error: fetchError } = await supabase
    .from("affiliate_commissions")
    .select("id, affiliate_id, net_commission")
    .eq("status", "locked")
    .lte("unlock_at", now);

  if (fetchError) {
    console.error("[UnlockCommissions] 查詢鎖定佣金失敗:", fetchError);
    process.exit(1);
  }

  if (!lockedCommissions || lockedCommissions.length === 0) {
    console.log("[UnlockCommissions] 沒有需要解鎖的佣金");
    return;
  }

  console.log(
    `[UnlockCommissions] 找到 ${lockedCommissions.length} 筆待解鎖佣金`,
  );

  const affiliateUpdates = new Map<string, number>();

  for (const commission of lockedCommissions) {
    const currentTotal = affiliateUpdates.get(commission.affiliate_id) || 0;
    affiliateUpdates.set(
      commission.affiliate_id,
      currentTotal + (commission.net_commission || 0),
    );
  }

  const commissionIds = lockedCommissions.map((c) => c.id);
  const { error: updateError } = await supabase
    .from("affiliate_commissions")
    .update({ status: "available" })
    .in("id", commissionIds);

  if (updateError) {
    console.error("[UnlockCommissions] 更新佣金狀態失敗:", updateError);
    process.exit(1);
  }

  for (const [affiliateId, unlockAmount] of affiliateUpdates) {
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("pending_commission, available_commission")
      .eq("id", affiliateId)
      .single();

    if (affiliate) {
      const { error: affiliateError } = await supabase
        .from("affiliates")
        .update({
          pending_commission:
            (affiliate.pending_commission || 0) - unlockAmount,
          available_commission:
            (affiliate.available_commission || 0) + unlockAmount,
        })
        .eq("id", affiliateId);

      if (affiliateError) {
        console.error(
          `[UnlockCommissions] 更新聯盟夥伴 ${affiliateId} 餘額失敗:`,
          affiliateError,
        );
      } else {
        console.log(
          `[UnlockCommissions] 聯盟夥伴 ${affiliateId} 解鎖 ${unlockAmount} 元`,
        );
      }
    }
  }

  console.log(
    `[UnlockCommissions] 完成！解鎖 ${lockedCommissions.length} 筆佣金`,
  );
}

unlockCommissions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[UnlockCommissions] 執行失敗:", error);
    process.exit(1);
  });
