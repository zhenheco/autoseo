"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MobileNav } from "./mobile-nav";
import { UILanguageSelector } from "@/components/common/UILanguageSelector";
import { useTranslations } from "next-intl";

export function Navbar() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 md:h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="1waySEO Logo"
            width={32}
            height={32}
            className="w-7 h-7 md:w-8 md:h-8"
          />
          <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-brand-blue-500 via-brand-cyan-500 to-brand-orange-500 bg-clip-text text-transparent">
            1waySEO
          </span>
        </Link>

        {/* 桌面版導航 */}
        <div className="hidden md:flex items-center gap-4">
          <UILanguageSelector />
          <Link
            href="/blog"
            className="text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            {t("blog")}
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            {t("login")}
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-gradient-to-r from-brand-blue-500 via-brand-cyan-500 to-brand-orange-500 px-4 py-2 text-sm font-medium text-white hover:from-brand-blue-600 hover:via-brand-cyan-600 hover:to-brand-orange-600 shadow-md transition-all"
          >
            {t("signup")}
          </Link>
          <ThemeToggle />
        </div>

        {/* 手機版導航 */}
        <MobileNav />
      </div>
    </header>
  );
}
