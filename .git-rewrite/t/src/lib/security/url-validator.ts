/**
 * URL 驗證工具
 * 防止開放重定向 (Open Redirect) 攻擊
 */

/**
 * 允許的域名白名單
 * 包含本地開發和生產環境的域名
 */
const ALLOWED_DOMAINS = [
  // 本地開發
  'localhost',
  '127.0.0.1',

  // 生產環境 (請根據實際情況修改)
  'your-domain.com',
  'www.your-domain.com',

  // Vercel 預覽域名 (可選)
  '.vercel.app',
]

/**
 * 允許的 URL 協議
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * 驗證 URL 是否在白名單中
 *
 * @param url - 要驗證的 URL
 * @returns 是否為安全的重定向 URL
 */
export function validateRedirectUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    // 嘗試解析 URL
    const parsed = new URL(url, 'https://placeholder.com')

    // 檢查協議
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return false
    }

    // 如果是相對路徑 (沒有 host)
    if (!parsed.host || parsed.host === 'placeholder.com') {
      // 只允許以 / 開頭的相對路徑
      return url.startsWith('/') && !url.startsWith('//')
    }

    // 檢查域名是否在白名單中
    const hostname = parsed.hostname.toLowerCase()

    return ALLOWED_DOMAINS.some(domain => {
      // 支援萬用字元域名 (例如 .vercel.app)
      if (domain.startsWith('.')) {
        return hostname.endsWith(domain) || hostname === domain.substring(1)
      }
      return hostname === domain
    })
  } catch {
    // URL 解析失敗
    return false
  }
}

/**
 * 取得安全的重定向 URL
 * 如果 URL 不安全,返回預設的安全 URL
 *
 * @param url - 要驗證的 URL
 * @param fallback - 如果驗證失敗的預設 URL (預設為 '/')
 * @returns 安全的 URL
 */
export function getSafeRedirectUrl(url: string, fallback: string = '/'): string {
  if (validateRedirectUrl(url)) {
    return url
  }
  return fallback
}

/**
 * 建立安全的重定向 Response
 *
 * @param url - 重定向目標 URL
 * @param fallback - 如果 URL 不安全的預設位置
 * @param status - HTTP 狀態碼 (預設 302)
 * @returns Next.js Response 物件
 */
export function safeRedirect(
  url: string,
  fallback: string = '/',
  status: number = 302
): Response {
  const safeUrl = getSafeRedirectUrl(url, fallback)

  return new Response(null, {
    status,
    headers: {
      Location: safeUrl,
    },
  })
}

/**
 * 新增允許的域名到白名單
 * 用於在執行時期動態新增域名
 *
 * @param domain - 要新增的域名
 */
export function addAllowedDomain(domain: string): void {
  if (!ALLOWED_DOMAINS.includes(domain)) {
    ALLOWED_DOMAINS.push(domain)
  }
}

/**
 * 取得目前的域名白名單
 */
export function getAllowedDomains(): readonly string[] {
  return Object.freeze([...ALLOWED_DOMAINS])
}
