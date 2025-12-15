/**
 * BlogHero - 部落格首頁 Hero 區塊
 *
 * 簡約風格設計，參考 todaymade.com
 */

import { cn } from "@/lib/utils";

interface BlogHeroProps {
  /** 主標題 */
  title: string;
  /** 副標題 */
  subtitle?: string;
  /** 額外的 className */
  className?: string;
}

export function BlogHero({ title, subtitle, className }: BlogHeroProps) {
  return (
    <section
      className={cn(
        "relative py-16 md:py-24 overflow-hidden",
        "bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950",
        className,
      )}
    >
      {/* 裝飾背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 漸層光暈 */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200/30 dark:bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* 裝飾線條 */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
          </div>

          {/* 主標題 */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
            {title}
          </h1>

          {/* 副標題 */}
          {subtitle && (
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
