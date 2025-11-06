# 安全性政策與最佳實踐

## 🔐 回報安全漏洞

如果您發現任何安全漏洞,請**不要**公開發布 issue。請透過以下方式聯繫我們:

- Email: security@example.com
- 我們承諾在 48 小時內回應所有安全報告

## 🛡️ 已實施的安全措施

### 1. 敏感資訊保護

#### 環境變數管理
- ✅ 所有敏感資訊存放在 `.env.local`
- ✅ `.env.local` 已加入 `.gitignore`
- ✅ 提供 `.env.example` 作為範本
- ✅ 啟動時驗證必要的環境變數

#### 日誌安全
- ✅ 使用 `src/lib/security/log-sanitizer.ts` 過濾敏感資訊
- ✅ 自動遮蔽 API 金鑰、Token、密碼
- ✅ Email 地址部分遮蔽

### 2. XSS (跨站腳本) 防護

#### HTML 清理
- ✅ 使用 DOMPurify 清理所有 HTML 內容
- ✅ 兩層配置:
  - 文章內容: 寬鬆配置,保留格式
  - 使用者輸入: 嚴格配置,只允許基本標籤
- ✅ 移除所有危險標籤: `<script>`, `<iframe>`, `<object>` 等
- ✅ 移除事件處理器: `onclick`, `onerror` 等

#### 輸出轉義
- ✅ 提供 `escapeHtml()` 函式
- ✅ 提供 `escapeUrl()` 函式
- ✅ 支付回調 URL 經過轉義

### 3. 開放重定向防護

#### URL 驗證
- ✅ 實施域名白名單驗證
- ✅ 只允許相對路徑或白名單域名
- ✅ 提供 `validateRedirectUrl()` 和 `safeRedirect()`

### 4. Webhook 安全

#### 簽章驗證
- ✅ HMAC SHA256 簽章驗證
- ✅ 藍新金流專用驗證函式
- ✅ 時間戳驗證 (防重放攻擊)
- ✅ Nonce 檢查機制

### 5. HTTP 安全標頭

已在 `src/middleware.ts` 設定以下標頭:

- `X-Frame-Options: SAMEORIGIN` - 防止 Clickjacking
- `X-Content-Type-Options: nosniff` - 防止 MIME 類型混淆
- `Referrer-Policy: strict-origin-when-cross-origin` - 控制 Referrer 資訊
- `X-XSS-Protection: 1; mode=block` - 啟用瀏覽器 XSS 過濾器
- `Strict-Transport-Security` (僅生產環境) - 強制 HTTPS
- `Content-Security-Policy` - 限制資源載入來源

## 📋 安全檢查清單

### 開發前

- [ ] 確認 `.env.local` 不在版本控制中
- [ ] 檢查 `.gitignore` 包含所有敏感檔案
- [ ] 閱讀本安全文件

### 開發時

- [ ] 絕不硬編碼 API 金鑰或密碼
- [ ] 使用 `sanitizeArticleHtml()` 清理文章 HTML
- [ ] 使用 `sanitizeUserInput()` 清理使用者輸入
- [ ] 使用安全 logger 而非 `console.log`
- [ ] 驗證所有外部輸入
- [ ] 使用參數化查詢 (Supabase 已內建)

### 提交前

- [ ] 執行 `git status` 確認沒有包含 `.env.local`
- [ ] 搜尋程式碼中是否有硬編碼的金鑰
- [ ] 檢查 commit diff 中是否有敏感資訊
- [ ] 執行 `npm run lint` 和 `npm run typecheck`

### 部署前

- [ ] 確認生產環境變數已設定
- [ ] 驗證 HTTPS 已啟用
- [ ] 檢查 CSP 設定是否正確
- [ ] 測試安全標頭是否正確設定
- [ ] 確認敏感端點有認證保護

## 🔧 安全工具使用指南

### 1. 日誌安全

```typescript
import { logger } from '@/lib/security/log-sanitizer'

logger.info('User login', { userId: user.id, email: user.email })

const data = { apiKey: 'sk-xxx', username: 'john' }
logger.log('Data:', data)
```

### 2. HTML 清理

```typescript
import { sanitizeArticleHtml, sanitizeUserInput } from '@/lib/security/html-sanitizer'

const articleContent = sanitizeArticleHtml(article.html_content)

const userComment = sanitizeUserInput(comment.text)
```

### 3. URL 驗證

```typescript
import { validateRedirectUrl, safeRedirect } from '@/lib/security/url-validator'

if (validateRedirectUrl(redirectUrl)) {
  return safeRedirect(redirectUrl)
} else {
  return safeRedirect('/', '/dashboard')
}
```

### 4. Webhook 驗證

```typescript
import { verifyNewebPayCallback, verifyTimestamp } from '@/lib/security/webhook-validator'

const isValid = verifyNewebPayCallback(
  tradeInfo,
  tradeSha,
  process.env.NEWEBPAY_HASH_KEY!,
  process.env.NEWEBPAY_HASH_IV!
)

const isRecent = verifyTimestamp(request.timestamp, 300)

if (!isValid || !isRecent) {
  return new Response('Unauthorized', { status: 401 })
}
```

### 5. 環境變數驗證

```typescript
import { getRequiredEnv, validateEnv } from '@/lib/security/env-validator'

const apiKey = getRequiredEnv('OPENAI_API_KEY')

validateEnv()
```

## 🚨 常見安全陷阱

### ❌ 錯誤範例

```typescript
console.log('API Key:', process.env.OPENAI_API_KEY)

const html = `<div>${userInput}</div>`

window.location.href = request.query.redirect

const query = `SELECT * FROM users WHERE email = '${email}'`
```

### ✅ 正確範例

```typescript
import { logger } from '@/lib/security/log-sanitizer'
logger.info('Using API key')

const html = sanitizeUserInput(userInput)

const safeUrl = getSafeRedirectUrl(request.query.redirect, '/dashboard')

const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', email)
```

## 🔍 安全審計

定期執行以下檢查:

```bash
npm audit

git log -p | grep -i 'password\|secret\|key'

npx tsx scripts/security-scan.ts
```

## 📚 延伸閱讀

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## 📝 更新日誌

### 2025-11-06
- ✅ 實施 Phase 1: 日誌安全與 XSS 防護
- ✅ 實施 Phase 2: Webhook 驗證與安全標頭
- ✅ 建立完整的安全工具套件
- ✅ 建立安全文件

---

**最後更新**: 2025-11-06
**維護者**: Auto Pilot SEO Team
