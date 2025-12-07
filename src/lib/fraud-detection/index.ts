/**
 * 推薦系統反詐騙主服務
 * 整合所有偵測邏輯，建立可疑記錄
 */

import { createClient } from "@/lib/supabase/server";
import type {
  FraudCheckResult,
  FraudSuspicion,
  SeverityLevel,
  SuspicionEvidence,
  SuspicionType,
} from "@/types/fraud.types";
import {
  checkSameDeviceAccounts,
  checkSameDeviceInReferralChain,
  saveDeviceFingerprint,
} from "./same-device";
import { checkReferralLoop, checkReferralLoopFallback } from "./referral-loop";
import { checkAbnormalPatterns, checkSameIpReferrals } from "./patterns";

export interface FraudCheckParams {
  referralId?: string;
  referrerCompanyId: string;
  referredCompanyId: string;
  fingerprintHash?: string;
  ipAddress?: string;
}

/**
 * 執行完整的詐騙檢查
 */
export async function performFraudCheck(
  params: FraudCheckParams,
): Promise<FraudCheckResult> {
  const result: FraudCheckResult = {
    isSuspicious: false,
    suspicions: [],
  };

  const checks = [];

  // 1. 同裝置偵測
  if (params.fingerprintHash) {
    checks.push(
      checkSameDeviceAccounts(
        params.fingerprintHash,
        params.referredCompanyId,
      ).then(async (deviceCheck) => {
        if (deviceCheck.isSuspicious) {
          // 額外檢查：推薦人和被推薦人是否在同一裝置
          const sameDeviceInChain = await checkSameDeviceInReferralChain(
            params.fingerprintHash!,
            params.referrerCompanyId,
            params.referredCompanyId,
          );

          const severity: SeverityLevel = sameDeviceInChain
            ? "critical"
            : deviceCheck.severity;

          result.suspicions.push({
            type: "same_device",
            severity,
            evidence: {
              fingerprint_hash: deviceCheck.fingerprintHash,
              related_accounts: deviceCheck.relatedAccounts,
              account_count: deviceCheck.accountCount,
              detection_time: new Date().toISOString(),
            },
          });
        }
      }),
    );
  }

  // 2. 推薦環路偵測
  checks.push(
    checkReferralLoop(params.referrerCompanyId, params.referredCompanyId)
      .catch(() =>
        checkReferralLoopFallback(
          params.referrerCompanyId,
          params.referredCompanyId,
        ),
      )
      .then((loopCheck) => {
        if (loopCheck.isLoop) {
          result.suspicions.push({
            type: "referral_loop",
            severity: "high",
            evidence: {
              loop_chain: loopCheck.loopChain,
              loop_length: loopCheck.loopLength,
              detection_time: new Date().toISOString(),
            },
          });
        }
      }),
  );

  // 3. 異常模式偵測
  checks.push(
    checkAbnormalPatterns(params.referrerCompanyId).then((patternCheck) => {
      if (patternCheck.rapidReferrals) {
        result.suspicions.push({
          type: "rapid_referrals",
          severity:
            patternCheck.referralCount && patternCheck.referralCount > 10
              ? "high"
              : "medium",
          evidence: {
            referral_count: patternCheck.referralCount,
            time_window_hours: 24,
            detection_time: new Date().toISOString(),
            ...patternCheck.details,
          },
        });
      }

      if (patternCheck.quickCancellations) {
        result.suspicions.push({
          type: "quick_cancel",
          severity:
            patternCheck.cancelCount && patternCheck.cancelCount > 3
              ? "high"
              : "medium",
          evidence: {
            cancel_count: patternCheck.cancelCount,
            cancel_within_days: 7,
            detection_time: new Date().toISOString(),
            ...patternCheck.details,
          },
        });
      }
    }),
  );

  // 4. 同 IP 偵測（附加資訊）
  if (params.ipAddress) {
    checks.push(
      checkSameIpReferrals(params.referrerCompanyId, params.ipAddress).then(
        (ipCheck) => {
          if (ipCheck.isSuspicious) {
            // 將 IP 資訊附加到現有的 suspicion 中，或作為額外標記
            result.suspicions.forEach((s) => {
              s.evidence.ip_address = params.ipAddress;
            });
          }
        },
      ),
    );
  }

  // 等待所有檢查完成
  await Promise.all(checks);

  // 設定最終結果
  result.isSuspicious = result.suspicions.length > 0;

  return result;
}

/**
 * 建立可疑推薦記錄
 */
export async function createSuspiciousReferral(
  params: FraudCheckParams,
  suspicion: FraudSuspicion,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("suspicious_referrals")
    .insert({
      referral_id: params.referralId || null,
      referrer_company_id: params.referrerCompanyId,
      referred_company_id: params.referredCompanyId,
      suspicion_type: suspicion.type,
      severity: suspicion.severity,
      evidence: suspicion.evidence,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("建立可疑記錄失敗:", error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

/**
 * 執行詐騙檢查並記錄可疑行為（非阻塞）
 */
export async function performFraudCheckAndRecord(
  params: FraudCheckParams,
): Promise<void> {
  try {
    // 1. 儲存指紋
    if (params.fingerprintHash) {
      await saveDeviceFingerprint(
        params.fingerprintHash,
        params.referredCompanyId,
      );
    }

    // 2. 執行詐騙檢查
    const result = await performFraudCheck(params);

    // 3. 記錄所有可疑行為
    if (result.isSuspicious) {
      for (const suspicion of result.suspicions) {
        await createSuspiciousReferral(params, suspicion);
      }

      console.log(
        `[詐騙偵測] 發現 ${result.suspicions.length} 個可疑行為:`,
        result.suspicions.map((s) => `${s.type} (${s.severity})`),
      );
    }
  } catch (error) {
    console.error("[詐騙偵測] 執行失敗:", error);
    // 不拋出錯誤，避免影響正常流程
  }
}

// 重新導出子模組
export { saveDeviceFingerprint } from "./same-device";
export { checkReferralLoop } from "./referral-loop";
export { checkAbnormalPatterns } from "./patterns";
