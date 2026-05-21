"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

interface ViewCounterProps {
  articleId: string;
  initialViews?: number;
  className?: string;
}

/**
 * 閱讀計數器組件
 * 顯示並追蹤文章閱讀次數
 */
export function ViewCounter({
  articleId,
  initialViews = 0,
  className = "",
}: ViewCounterProps) {
  const [views, setViews] = useState(initialViews);
  const [hasTracked, setHasTracked] = useState(false);

  useEffect(() => {
    // 避免重複追蹤
    if (hasTracked) return;

    // 使用 sessionStorage 防止同一 session 重複計數
    const viewedKey = `blog_viewed_${articleId}`;
    const hasViewed = sessionStorage.getItem(viewedKey);

    if (hasViewed) {
      setTimeout(() => setHasTracked(true), 0);
      return;
    }

    // 記錄閱讀
    const trackView = async () => {
      try {
        const response = await fetch("/api/blog/views", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ articleId }),
        });

        if (response.ok) {
          const data = await response.json();
          setViews(data.totalViews);
          sessionStorage.setItem(viewedKey, "true");
        }
      } catch (error) {
        console.error("Failed to track view:", error);
      }

      setHasTracked(true);
    };

    // 延遲追蹤，確保用戶真的在閱讀
    const timer = setTimeout(trackView, 3000);

    return () => clearTimeout(timer);
  }, [articleId, hasTracked]);

  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <Eye className="h-4 w-4" />
      {views.toLocaleString()} 次閱讀
    </span>
  );
}
