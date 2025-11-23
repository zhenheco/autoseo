# Proposal: Enhance Article Editor UX

## Summary

全面改進文章編輯器的使用者體驗，基於 2025 年現代 CMS 最佳實踐，包含三個核心改進：

1. **WYSIWYG 視覺編輯器**：採用 TipTap（基於 ProseMirror）取代傳統 HTML 編輯，提供即時渲染的編輯體驗
2. **精簡狀態顯示**：文章列表的狀態改為圖示化顯示，符合 WCAG 2.2 無障礙標準
3. **智慧網站選擇器**：發布流程整合網站選擇，支援智慧預設和批次發布

## Motivation

### 當前痛點

**編輯體驗問題**：

- 需要在「預覽」和「編輯 HTML」分頁間切換，無法即時看到渲染效果
- 手動編寫 HTML 標籤增加錯誤風險（如未閉合標籤、錯誤嵌套）
- 無法支援未來的協作編輯功能
- 使用純 HTML 儲存存在 XSS 安全隱患

**視覺密度問題**：

- 文章列表狀態顯示（如「已完成」文字）佔用過多垂直空間
- 降低可視內容數量，影響操作效率

**發布流程問題**：

- 無法在發布時直接選擇目標網站
- 批次發布缺少清晰的網站指示
- 沒有智慧預設機制，每次都需要手動配置

## Goals

### 主要目標

1. **現代化編輯體驗**
   - 單一視覺編輯模式，無需分頁切換
   - 即時渲染，所見即所得（WYSIWYG）
   - 工具列支援常用格式化功能（Bold, Italic, Heading, List, Link, Image）
   - 參考 TinyMCE 範例的「漂亮」行距和樣式

2. **提升安全性**
   - 採用 JSON 儲存格式，降低 XSS 風險
   - 實作雙層 HTML sanitization（client: DOMPurify + server: sanitize-html）
   - 伺服器端 JSON schema 驗證

3. **優化視覺效率**
   - 狀態圖示化（Check, Clock, XCircle）
   - 符合 WCAG 2.2 AA 無障礙標準（鍵盤導航、螢幕閱讀器、顏色對比度 ≥ 4.5:1）
   - 支援暗色模式

4. **簡化發布工作流程**
   - 整合網站選擇下拉選單到發布對話框
   - 智慧預設選擇（localStorage → 上次發布網站 → 第一個可用網站）
   - 批次發布支援單一網站目標
   - 網站狀態指示（active/inactive）

5. **未來擴展性**
   - JSON 格式易於支援協作編輯（TipTap + Yjs + WebSocket）
   - 可整合 AI 寫作助手
   - 支援版本控制和內容追蹤

## Non-Goals

### 本階段不包含

- **不實作協作編輯**：保留為未來擴展，目前專注於單人編輯體驗
- **不改變 WordPress 發布邏輯**：僅改善前端選擇介面，後端邏輯維持不變
- **不修改現有文章的 HTML 內容**：舊文章保留 `html_content`，新增 `content_json` 欄位
- **不支援完整的 HTML 自訂**：僅支援 TipTap StarterKit 定義的標籤和格式
- **不實作版本歷史**：草稿自動儲存維持現有 localStorage 機制

## Risks

### 技術風險

1. **效能影響**（中風險）
   - TipTap bundle ~210KB gzipped
   - **緩解**：lazy loading，僅在需要時載入
   - **緩解**：`immediatelyRender: false`, `shouldRerenderOnTransaction: false`

2. **XSS 安全隱患**（高風險）
   - 使用者產生的內容可能包含惡意 HTML
   - **緩解**：雙層 sanitization（client + server）
   - **緩解**：JSON schema 驗證
   - **緩解**：結合 Content Security Policy (CSP)

3. **資料庫 Migration**（中風險）
   - 新增 `content_json` JSONB 欄位可能影響查詢效能
   - **緩解**：先在 development 環境測試
   - **緩解**：保留 `html_content` 作為降級選項

4. **瀏覽器相容性**（低風險）
   - TipTap 需要現代瀏覽器
   - **緩解**：支援 Chrome, Firefox, Safari, Edge 最新版

5. **無障礙合規性**（中風險）
   - Rich text editor 必須符合 WCAG 2.2 標準
   - **緩解**：完整的無障礙測試清單（VoiceOver, NVDA, 鍵盤導航）

### 業務風險

1. **使用者學習曲線**（低風險）
   - 移除原始碼編輯模式可能影響進階使用者
   - **緩解**：WYSIWYG 更直觀，降低整體學習成本

2. **部署時間延長**（中風險）
   - 估計 52-60 小時開發時間（約 7 個工作天）
   - **緩解**：分三個 Phase 實作，Phase 1 可快速交付價值

## Dependencies

### 技術依賴

**必要套件**：

- `@tiptap/react` (v3.10.7+) - React 整合
- `@tiptap/pm` - ProseMirror 核心
- `@tiptap/starter-kit` - 基礎 extensions
- `dompurify` - 客戶端 HTML sanitization
- `sanitize-html` - 伺服器端 HTML sanitization

