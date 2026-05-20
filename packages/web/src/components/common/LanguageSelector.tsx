"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Languages } from "lucide-react";
import {
  ARTICLE_LOCALES,
  ARTICLE_LOCALE_STORAGE_KEY,
} from "@/lib/i18n/locales";

export function LanguageSelector() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("zh-TW");

  useEffect(() => {
    const stored = localStorage.getItem(ARTICLE_LOCALE_STORAGE_KEY);
    if (stored) {
      setTimeout(() => {
        setSelectedLanguage(stored);
      }, 0);
    }
  }, []);

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
    localStorage.setItem(ARTICLE_LOCALE_STORAGE_KEY, value);

    window.dispatchEvent(new CustomEvent("languageChanged", { detail: value }));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        撰寫語系
      </span>
      <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="h-9 w-[180px] gap-2 border-border bg-background">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ARTICLE_LOCALES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <div className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
