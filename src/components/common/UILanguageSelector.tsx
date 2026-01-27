"use client";

import { useSyncExternalStore } from "react";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  UI_LOCALES,
  DEFAULT_UI_LOCALE,
  UI_LOCALE_STORAGE_KEY,
  UI_LOCALE_COOKIE_KEY,
} from "@/lib/i18n/locales";
import { setUILocale } from "@/lib/i18n/config";

// 從 cookie 讀取語系（SSR 安全）
function getLocaleFromCookie(): string {
  if (typeof document === "undefined") return DEFAULT_UI_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${UI_LOCALE_COOKIE_KEY}=([^;]*)`)
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

export function UILanguageSelector() {
  // 使用 useSyncExternalStore 來避免 hydration mismatch 並即時同步
  const currentLocale = useSyncExternalStore(
    subscribeToLocale,
    getLocaleSnapshot,
    getServerSnapshot
  );

  const handleLocaleChange = (locale: string) => {
    setUILocale(locale);
    // 強制重新載入頁面以套用新語系
    window.location.reload();
  };

  const currentLanguage = UI_LOCALES.find((l) => l.code === currentLocale);
  const defaultLanguage = UI_LOCALES.find(
    (l) => l.code === DEFAULT_UI_LOCALE
  )!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
          <Globe className="h-4 w-4" />
          {/* 預設顯示預設語系，hydration 後立即更新 */}
          <span
            className="hidden sm:inline text-sm"
            suppressHydrationWarning
          >
            {currentLanguage?.flag ?? defaultLanguage.flag}{" "}
            {currentLanguage?.name ?? defaultLanguage.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-50">
        {UI_LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => handleLocaleChange(locale.code)}
            className={`cursor-pointer ${
              currentLocale === locale.code ? "bg-accent" : ""
            }`}
          >
            <span className="mr-2">{locale.flag}</span>
            <span>{locale.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