**資料庫需求**：

- 新增 `articles.content_json` 欄位（JSONB 類型）
- 保留 `articles.html_content` 欄位（TEXT 類型）
- 現有 `articles.website_id` 欄位（外鍵到 websites table）

**API 需求**：

- `/api/websites` endpoint（查詢使用者的網站列表）
- 更新 `/api/articles/[id]/publish` 接受 `website_id` 參數
- 更新 `/api/articles/batch-publish` 支援網站選擇

### 設計依賴

- Shadcn UI 組件庫（Select, Tooltip, Alert, Dialog）
- Lucide React 圖示（Check, Clock, XCircle, Globe）
- 參考使用者提供的 TinyMCE 範例樣式

## Technical Rationale

### 為什麼選擇 TipTap？

基於 2025 年最新研究和業界趨勢，TipTap 是最佳選擇：

**1. React 原生整合**

- 完整的 React hooks 支援（`useEditor`, `useEditorState`）
- TinyMCE 需要額外的 wrapper 和配置

**2. JSON 儲存優勢**（基於 Reddit 和 Contentstack 共識）

- **安全性**：JSON 結構化格式天生比 HTML 更難被 XSS 攻擊
- **易維護**：基本物件操作，不需管理 HTML 標籤開閉
- **跨平台**：可被所有程式語言理解和處理
- **可驗證**：可針對 TipTap schema 驗證 JSON，避免畸形資料

**3. 效能優化**（來自 TipTap 官方文件）

- `immediatelyRender: false` - 避免 SSR hydration 問題
- `shouldRerenderOnTransaction: false` - 減少 React 不必要的重新渲染
- `useEditorState` - 僅訂閱必要的狀態變更

**4. 未來擴展性**

- 原生支援協作編輯（TipTap + Yjs + WebSocket）
- 易於整合 AI 寫作助手
- 活躍的開發社群（2025 年持續更新）

**5. 業界驗證**

- 被 GitLab、Substack 等知名產品使用
- Liveblocks 2025 調查：最受歡迎的協作編輯框架

### 為什麼選擇單一編輯模式？

**符合現代 CMS 趨勢**：

- Notion、WordPress Gutenberg 都採用單一視覺編輯
- 降低認知負擔，簡化使用者體驗
- TipTap JSON 格式已提供完整的內容控制

**降低錯誤風險**：

- 移除原始碼編輯避免使用者犯錯（如未閉合標籤）
- WYSIWYG 更直觀，適合非技術使用者

### 為什麼需要雙層 Sanitization？

**OWASP 建議**（來自 XSS Prevention Cheat Sheet）：

- 客戶端清理可提供即時回饋
- 伺服器端清理是最後一道防線
- 不能信任客戶端的清理結果

**實作策略**：

- 客戶端：DOMPurify（OWASP 推薦）
- 伺服器端：sanitize-html（Node.js）
- 配置一致的允許標籤清單
- 特殊需求：允許 iframe（用於嵌入 YouTube 等）

### WCAG 2.2 合規性

**2025 年最新要求**：

- **Focus Not Obscured**：聚焦項目必須至少部分可見
- **鍵盤導航**：所有互動元素必須支援 keyboard-only 使用
- **Target Size Minimum**：觸控目標最小尺寸
- **顏色對比度 ≥ 4.5:1**（AA 標準）

**實作方案**：

- 狀態圖示包含 `role="img"` 和 `aria-label`
- Tooltip 支援鍵盤導航（`tabindex="0"`）
- 使用 VoiceOver (macOS) 和 NVDA (Windows) 測試
- WebAIM Contrast Checker 驗證對比度

## Related Changes

### 直接影響

- `article-management` spec - 核心編輯功能
- `xss-protection` spec - 安全性防護策略

### 間接影響

- `database-schema` spec - 新增 `content_json` 欄位
- `api-endpoints` spec - 更新發布 API 接受 `website_id`
- `ui-components` spec - 新增 WebsiteSelector, ArticleStatusIcon 組件

### 未來擴展

- `collaborative-editing` spec - 基於 TipTap + Yjs
- `ai-writing-assistant` spec - 整合 AI 輔助寫作
- `version-control` spec - JSON 格式易於版本追蹤

## Success Metrics

### 使用者體驗指標

- 編輯器首次載入時間 < 1 秒（lazy loading）
- 文章列表可視內容數量 +20%（狀態圖示化）
- 發布流程步驟 -1（整合網站選擇）

### 技術指標

- XSS 測試通過率 100%（雙層 sanitization）
- WCAG 2.2 AA 合規性 100%（自動化測試 + 手動驗證）
- Bundle size impact: 主 bundle +0KB, TipTap chunk ~210KB（僅按需載入）

### 安全性指標

- 伺服器端 JSON schema 驗證覆蓋率 100%
- HTML sanitization 測試案例 > 50 個（包含常見 XSS 攻擊向量）
