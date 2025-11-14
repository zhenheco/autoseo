'use client'

import { useMemo } from 'react'
import { sanitizeArticleHtml } from '@/lib/security/html-sanitizer'

interface ArticleHtmlPreviewProps {
  htmlContent: string
  className?: string
}

export function ArticleHtmlPreview({ htmlContent, className = 'prose prose-sm max-w-none' }: ArticleHtmlPreviewProps) {
  const sanitizedHTML = useMemo(
    () => sanitizeArticleHtml(htmlContent),
    [htmlContent]
  )

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}
