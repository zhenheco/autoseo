# Spec: WYSIWYG Editor

## Overview

將文章編輯器改為所見即所得（WYSIWYG）編輯模式，允許使用者直接在渲染後的內容上進行編輯。基於 TipTap 編輯器，儲存 JSON 格式作為真實來源，移除原始碼編輯模式，提供更簡潔的編輯體驗。

## ADDED Requirements

### Requirement: JSON storage as source of truth

**ID**: `wysiwyg-editor-000`

系統 SHALL 儲存 TipTap JSON 格式作為內容的真實來源（source of truth），HTML 作為可選的快取欄位。

#### Scenario: Save article content as JSON

**Given** 使用者在視覺編輯模式編輯內容
**When** 使用者點擊「儲存」按鈕
**Then** 系統應將 `editor.getJSON()` 的輸出儲存到資料庫
**And** JSON 應儲存在 `articles.content_json` 欄位（JSONB 類型）
**And** HTML 應同時儲存到 `articles.html_content` 欄位用於快速渲染

#### Scenario: Load article content from JSON

**Given** 資料庫包含文章的 JSON 內容
**When** 使用者開啟視覺編輯模式
**Then** 系統應從 `content_json` 欄位讀取資料
**And** 使用 `editor.commands.setContent(json)` 初始化編輯器
**And** JSON 無法解析時，應降級使用 `html_content`

#### Scenario: Validate JSON against schema

**Given** 使用者儲存文章
**When** 系統接收 JSON 內容
**Then** 伺服器應驗證 JSON 符合 TipTap schema
**And** 不符合 schema 的 JSON 應被拒絕
**And** 回傳錯誤訊息「內容格式不正確」

---

### Requirement: Visual editing mode

**ID**: `wysiwyg-editor-001`

系統 SHALL 提供視覺化編輯模式，允許使用者在渲染後的內容上直接編輯，無需手動編寫 HTML 標籤。

#### Scenario: User opens article editor

**Given** 使用者在文章編輯頁面
**And** 文章包含內容
**When** 編輯器載入
**Then** 系統應顯示 WYSIWYG 編輯器
**And** 編輯器應渲染現有的內容
**And** 使用者應能直接點擊文字進行編輯

#### Scenario: User formats text in visual mode

**Given** 使用者在視覺編輯模式
**When** 使用者選取一段文字
**And** 使用者點擊「加粗」按鈕
**Then** 選取的文字應變為粗體
**And** 底層 JSON 應包含 `{ type: 'text', marks: [{ type: 'bold' }] }`

#### Scenario: User inserts a link

**Given** 使用者在視覺編輯模式
**When** 使用者選取文字「點此查看」
**And** 使用者點擊「插入連結」按鈕
**And** 使用者輸入 URL "https://example.com"
**Then** 文字應變為可點擊的連結
**And** JSON 應包含 `{ type: 'text', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }`

---

### Requirement: Dual-layer HTML sanitization

**ID**: `wysiwyg-editor-002`

系統 MUST 實作雙層 HTML 清理：客戶端（DOMPurify）和伺服器端（sanitize-html），以防止 XSS 攻擊。

#### Scenario: Client-side HTML sanitization

**Given** 使用者在視覺編輯模式
**When** 編輯器產生 HTML 輸出（用於預覽）
**Then** 客戶端應使用 DOMPurify 清理 HTML
**And** 危險的標籤（如 `<script>`）應被移除
**And** 允許的標籤（如 `<iframe>` 用於嵌入影片）應被保留

#### Scenario: Server-side HTML sanitization

**Given** API 接收文章儲存請求
**When** 請求包含 HTML 內容
**Then** 伺服器應使用 `sanitize-html` 或 DOMPurify (Node.js) 清理 HTML
**And** 清理配置應與客戶端一致
**And** 不符合安全標準的 HTML 應被拒絕
**And** 回傳錯誤訊息「內容包含不安全的元素」

#### Scenario: TipTap extension-based filtering

**Given** 編輯器已初始化
**Then** TipTap 應配置為只允許 StarterKit 定義的節點和標記
**And** 未在 extensions 中定義的內容應自動被過濾
**And** 這提供第一層基本保護（但不足以應對安全威脅）

---

### Requirement: Draft auto-save

**ID**: `wysiwyg-editor-003`

視覺編輯模式 SHALL 保留現有的草稿自動儲存功能，在使用者停止編輯 1 秒後自動儲存到 localStorage。

#### Scenario: Visual edits are auto-saved to localStorage

**Given** 使用者在視覺編輯模式
**When** 使用者編輯內容
**And** 1 秒後無進一步變更（debounce）
**Then** 系統應將 `editor.getJSON()` 儲存到 localStorage
**And** localStorage key 應為 `article-draft-{articleId}`
**And** 儲存的資料應為 `{ title, content_json, html_content }`

#### Scenario: Restore draft from localStorage

**Given** localStorage 包含文章 ID 為 "123" 的草稿
**And** 草稿包含未儲存的變更
**When** 使用者開啟文章 "123"
**Then** 系統應提示「發現未儲存的草稿」
**And** 使用者可選擇「恢復草稿」或「捨棄草稿」
**When** 使用者選擇「恢復草稿」
**Then** 編輯器應載入 localStorage 中的 JSON 內容

---

### Requirement: Performance optimization

**ID**: `wysiwyg-editor-004`

WYSIWYG 編輯器 MUST 使用 lazy loading 和效能優化配置，以避免影響初始頁面載入時間和執行效能。

#### Scenario: Editor is lazy loaded

**Given** 使用者進入文章列表頁面
**When** 頁面首次載入
**Then** WYSIWYG 編輯器套件不應被載入
**And** Bundle 大小影響應為 0KB
**When** 使用者點擊「視覺編輯」分頁
**Then** 系統應使用 `React.lazy()` 動態載入編輯器
**And** 顯示 Suspense fallback（loading spinner）
**And** 編輯器套件應為獨立的 chunk（約 210KB gzipped）

#### Scenario: Editor performance configuration

**Given** TipTap 編輯器已初始化
**Then** 編輯器應設定 `immediatelyRender: false`
**And** 這可避免 SSR hydration 問題
**And** 編輯器應設定 `shouldRerenderOnTransaction: false`
**And** 這可減少 React 不必要的重渲染

#### Scenario: Use EditorContext to avoid prop drilling

**Given** 編輯器組件包含多層巢狀子組件（如 Toolbar、MenuBar）
**When** 子組件需要存取編輯器實例
**Then** 應使用 `useCurrentEditor()` hook 從 context 取得
**And** 不應透過 props 層層傳遞編輯器實例
**And** 這可提升程式碼可維護性和效能
