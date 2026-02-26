"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MobileNav } from "./mobile-nav";
import { EnhancedUILanguageSelector } from "@/components/common/EnhancedUILanguageSelector";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ResponsiveLayout } from "./responsive-layout";

// 常數定義
const SCROLL_THRESHOLD = 20;
const NAV_STYLES = {
  scrolled: "glass-navbar border-b border-primary/20 shadow-lg",
  transparent: "bg-transparent border-b border-transparent backdrop-blur-sm",
} as const;

export function Navbar() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback(() => {
    const isScrolled = window.scrollY > SCROLL_THRESHOLD;
    if (isScrolled !== scrolled) {
      setScrolled(isScrolled);
    }
  }, [scrolled]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const navbarClassName = useMemo(
    () =>
      [
        `fixed top-0 z-50 w-full transition-all duration-300`,
        scrolled ? NAV_STYLES.scrolled : NAV_STYLES.transparent,
      ].join(" "),
    [scrolled],
  );

  return (
    <ResponsiveLayout as="header" className={navbarClassName}>
      <div className="container mx-auto flex h-16 md:h-18 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
        >
          <Image
            src="/1waySEO_logo-LR.svg"
            alt="1waySEO"
            width={140}
            height={36}
            className="h-8 md:h-9 w-auto brightness-0 invert"
            priority
          />
        </Link>

        {/* 桌面版導航 */}
        <div className="hidden md:flex items-center gap-6">
          <EnhancedUILanguageSelector />

          <Link
            href="/blog"
            className="text-sm font-medium text-mp-text-secondary hover:text-mp-text transition-colors duration-200 relative group"
          >
            {t("blog")}
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-mp-primary transition-all duration-300 group-hover:w-full" />
          </Link>

          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-mp-text-secondary hover:text-mp-text border border-mp-surface hover:border-mp-primary/50 rounded-xl backdrop-blur-sm transition-all duration-200 hover:bg-mp-surface/30"
          >
            {t("login")}
          </Link>

          <Link
            href="/signup"
            className="group relative px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-mp-primary to-mp-accent hover:from-mp-primary/90 hover:to-mp-accent/90 rounded-xl shadow-lg shadow-mp-primary/25 hover:shadow-xl hover:shadow-mp-primary/30 transition-all duration-200 hover:-translate-y-0.5"
          >
            {t("signup")}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-mp-primary/20 to-mp-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </Link>

          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>

        {/* 手機版導航 */}
        <MobileNav />
      </div>
    </ResponsiveLayout>
  );
}
