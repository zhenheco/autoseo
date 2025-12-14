"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SupportedLocale, HreflangEntry } from "@/types/translations";
import { TRANSLATION_LANGUAGES } from "@/types/translations";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  currentLocale: SupportedLocale;
  translations: HreflangEntry[];
  className?: string;
}

/**
 * 語言切換器組件
 *
 * 顯示可用的語言版本，讓用戶切換閱讀不同語言的文章
 */
export function LanguageSwitcher({
  currentLocale,
  translations,
  className,
}: LanguageSwitcherProps) {
  const currentLanguage = TRANSLATION_LANGUAGES[currentLocale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Globe className="h-4 w-4" />
          <span>{currentLanguage?.flagEmoji}</span>
          <span className="hidden sm:inline">
            {currentLanguage?.nativeName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {translations.map((translation) => {
          const lang = TRANSLATION_LANGUAGES[translation.locale];
          const isActive = translation.locale === currentLocale;

          return (
            <DropdownMenuItem key={translation.locale} asChild>
              <Link
                href={translation.url}
                hrefLang={translation.locale}
                className={cn(
                  "flex items-center gap-2",
                  isActive && "bg-accent font-medium",
                )}
              >
                <span>{lang?.flagEmoji}</span>
                <span>{lang?.nativeName}</span>
                {isActive && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    ✓
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
