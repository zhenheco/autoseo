/**
 * 推薦環路偵測
 * 檢測 A->B->C->A 這種循環推薦模式
 */

import { createClient } from "@/lib/supabase/server";
import type { ReferralLoopCheckResult } from "@/types/fraud.types";

/**
 * 檢查是否存在推薦環路
 * 使用 PostgreSQL 的 recursive CTE 來追蹤推薦鏈
 */
export async function checkReferralLoop(
  referrerCompanyId: string,
  referredCompanyId: string,
  maxDepth: number = 10,
): Promise<ReferralLoopCheckResult> {
  const supabase = await createClient();

  // 呼叫資料庫函數來檢查環路
  const { data, error } = await supabase.rpc("check_referral_loop", {
    p_referrer_company_id: referrerCompanyId,
    p_referred_company_id: referredCompanyId,
    p_max_depth: maxDepth,
  });

  if (error) {
    console.error("檢查推薦環路失敗:", error);
    return {
      isLoop: false,
      loopChain: [],
      loopLength: 0,
    };
  }

  // 資料庫函數返回的結果
  const result = data?.[0];

  if (!result) {
    return {
      isLoop: false,
      loopChain: [],
      loopLength: 0,
    };
  }

  return {
    isLoop: result.is_loop || false,
    loopChain: result.loop_chain || [],
    loopLength: result.loop_length || 0,
  };
}

/**
 * 使用純 JavaScript 的備用方法檢查環路
 * 如果資料庫函數不可用時使用
 */
export async function checkReferralLoopFallback(
  referrerCompanyId: string,
  referredCompanyId: string,
  maxDepth: number = 10,
): Promise<ReferralLoopCheckResult> {
  const supabase = await createClient();

  // 從被推薦人開始，往上追蹤推薦鏈
  const visited = new Set<string>();
  const chain: string[] = [referredCompanyId];
  let currentCompanyId = referredCompanyId;
  let depth = 0;

  while (depth < maxDepth) {
    // 查詢當前公司是誰推薦的
    const { data: referral } = await supabase
      .from("referrals")
      .select("referrer_company_id")
      .eq("referred_company_id", currentCompanyId)
      .single();

    if (!referral) {
      // 沒有推薦人了，結束追蹤
      break;
    }

    const referrer = referral.referrer_company_id;

    // 檢查是否形成環路
    if (referrer === referrerCompanyId) {
      // 找到環路！
      chain.push(referrer);
      return {
        isLoop: true,
        loopChain: chain,
        loopLength: chain.length,
      };
    }

    // 檢查是否重複訪問（內部環路）
    if (visited.has(referrer)) {
      break;
    }

    visited.add(referrer);
    chain.push(referrer);
    currentCompanyId = referrer;
    depth++;
  }

  return {
    isLoop: false,
    loopChain: [],
    loopLength: 0,
  };
}
