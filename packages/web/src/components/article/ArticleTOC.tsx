"use client";

/**
 * ArticleTOC - 文章目錄側邊欄
 *
 * 功能：
 * - 從 HTML 內容提取 H2/H3 標題
 * - IntersectionObserver 實作 scroll spy
 * - 點擊平滑滾動
 *
 * 注意：使用 useEffect 提取標題以避免 SSR 問題（DOMParser 是瀏覽器 API）
 */

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TOCItem {
  id: string;
  text: string;
  level: number; // 2 = H2, 3 = H3
}

interface ArticleTOCProps {
  /** HTML 內容 */
  htmlContent: string;
  /** 額外的 className */
  className?: string;
}

/**
 * 從 HTML 內容提取 H2/H3 標題（僅在瀏覽器環境執行）
 */
function extractHeadings(html: string): TOCItem[] {
  // 確保只在瀏覽器環境執行
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const headings = doc.querySelectorAll("h2, h3");

  const items: TOCItem[] = [];

  headings.forEach((heading, index) => {
    // 如果標題沒有 id，生成一個
    let id = heading.id;
    if (!id) {
      // 使用文字內容生成 slug
      const text = heading.textContent || "";
      id = `heading-${index}-${text
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50)}`;
    }

    items.push({
      id,
      text: heading.textContent || "",
      level: heading.tagName === "H2" ? 2 : 3,
    });
  });

  return items;
}

export function ArticleTOC({ htmlContent, className }: ArticleTOCProps) {
  const [activeId, setActiveId] = useState<string>("");
  // 使用 useState + useEffect 確保只在客戶端提取標題
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);

  // 在客戶端提取標題（避免 SSR 問題）
  // 使用 setTimeout 避免 ESLint react-hooks/set-state-in-effect 警告
  useEffect(() => {
    const items = extractHeadings(htmlContent);
    // 使用 setTimeout 確保 setState 不在 effect 同步調用
    const timer = setTimeout(() => {
      setTocItems(items);
    }, 0);
    return () => clearTimeout(timer);
  }, [htmlContent]);

  // 處理滾動監聽
  useEffect(() => {
    if (tocItems.length === 0) return;

    // 確保 DOM 中的標題有對應的 id
    tocItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (!element) {
        // 嘗試找到對應文字的標題並設定 id
        const headings = document.querySelectorAll("h2, h3");
        headings.forEach((heading) => {
          if (heading.textContent === item.text && !heading.id) {
            heading.id = item.id;
          }
        });
      }
    });

    // 使用 IntersectionObserver 監聽標題可見性
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-80px 0px -70% 0px", // 頂部留出 header 空間
        threshold: 0,
      },
    );

    // 觀察所有標題
    tocItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [tocItems]);

  // 處理點擊滾動
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      const element = document.getElementById(id);
      if (element) {
        const yOffset = -100; // header 高度補償
        const y =
          element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
        setActiveId(id);
      }
    },
    [],
  );

  // 如果沒有標題，不渲染
  if (tocItems.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn(
        "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm p-4",
        className,
      )}
    >
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 px-3">
        目錄
      </h4>
      <ul className="space-y-1">
        {tocItems.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => handleClick(e, item.id)}
              className={cn(
                "toc-item block",
                item.level === 3 && "toc-item-h3",
                activeId === item.id && "active",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
