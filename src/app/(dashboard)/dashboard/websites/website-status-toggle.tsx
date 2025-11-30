"use client";

import { useState, useTransition } from "react";
import { toggleWebsiteStatus } from "./actions";

interface WebsiteStatusToggleProps {
  websiteId: string;
  initialStatus: boolean;
}

export function WebsiteStatusToggle({
  websiteId,
  initialStatus,
}: WebsiteStatusToggleProps) {
  const [isActive, setIsActive] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    // 樂觀更新：立即更新 UI
    setIsActive(!isActive);

    // 後端處理
    startTransition(async () => {
      const formData = new FormData();
      formData.append("websiteId", websiteId);
      formData.append("currentStatus", String(isActive));

      try {
        await toggleWebsiteStatus(formData);
      } catch (error) {
        // 如果失敗，恢復原狀態
        setIsActive(isActive);
        console.error("切換狀態失敗:", error);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        isActive ? "bg-green-600" : "bg-muted"
      } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
      aria-label="切換網站狀態"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          isActive ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
