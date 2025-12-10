"use client";

import { Button } from "@/components/ui/button";
import { useCookieConsent } from "./CookieConsentProvider";
import { Cookie, Settings, X } from "lucide-react";

/**
 * Cookie 同意橫幅
 * 顯示在頁面底部，讓用戶選擇 Cookie 偏好
 */
export function CookieConsentBanner() {
  const { acceptAll, rejectAll, openSettings } = useCookieConsent();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-background border-t shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* 圖示和內容 */}
            <div className="flex-1 flex gap-3">
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">
                  Cookie 使用通知
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  我們使用 Cookie
                  來提升您的瀏覽體驗、分析網站流量並提供個人化內容。
                  您可以選擇接受或管理您的偏好設定。
                  <button
                    onClick={openSettings}
                    className="text-primary hover:underline ml-1 inline-flex items-center gap-1"
                  >
                    了解更多
                    <Settings className="h-3 w-3" />
                  </button>
                </p>
              </div>
            </div>

            {/* 按鈕群組 */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={rejectAll}
                className="flex-1 md:flex-none"
              >
                <X className="h-4 w-4 mr-1" />
                僅必要
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openSettings}
                className="flex-1 md:flex-none"
              >
                <Settings className="h-4 w-4 mr-1" />
                管理偏好
              </Button>
              <Button
                size="sm"
                onClick={acceptAll}
                className="flex-1 md:flex-none"
              >
                接受全部
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
