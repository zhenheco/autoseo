"use client";

import { useState, useEffect } from "react";
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
} from "@/lib/i18n/locales";
import { setUILocale } from "@/lib/i18n/config";

export function UILanguageSelector() {
  const [currentLocale, setCurrentLocale] = useState(DEFAULT_UI_LOCALE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
      const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
      if (stored && UI_LOCALES.some((l) => l.code === stored)) {
        setCurrentLocale(stored);
      }
    }, 0);
  }, []);

  const handleLocaleChange = (locale: string) => {
    setCurrentLocale(locale);
    setUILocale(locale);
    // 強制重新載入頁面以套用新語系
    window.location.reload();
  };

  const currentLanguage = UI_LOCALES.find((l) => l.code === currentLocale);

  // 避免 hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Globe className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">
            {currentLanguage?.flag} {currentLanguage?.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
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
