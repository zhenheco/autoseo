"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CategoryCount } from "@/types/blog";

interface CategoryListProps {
  categories: CategoryCount[];
  className?: string;
}

/**
 * 分類列表組件
 * 用於側邊欄顯示所有分類
 */
export function CategoryList({
  categories,
  className = "",
}: CategoryListProps) {
  const pathname = usePathname();
  const t = useTranslations("blog");

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <FolderOpen className="h-5 w-5" />
        {t("categoriesTitle")}
      </h3>
      <nav className="space-y-1">
        <Link
          href="/blog"
          className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
            pathname === "/blog" && "bg-muted font-medium",
          )}
        >
          <span>{t("allArticles")}</span>
        </Link>
        {categories.map((category) => {
          const href = `/blog/category/${encodeURIComponent(category.name)}`;
          const isActive = pathname === href;

          return (
            <Link
              key={category.name}
              href={href}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
                isActive && "bg-muted font-medium",
              )}
            >
              <span>{category.name}</span>
              <span className="rounded-full bg-muted-foreground/10 px-2 py-0.5 text-xs text-muted-foreground">
                {category.count}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
