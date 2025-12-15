"use client";

import { useMemo } from "react";
import { sanitizeArticleHtml } from "@/lib/security/html-sanitizer";
import { cn } from "@/lib/utils";

interface ArticleHtmlPreviewProps {
  htmlContent: string;
  /** 精選圖片 URL，用於從內文中移除重複的封面圖 */
  featuredImageUrl?: string;
  className?: string;
}

/**
 * 為 HTML 中的標題添加 ID（供 TOC 使用）
 */
function addHeadingIds(html: string): string {
  // 使用正則表達式為 h2, h3 添加 id
  let headingIndex = 0;

  return html.replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag, attrs, content) => {
      // 如果已經有 id，跳過
      if (/\sid\s*=/.test(attrs)) {
        return match;
      }

      // 生成 id
      const text = content.replace(/<[^>]*>/g, "").trim();
      const id = `heading-${headingIndex}-${text
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50)}`;

      headingIndex++;

      return `<${tag}${attrs} id="${id}">${content}</${tag}>`;
    },
  );
}

/**
 * 從 HTML 內容中移除與精選圖片相同的圖片
 * 避免文章中重複顯示封面圖
 */
function removeFeaturedImage(html: string, featuredUrl?: string): string {
  if (!featuredUrl) return html;

  // 取得圖片的檔名部分（去除 query string 和 path）
  const getImageFilename = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return pathname.split("/").pop() || "";
    } catch {
      return url.split("/").pop()?.split("?")[0] || "";
    }
  };

  const featuredFilename = getImageFilename(featuredUrl);

  // 移除 src 包含相同檔名的圖片（包含整個 figure 或 img 標籤）
  // 先嘗試移除 figure 標籤（包含 figcaption）
  let result = html.replace(
    /<figure[^>]*>[\s\S]*?<img[^>]*src=["'][^"']*[/]?([^/"']+)["'][^>]*>[\s\S]*?<\/figure>/gi,
    (match, filename) => {
      if (filename === featuredFilename) {
        return "";
      }
      return match;
    },
  );

  // 再移除獨立的 img 標籤
  result = result.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*>/gi,
    (match, src) => {
      const imgFilename = getImageFilename(src);
      if (imgFilename === featuredFilename) {
        return "";
      }
      return match;
    },
  );

  return result;
}

/**
 * 文章 HTML 預覽元件
 *
 * todaymade.com 風格的 Typography 設定
 */
export function ArticleHtmlPreview({
  htmlContent,
  featuredImageUrl,
  className,
}: ArticleHtmlPreviewProps) {
  const processedHTML = useMemo(() => {
    const sanitized = sanitizeArticleHtml(htmlContent);
    const withoutFeatured = removeFeaturedImage(sanitized, featuredImageUrl);
    return addHeadingIds(withoutFeatured);
  }, [htmlContent, featuredImageUrl]);

  return (
    <div
      className={cn(
        "prose prose-lg max-w-none",
        // 基礎文字樣式（行距 1.9 更舒適閱讀）
        "prose-p:text-[18px] prose-p:leading-[1.9] prose-p:my-8",
        "prose-p:text-slate-700 dark:prose-p:text-slate-300",
        // H2: 28px, 半粗體
        "prose-h2:text-[28px] prose-h2:font-semibold prose-h2:mt-14 prose-h2:mb-5",
        "prose-h2:text-slate-900 dark:prose-h2:text-white prose-h2:scroll-mt-24",
        // H3: 22px, 半粗體
        "prose-h3:text-[22px] prose-h3:font-semibold prose-h3:mt-10 prose-h3:mb-4",
        "prose-h3:text-slate-800 dark:prose-h3:text-slate-100 prose-h3:scroll-mt-24",
        // H4
        "prose-h4:text-[18px] prose-h4:font-semibold prose-h4:mt-8 prose-h4:mb-3",
        "prose-h4:text-slate-800 dark:prose-h4:text-slate-200",
        // 圖片: 60% 寬度置中（精選圖片已在頁面頂部 100% 顯示）
        "prose-img:w-[60%] prose-img:mx-auto prose-img:my-12",
        "prose-img:rounded-[10px] prose-img:shadow-md",
        // 連結（藍色）
        "prose-a:text-blue-600 dark:prose-a:text-blue-400",
        "prose-a:underline prose-a:decoration-1",
        "prose-a:underline-offset-2 hover:prose-a:decoration-2",
        "hover:prose-a:text-blue-700 dark:hover:prose-a:text-blue-300",
        // 列表（行距同段落）
        "prose-li:text-[18px] prose-li:leading-[1.9] prose-li:my-2",
        "prose-li:text-slate-700 dark:prose-li:text-slate-300",
        "prose-ul:my-8 prose-ol:my-8",
        // 引用區塊
        "prose-blockquote:border-l-4 prose-blockquote:border-primary/50",
        "prose-blockquote:bg-slate-50 dark:prose-blockquote:bg-slate-800/50",
        "prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:my-6",
        "prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400",
        "prose-blockquote:not-italic",
        // 程式碼
        "prose-code:text-primary prose-code:bg-slate-100 dark:prose-code:bg-slate-800",
        "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[15px]",
        "prose-code:before:content-none prose-code:after:content-none",
        // 程式碼區塊
        "prose-pre:bg-slate-900 prose-pre:text-slate-100",
        "prose-pre:rounded-lg prose-pre:my-6",
        // 粗體
        "prose-strong:text-slate-900 dark:prose-strong:text-white",
        // 水平線
        "prose-hr:border-slate-200 dark:prose-hr:border-slate-700 prose-hr:my-8",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: processedHTML }}
    />
  );
}
