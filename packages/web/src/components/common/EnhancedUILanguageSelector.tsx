"use client";

import { useSyncExternalStore, useCallback, useMemo } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  UI_LOCALES,
  DEFAULT_UI_LOCALE,
  UI_LOCALE_STORAGE_KEY,
  UI_LOCALE_COOKIE_KEY,
} from "@/lib/i18n/locales";
import { setUILocale } from "@/lib/i18n/config";
import { getLocaleDisplayName } from "@/lib/i18n/locale-detection";
import { useTranslations } from "next-intl";

// 從 cookie 讀取語系（SSR 安全）
function getLocaleFromCookie(): string {
  if (typeof document === "undefined") return DEFAULT_UI_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${UI_LOCALE_COOKIE_KEY}=([^;]*)`),
  );
  const cookieLocale = match ? decodeURIComponent(match[1]) : null;
  if (cookieLocale && UI_LOCALES.some((l) => l.code === cookieLocale)) {
    return cookieLocale;
  }
  return DEFAULT_UI_LOCALE;
}

// 使用 useSyncExternalStore 來同步 localStorage 狀態
function subscribeToLocale(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("uiLocaleChanged", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("uiLocaleChanged", callback);
  };
}

function getLocaleSnapshot(): string {
  const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  if (stored && UI_LOCALES.some((l) => l.code === stored)) {
    return stored;
  }
  return getLocaleFromCookie();
}

function getServerSnapshot(): string {
  return DEFAULT_UI_LOCALE;
}

type VariantType = "default" | "compact" | "icon-only";

interface EnhancedUILanguageSelectorProps {
  variant?: VariantType;
  showFlag?: boolean;
  showArrow?: boolean;
  className?: string;
}

export function EnhancedUILanguageSelector({
  variant = "default",
  showFlag = true,
  showArrow = true,
  className = "",
}: EnhancedUILanguageSelectorProps) {
  const t = useTranslations("common");

  // 使用 useSyncExternalStore 來避免 hydration mismatch 並即時同步
  const currentLocale = useSyncExternalStore(
    subscribeToLocale,
    getLocaleSnapshot,
    getServerSnapshot,
  );

  const handleLocaleChange = useCallback((locale: string) => {
    setUILocale(locale);
    // 發送自定義事件通知其他組件
    window.dispatchEvent(
      new CustomEvent("uiLocaleChanged", { detail: locale }),
    );
    // 強制重新載入頁面以套用新語系
    setTimeout(() => window.location.reload(), 100);
  }, []);

  const currentLanguage = UI_LOCALES.find((l) => l.code === currentLocale);
  const defaultLanguage = UI_LOCALES.find((l) => l.code === DEFAULT_UI_LOCALE)!;

  // Memoize 計算結果以提升效能
  const { buttonContent, buttonSize } = useMemo(() => {
    const language = currentLanguage ?? defaultLanguage;

    const getButtonContent = (): React.ReactNode => {
      switch (variant) {
        case "icon-only":
          return (
            <>
              <Globe className="h-4 w-4" />
              {showArrow && <ChevronDown className="h-3 w-3 opacity-50" />}
            </>
          );

        case "compact":
          return (
            <>
              <Globe className="h-4 w-4" />
              {showFlag && <span className="text-sm">{language.flag}</span>}
              {showArrow && <ChevronDown className="h-3 w-3 opacity-50" />}
            </>
          );

        default:
          return (
            <>
              <Globe className="h-4 w-4" />
              {showFlag && <span className="text-sm">{language.flag}</span>}
              <span
                className="hidden sm:inline text-sm font-medium"
                suppressHydrationWarning
              >
                {language.name}
              </span>
              {showArrow && <ChevronDown className="h-3 w-3 opacity-50" />}
            </>
          );
      }
    };

    const getButtonSize = (): string => {
      switch (variant) {
        case "icon-only":
          return "h-9 w-9 p-0";
        case "compact":
          return "h-9 px-2";
        default:
          return "h-9 px-3";
      }
    };

    return {
      buttonContent: getButtonContent(),
      buttonSize: getButtonSize(),
    };
  }, [variant, showFlag, showArrow, currentLanguage, defaultLanguage]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={[
            buttonSize,
            "gap-1.5",
            "hover:bg-accent",
            "transition-all",
            "duration-200",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={t("selectLanguage")}
        >
          {buttonContent}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 z-[60] p-1">
        {/* 標題 */}
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {t("selectLanguage")}
        </div>
        <DropdownMenuSeparator />

        {/* 語系選項 */}
        {UI_LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => handleLocaleChange(locale.code)}
            className={`
              cursor-pointer 
              px-2 py-2
              flex items-center gap-3
              transition-all duration-200
              ${
                currentLocale === locale.code
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent"
              }
            `}
          >
            <span className="text-base">{locale.flag}</span>
            <div className="flex-1">
              <div className="text-sm font-medium">{locale.name}</div>
              <div className="text-xs text-muted-foreground">
                {getLocaleDisplayName(locale.code)}
              </div>
            </div>
            {currentLocale === locale.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* 設定語系偏好的提示 */}
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {t("languagePreferenceSaved")}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
