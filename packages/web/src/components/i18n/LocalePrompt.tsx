"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UI_LOCALES } from "@/lib/i18n/locales";
import { setUILocale } from "@/lib/i18n/config";
import {
  detectUserRegion,
  getRecommendedLocaleByCountry,
  shouldShowLocalePrompt,
} from "@/lib/i18n/locale-detection";

interface LocalePromptProps {
  currentLocale: string;
}

export function LocalePrompt({ currentLocale }: LocalePromptProps) {
  const t = useTranslations("common");
  const [show, setShow] = useState(false);
  const [recommendedLocale, setRecommendedLocale] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkLocalePrompt() {
      try {
        // 檢查是否已經顯示過提示
        const hasShownKey = "locale-prompt-shown";
        const hasShown = localStorage.getItem(hasShownKey) === "true";

        if (hasShown) {
          setLoading(false);
          return;
        }

        // 檢測用戶地區
        const countryCode = await detectUserRegion();
        if (!countryCode) {
          setLoading(false);
          return;
        }

        // 取得推薦語系
        const recommended = getRecommendedLocaleByCountry(countryCode);

        // 判斷是否需要顯示提示
        if (
          shouldShowLocalePrompt({
            detectedLocale: recommended,
            currentLocale,
            hasShownPrompt: hasShown,
          })
        ) {
          setRecommendedLocale(recommended);
          setShow(true);
        }
      } catch (error) {
        console.warn("[LocalePrompt] Failed to check locale:", error);
      } finally {
        setLoading(false);
      }
    }

    checkLocalePrompt();
  }, [currentLocale]);

  const handleAccept = () => {
    if (recommendedLocale) {
      setUILocale(recommendedLocale);
      localStorage.setItem("locale-prompt-shown", "true");
      setShow(false);
      // 重新載入頁面以套用新語系
      window.location.reload();
    }
  };

  const handleDecline = () => {
    localStorage.setItem("locale-prompt-shown", "true");
    setShow(false);
  };

  if (loading || !show || !recommendedLocale) {
    return null;
  }

  const recommendedLanguage = UI_LOCALES.find(
    (l) => l.code === recommendedLocale,
  );
  if (!recommendedLanguage) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4">
      <Card className="p-4 bg-background/95 backdrop-blur-md border-2 border-primary/20 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full">
            <Globe className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-medium text-sm mb-1">
                {t("localePromptTitle", {
                  locale: recommendedLanguage.name,
                })}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("localePromptDescription")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAccept}
                size="sm"
                className="flex-1 h-8 text-xs"
              >
                {recommendedLanguage.flag} {t("switchTo")}{" "}
                {recommendedLanguage.name}
              </Button>

              <Button
                onClick={handleDecline}
                variant="outline"
                size="sm"
                className="px-3 h-8"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
