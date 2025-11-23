# Spec: 文章預覽顯示修復

## ADDED Requirements

### Requirement: Article list page preview MUST display HTML content correctly including images

文章列表頁面的右側預覽區域 **MUST** 能夠渲染完整的 HTML 內容，包括圖片、標題、段落等元素，而非顯示原始的 Markdown 或 URL 文字。

#### Scenario: 用戶選擇一篇文章查看預覽

**Given** 用戶已登入並在文章管理頁面
**And** 至少有一篇已完成的文章
**And** 該文章的 `html_content` 欄位包含完整的 HTML 格式內容（包含 `<img>` 標籤）

**When** 用戶點擊左側列表中的一篇文章

**Then** 右側預覽區域應顯示渲染後的 HTML 內容
**And** 圖片應正確顯示為 `<img>` 元素而非 Markdown URL 文字
**And** 所有 HTML 標籤應正確渲染（標題、段落、列表等）
**And** 不應顯示任何原始 HTML 代碼或 Markdown 語法

#### Scenario: 預覽區域安全淨化 HTML 內容

**Given** 一篇文章的 `html_content` 包含潛在危險的 HTML（如 `<script>` 標籤）

**When** 用戶查看該文章預覽

**Then** 危險的 HTML 標籤應被過濾移除
**And** 安全的內容標籤應正常顯示（p, h1-h6, img, a, ul, ol, li 等）
**And** 不應執行任何 JavaScript 代碼
**And** 圖片的 src 屬性應保留並正確載入

### Requirement: ArticleHtmlPreview component MUST execute DOMPurify only on client-side

為避免 Vercel serverless 環境的 ESM/CommonJS 衝突，`ArticleHtmlPreview` 組件 **MUST** 僅在瀏覽器環境執行 HTML 淨化邏輯。

#### Scenario: SSR 階段不執行 DOMPurify

**Given** Next.js 正在執行服務端渲染（SSR）
**And** ArticleHtmlPreview 組件被渲染

**When** 組件檢測到 `typeof window === 'undefined'`

**Then** 應直接返回原始 `htmlContent`
**And** 不應調用 `DOMPurify.sanitize()`
**And** 不應引發 jsdom/parse5 相關錯誤

#### Scenario: 客戶端正確淨化 HTML

**Given** 組件在瀏覽器環境運行
**And** 收到包含不安全 HTML 的 `htmlContent`

**When** 組件執行 `DOMPurify.sanitize()`

**Then** 應返回淨化後的安全 HTML
**And** 允許的標籤應保留（p, h1-h6, img, a 等）
**And** 不允許的標籤應移除（script, iframe 等）

## MODIFIED Requirements

### Requirement: DOMPurify package MUST use browser-only version

專案 **MUST** 將 `isomorphic-dompurify` 替換為 `dompurify`，避免 jsdom 依賴導致的 ESM 錯誤。

#### Scenario: package.json 僅包含客戶端 DOMPurify

**Given** 專案使用 pnpm 管理依賴

**When** 執行 `pnpm install`

**Then** 應安裝 `dompurify` 套件
**And** 不應安裝 `isomorphic-dompurify`
**And** 不應安裝 `jsdom`（除非其他套件明確需要）
**And** `pnpm list dompurify` 應顯示成功安裝

#### Scenario: Vercel 建置不應出現 parse5 ESM 錯誤

**Given** 專案已替換為純瀏覽器 DOMPurify
**And** 推送代碼到 Vercel

**When** Vercel 執行建置流程

**Then** 不應出現 `Error: require() of ES Module .../parse5/dist/index.js` 錯誤
**And** 建置應成功完成
**And** 部署應正常上線
