# Article Preview Display

## MODIFIED Requirements

### Requirement: Display HTML-rendered article content in preview

文章預覽頁面 **MUST** 顯示完整渲染的 HTML 內容，而非 Markdown 原始碼，讓使用者能夠預覽實際發佈後的文章樣貌。

#### Scenario: User views article preview with HTML rendering

**Given** 使用者已生成一篇文章
**And** 文章包含 HTML 內容 (`html_content` 欄位)
**When** 使用者點擊「預覽」查看文章
**Then** 預覽頁面應顯示渲染後的 HTML 內容
**And** 內容應包含正確的排版、樣式和圖片
**And** Markdown 原始碼應在次要位置或可摺疊區域顯示

#### Scenario: User views article with images in preview

**Given** 使用者已生成包含圖片的文章
**And** 文章的 HTML 內容包含 `<img>` 標籤
**When** 使用者查看預覽頁面
**Then** 所有圖片應正確載入和顯示
**And** 特色圖片應在文章開頭顯示
**And** 內文圖片應在對應位置嵌入
**And** 圖片應支援響應式佈局（在不同螢幕尺寸下正常顯示）

#### Scenario: Preview page handles missing HTML content gracefully

**Given** 某篇文章的 `html_content` 欄位為空或 null
**When** 使用者查看預覽頁面
**Then** 系統應回退顯示 Markdown 內容
**Or** 顯示友善的錯誤訊息「HTML 內容尚未生成」
**And** 不應導致頁面崩潰或顯示空白

## ADDED Requirements

### Requirement: Sanitize HTML content to prevent XSS attacks

預覽頁面 **MUST** 對 HTML 內容進行淨化處理，防止跨站腳本攻擊（XSS），確保使用者安全。

#### Scenario: System sanitizes HTML before rendering

**Given** 文章的 HTML 內容包含潛在危險的標籤或屬性
**And** 內容可能包含 `<script>` 標籤、事件處理器（如 `onclick`）、或其他 XSS 向量
**When** 系統準備渲染 HTML 預覽
**Then** 系統 **MUST** 使用 DOMPurify（或 isomorphic-dompurify）進行淨化
**And** 只允許安全的 HTML 標籤（如 `<p>`, `<h1>`-`<h6>`, `<img>`, `<a>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>` 等）
**And** 只允許安全的屬性（如 `href`, `src`, `alt`, `class`, `title` 等）
**And** 移除所有事件處理器屬性（如 `onclick`, `onerror`, `onload`）
**And** 移除所有 `<script>` 標籤和內聯 JavaScript
**And** 移除 `data-*` 屬性（除非明確允許）

#### Scenario: System applies Content Security Policy headers

**Given** 使用者正在檢視預覽頁面
**When** 瀏覽器載入頁面
**Then** 伺服器 **MUST** 回傳 Content-Security-Policy header
**And** CSP **MUST** 限制 script-src 來源（只允許 'self' 和必要的 CDN）
**And** CSP **MUST** 允許來自 Google Drive 的圖片（`img-src` 包含 `'self'`, `https://drive.google.com`, `https://*.googleusercontent.com`, `blob:`, `data:`）
**And** 伺服器 **MUST** 回傳 `X-Content-Type-Options: nosniff` header 防止 MIME 嗅探
**And** 伺服器 **MUST** 回傳 `X-Frame-Options: DENY` header 防止點擊劫持

#### Scenario: System optimizes sanitization performance

**Given** 文章的 HTML 內容在組件生命週期內不會改變
**When** React 組件渲染
**Then** 系統 **MUST** 使用 `useMemo` hook 快取淨化後的 HTML
**And** 只在 `htmlContent` prop 改變時重新淨化
**And** 避免每次渲染都執行 CPU 密集的淨化操作

#### Scenario: System validates image sources

**Given** 文章 HTML 包含 `<img>` 標籤
**When** 系統淨化 HTML
**Then** 系統 **MUST** 驗證圖片來源 URL
**And** 只允許來自信任域名的圖片（Google Drive、自有網域）
**And** 拒絕不安全的協議（如 `javascript:`）
**And** 對於外部圖片，設定適當的 `referrerpolicy` 屬性

## REMOVED Requirements

### Requirement: Display Markdown content as primary preview format

~~文章預覽頁面不應再將 Markdown 原始碼作為主要顯示格式。~~

**移除原因**：Markdown 格式無法提供使用者所見即所得的預覽體驗，且無法正確顯示圖片。改為 HTML 渲染後，Markdown 僅作為次要參考資訊。
