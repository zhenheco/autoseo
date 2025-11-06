# xss-protection Specification

## Purpose
TBD - created by archiving change comprehensive-security-audit. Update Purpose after archive.
## Requirements
### Requirement: HTML 內容清理

所有使用者產生的 HTML 內容 MUST 經過清理。

#### Scenario: 清理文章 HTML 內容

**Given** 文章包含 HTML 標籤 `<script>alert('XSS')</script>`
**When** 渲染文章內容
**Then** 使用 DOMPurify 清理 HTML
**And** 移除所有 `<script>` 標籤
**And** 保留安全的標籤如 `<p>`, `<strong>`, `<em>`

#### Scenario: 允許特定的 HTML 標籤

**Given** 文章包含 `<h1>標題</h1><p>內容</p>`
**When** 清理 HTML
**Then** 保留 h1, h2, h3, p, br, strong, em, ul, ol, li 標籤
**And** 移除所有 JavaScript 事件處理器 (onclick, onerror, etc.)
**And** 移除所有 `javascript:` URL

### Requirement: URL 清理和驗證

所有用於重定向或嵌入的 URL MUST 經過驗證和清理。

#### Scenario: 驗證重定向 URL

**Given** 支付回調返回重定向 URL
**When** 準備重定向使用者
**Then** 驗證 URL 屬於允許的域名白名單
**And** 拒絕外部或可疑的 URL
**And** 使用預設的安全 URL ("/") 作為後備

#### Scenario: 清理 URL 參數

**Given** URL 包含 `?error=<script>alert('XSS')</script>`
**When** 在 HTML 中使用 URL
**Then** 對 URL 進行 HTML 實體編碼
**And** `<` 轉為 `&lt;`, `>` 轉為 `&gt;`

### Requirement: 禁止危險的 React 屬性

`dangerouslySetInnerHTML` 的使用 MUST 受到限制,並確保所有內容都經過清理。

#### Scenario: 使用 dangerouslySetInnerHTML 顯示文章

**Given** 文章內容需要渲染為 HTML
**When** 使用 `dangerouslySetInnerHTML`
**Then** 內容必須先通過 `sanitizeHtml()` 清理
**And** 在程式碼審查中標記所有 `dangerouslySetInnerHTML` 使用

#### Scenario: 偵測未清理的 dangerouslySetInnerHTML

**Given** 程式碼包含 `dangerouslySetInnerHTML={{ __html: rawContent }}`
**When** 執行安全掃描
**Then** 工具偵測到未清理的使用
**And** 警告開發者可能的 XSS 風險

### Requirement: 表單輸入驗證和清理

所有表單輸入 MUST 在客戶端和伺服器端都進行驗證和清理。

#### Scenario: 驗證使用者輸入的標題

**Given** 使用者在表單中輸入文章標題 `<img src=x onerror=alert('XSS')>`
**When** 提交表單
**Then** 伺服器端驗證標題不包含 HTML 標籤
**And** 拒絕包含 `<` 或 `>` 的標題
**And** 返回清晰的錯誤訊息

#### Scenario: 清理使用者輸入的描述

**Given** 使用者輸入描述包含 HTML
**When** 儲存到資料庫
**Then** 先清理 HTML,移除危險標籤
**And** 儲存清理後的內容

### Requirement: JSON 資料的安全處理

從 API 返回的 JSON 資料在渲染時 MUST 正確處理和編碼。

#### Scenario: 在 HTML 屬性中使用 JSON

**Given** 需要在 HTML 屬性中嵌入 JSON 資料
**When** 渲染 HTML
**Then** 對 JSON 字串進行 HTML 實體編碼
**And** 避免直接插入未編碼的字串

#### Scenario: 在 JavaScript 中使用伺服器資料

**Given** 需要將伺服器資料傳遞給前端 JavaScript
**When** 渲染頁面
**Then** 使用 Next.js 的 `<Script>` 標籤
**And** 通過 props 傳遞資料,不直接嵌入 `<script>`

