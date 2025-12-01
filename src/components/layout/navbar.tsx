"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            1WaySEO
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            登入
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-cyber-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyber-violet-700 transition-colors"
          >
            免費開始
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
