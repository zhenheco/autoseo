/**
 * 文章同步工具函數
 */

/**
 * 從 HTML 內容中提取第一張圖片的 URL
 * 忽略 data URI 格式的圖片
 *
 * @param htmlContent HTML 內容字串
 * @returns 第一張圖片的 URL，若無則返回 null
 */
export function extractFirstImageUrl(htmlContent: string | null): string | null {
  if (!htmlContent) return null

  // 匹配 <img> 標籤中的 src 屬性
  // 支援雙引號、單引號、無引號三種格式
  const imgRegex = /<img[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi

  let match: RegExpExecArray | null
  // 使用 RegExp.prototype.exec 方法遍歷所有匹配
  while ((match = imgRegex['exec'](htmlContent)) !== null) {
    // 取得匹配到的 src 值（三種格式之一）
    const src = match[1] || match[2] || match[3]

    // 跳過 data URI
    if (src && !src.startsWith('data:')) {
      return src
    }
  }

  return null
}

/**
 * 從 img 標籤提取 alt 屬性
 *
 * @param htmlContent HTML 內容字串
 * @param imgSrc 目標圖片的 src（用於找到對應的 alt）
 * @returns alt 文字，若無則返回 null
 */
export function extractImageAlt(
  htmlContent: string | null,
  imgSrc: string | null
): string | null {
  if (!htmlContent || !imgSrc) return null

  // 尋找包含指定 src 的 img 標籤
  const escapedSrc = imgSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const imgRegex = new RegExp(
    `<img[^>]+src\\s*=\\s*["']?${escapedSrc}["']?[^>]*alt\\s*=\\s*["']([^"']*)["'][^>]*>`,
    'i'
  )

  const match = htmlContent.match(imgRegex)
  return match ? match[1] : null
}
