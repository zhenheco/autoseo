"use client";

/**
 * 裝置指紋收集元件
 * 在頁面載入時自動收集指紋並儲存
 */

import { useEffect, useRef } from "react";
import { collectAndStoreFingerprint } from "@/lib/fingerprint/client";

interface FingerprintCollectorProps {
  /** 收集完成後的回調 */
  onCollected?: (fingerprint: string) => void;
  /** 是否同時提交到後端 */
  autoSubmit?: boolean;
  /** 關聯的推薦碼 */
  referralCode?: string;
  /** 事件類型 */
  eventType?: "click" | "register" | "login";
}

export function FingerprintCollector({
  onCollected,
  autoSubmit = false,
  referralCode,
  eventType = "login",
}: FingerprintCollectorProps) {
  const hasCollected = useRef(false);

  useEffect(() => {
    // 避免重複收集
    if (hasCollected.current) return;
    hasCollected.current = true;

    async function collect() {
      try {
        const fingerprint = await collectAndStoreFingerprint();

        if (onCollected) {
          onCollected(fingerprint);
        }

        // 如果需要自動提交到後端
        if (autoSubmit) {
          await fetch("/api/fingerprint/submit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fingerprint_hash: fingerprint,
              referral_code: referralCode,
              event_type: eventType,
            }),
          });
        }
      } catch (error) {
        console.error("指紋收集失敗:", error);
      }
    }

    collect();
  }, [onCollected, autoSubmit, referralCode, eventType]);

  // 這是一個不可見的元件
  return null;
}
