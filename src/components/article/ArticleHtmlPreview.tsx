"use client";

import { useMemo } from "react";
import { sanitizeArticleHtml } from "@/lib/security/html-sanitizer";

interface ArticleHtmlPreviewProps {
  htmlContent: string;
  className?: string;
}

export function ArticleHtmlPreview({
  htmlContent,
  className = "prose prose-lg max-w-none leading-relaxed " +
    "prose-p:leading-[1.8] prose-p:my-5 " +
    "prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-2xl prose-h2:font-bold " +
    "prose-h3:mt-7 prose-h3:mb-3 prose-h3:text-xl prose-h3:font-semibold " +
    "prose-li:my-2 prose-li:leading-[1.7] " +
    "prose-ul:my-6 prose-ol:my-6 " +
    "prose-img:my-8 prose-img:rounded-lg",
}: ArticleHtmlPreviewProps) {
  const sanitizedHTML = useMemo(
    () => sanitizeArticleHtml(htmlContent),
    [htmlContent],
  );

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      style={{
        ["--tw-prose-links" as string]: "#3b82f6",
        ["--tw-prose-links-hover" as string]: "#2563eb",
      }}
    />
  );
}
