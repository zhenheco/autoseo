"use client";

import { useMemo } from "react";
import { sanitizeArticleHtml } from "@/lib/security/html-sanitizer";

interface ArticleHtmlPreviewProps {
  htmlContent: string;
  className?: string;
}

export function ArticleHtmlPreview({
  htmlContent,
  className = "prose prose-sm max-w-none leading-relaxed",
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
