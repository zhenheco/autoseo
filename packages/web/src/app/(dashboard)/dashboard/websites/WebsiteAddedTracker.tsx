"use client";

import { useEffect, useRef } from "react";
import { trackFeatureUsage } from "@/lib/analytics/events";

interface WebsiteAddedTrackerProps {
  success?: string;
}

/**
 * 追蹤網站添加成功事件的客戶端組件
 * 當 URL 有 success 參數時，追蹤 GA4 事件
 */
export function WebsiteAddedTracker({ success }: WebsiteAddedTrackerProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    // 只有當 success 參數存在且尚未追蹤時才追蹤
    if (success && !hasTracked.current) {
      hasTracked.current = true;
      trackFeatureUsage("website_added", "create");
    }
  }, [success]);

  return null;
}
