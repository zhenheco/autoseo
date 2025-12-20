"use client";

/**
 * BlogHeader - Blog 頁面頂部導覽列
 *
 * 包含 Logo、語言選擇器（支援 18 語系）
 */

import Link from "next/link";
import Image from "next/image";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SupportedLocale } from "@/types/translations";
import { TRANSLATION_LANGUAGES } from "@/types/translations";
import { generateBlogHreflangAlternates } from "@/lib/i18n/blog-meta";
import { cn } from "@/lib/utils";

interface BlogHeaderProps {
  /** 當前語系 */
  currentLocale?: SupportedLocale;
  /** 頁面標題 */
  title?: string;
  /** 頁面副標題 */
  subtitle?: string;
  className?: string;
}

/**
 * 支援的所有語系（用於語言選擇器）
 */
const ALL_LOCALES: SupportedLocale[] = [
  "zh-TW",
  "zh-CN",
  "en-US",
  "ja-JP",
  "ko-KR",
  "vi-VN",
  "ms-MY",
  "th-TH",
  "id-ID",
  "tl-PH",
  "fr-FR",
  "de-DE",
  "es-ES",
  "pt-PT",
  "it-IT",
  "ru-RU",
  "ar-SA",
  "hi-IN",
];

export function BlogHeader({
  currentLocale = "zh-TW",
  title,
  subtitle,
  className,
}: BlogHeaderProps) {
  const currentLanguage = TRANSLATION_LANGUAGES[currentLocale];
  const alternates = generateBlogHreflangAlternates();

  return (
    <>
      {/* Sticky 導覽列 */}
      <header
        className={cn(
          "sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800",
          className,
        )}
      >
        <nav className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo / 返回首頁 */}
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/1waySEO_logo-LR.svg"
              alt="1waySEO"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          </Link>

          {/* 右側工具 */}
          <div className="flex items-center gap-3">
            {/* Blog 連結 */}
            <Link
              href="/blog"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Blog
            </Link>

            {/* 語言選擇器 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-200 dark:border-slate-700"
                >
                  <Globe className="h-4 w-4" />
                  <span>{currentLanguage?.flagEmoji}</span>
                  <span className="hidden sm:inline">
                    {currentLanguage?.nativeName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-80 overflow-y-auto"
              >
                {ALL_LOCALES.map((locale) => {
                  const lang = TRANSLATION_LANGUAGES[locale];
                  const isActive = locale === currentLocale;
                  const url = alternates[locale];

                  return (
                    <DropdownMenuItem key={locale} asChild>
                      <Link
                        href={url}
                        hrefLang={locale}
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
          </div>
        </nav>
      </header>

      {/* 頁面標題區（非 sticky）*/}
      {(title || subtitle) && (
        <div className="text-center py-12 px-4">
          {title && (
            <h1 className="mb-3 text-3xl font-bold text-slate-900 dark:text-white md:text-4xl lg:text-5xl">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </>
  );
}
