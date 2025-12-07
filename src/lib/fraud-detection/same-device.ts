/**
 * 同裝置多帳號偵測
 */

import { createClient } from "@/lib/supabase/server";
import type { SameDeviceCheckResult, SeverityLevel } from "@/types/fraud.types";

/**
 * 檢查同裝置是否有多個帳號
 */
export async function checkSameDeviceAccounts(
  fingerprintHash: string,
  currentCompanyId: string,
): Promise<SameDeviceCheckResult> {
  const supabase = await createClient();

  // 查詢同指紋的所有帳號
  const { data, error } = await supabase
    .from("device_fingerprint_accounts")
    .select(
      `
      company_id,
      device_fingerprints!inner(fingerprint_hash)
    `,
    )
    .eq("device_fingerprints.fingerprint_hash", fingerprintHash);

  if (error) {
    console.error("查詢同裝置帳號失敗:", error);
    return {
      isSuspicious: false,
      accountCount: 1,
      relatedAccounts: [currentCompanyId],
      severity: "low",
      fingerprintHash,
    };
  }

  const relatedAccounts = data?.map((d) => d.company_id) || [];

  // 確保當前帳號在列表中
  if (!relatedAccounts.includes(currentCompanyId)) {
    relatedAccounts.push(currentCompanyId);
  }

  const accountCount = relatedAccounts.length;

  // 判斷嚴重程度
  let severity: SeverityLevel = "low";
  let isSuspicious = false;

  if (accountCount === 2) {
    severity = "low";
    isSuspicious = true;
  } else if (accountCount >= 3 && accountCount <= 4) {
    severity = "medium";
    isSuspicious = true;
  } else if (accountCount >= 5) {
    severity = "high";
    isSuspicious = true;
  }

  return {
    isSuspicious,
    accountCount,
    relatedAccounts,
    severity,
    fingerprintHash,
  };
}

/**
 * 儲存裝置指紋與帳號關聯
 */
export async function saveDeviceFingerprint(
  fingerprintHash: string,
  companyId: string,
): Promise<{ success: boolean; fingerprintId?: string; error?: string }> {
  const supabase = await createClient();

  // 先查找或創建指紋記錄
  let fingerprintId: string;

  const { data: existingFingerprint } = await supabase
    .from("device_fingerprints")
    .select("id")
    .eq("fingerprint_hash", fingerprintHash)
    .single();

  if (existingFingerprint) {
    fingerprintId = existingFingerprint.id;

    // 更新 last_seen_at
    await supabase
      .from("device_fingerprints")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", fingerprintId);
  } else {
    // 創建新的指紋記錄
    const { data: newFingerprint, error: createError } = await supabase
      .from("device_fingerprints")
      .insert({
        fingerprint_hash: fingerprintHash,
      })
      .select("id")
      .single();

    if (createError || !newFingerprint) {
      return {
        success: false,
        error: createError?.message || "創建指紋記錄失敗",
      };
    }

    fingerprintId = newFingerprint.id;
  }

  // 創建或更新帳號關聯
  const { error: linkError } = await supabase
    .from("device_fingerprint_accounts")
    .upsert(
      {
        fingerprint_id: fingerprintId,
        company_id: companyId,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: "fingerprint_id,company_id",
      },
    );

  if (linkError) {
    return { success: false, error: linkError.message };
  }

  // 更新指紋的帳號總數
  const { count } = await supabase
    .from("device_fingerprint_accounts")
    .select("*", { count: "exact", head: true })
    .eq("fingerprint_id", fingerprintId);

  await supabase
    .from("device_fingerprints")
    .update({ total_accounts: count || 1 })
    .eq("id", fingerprintId);

  return { success: true, fingerprintId };
}

/**
 * 檢查同裝置帳號是否在推薦鏈中
 * 如果同裝置帳號互相推薦，則為 critical
 */
export async function checkSameDeviceInReferralChain(
  fingerprintHash: string,
  referrerCompanyId: string,
  referredCompanyId: string,
): Promise<boolean> {
  const supabase = await createClient();

  // 查詢同指紋的所有帳號
  const { data } = await supabase
    .from("device_fingerprint_accounts")
    .select(
      `
      company_id,
      device_fingerprints!inner(fingerprint_hash)
    `,
    )
    .eq("device_fingerprints.fingerprint_hash", fingerprintHash);

  if (!data || data.length === 0) {
    return false;
  }

  const sameDeviceAccounts = data.map((d) => d.company_id);

  // 如果推薦人和被推薦人都在同一裝置上，這是 critical
  const bothOnSameDevice =
    sameDeviceAccounts.includes(referrerCompanyId) &&
    sameDeviceAccounts.includes(referredCompanyId);

  return bothOnSameDevice;
}
