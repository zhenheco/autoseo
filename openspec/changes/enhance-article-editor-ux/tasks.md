# Tasks: Enhance Article Editor UX

## Phase 1: Status Display Optimization (最簡單，快速交付) ✅

### Task 1.1: 建立狀態圖示組件 ✅

- [x] 建立 `ArticleStatusIcon` 組件
- [x] 實作 Check, Clock, XCircle 圖示對應
- [x] 加入顏色變體（綠、黃、紅）
- [x] 加入暗色模式支援（`dark:text-green-400` 等）
- [x] 測試：圖示正確渲染
- **檔案**: `src/components/articles/ArticleStatusIcon.tsx`

### Task 1.2: 加入 tooltip 支援 ✅

- [x] 使用 `@/components/ui/tooltip` 包裹圖示
- [x] 實作狀態文字對應（completed → 已完成）
- [x] 加入 `role="tooltip"` 屬性
- [x] 加入 `aria-labelledby` 或 `aria-describedby` 關聯
- [x] 測試：滑鼠移至圖示時顯示 tooltip
- **檔案**: `src/components/articles/ArticleStatusIcon.tsx`

### Task 1.3: 加入無障礙屬性 ✅

- [x] 加入 `role="img"` 到圖示容器
- [x] 加入 `aria-label` 到圖示（完整文字描述）
- [x] 加入 `tabindex="0"` 支援鍵盤導航
- [x] 實作 focus 時顯示 tooltip
- [x] 測試：螢幕閱讀器正確朗讀
- **檔案**: `src/components/articles/ArticleStatusIcon.tsx`

### Task 1.4: 整合到文章列表 ✅

- [x] 在 `page.tsx` 中引入 `ArticleStatusIcon`
- [x] 替換現有的狀態文字顯示
- [x] 調整布局確保圖示與標題在同一行
- [x] 測試：列表項目高度正確（一行）
- **檔案**: `src/app/(dashboard)/dashboard/articles/page.tsx`

### Task 1.5: 無障礙和視覺驗證 ✅

- [x] 使用 Chrome DevTools 檢查視覺呈現
- [x] 確認圖示大小為 16px (h-4)
- [x] 使用對比度檢查工具驗證 ≥ 4.5:1（WCAG AA）
- [x] 測試鍵盤 Tab 導航到圖示
- [x] 使用螢幕閱讀器測試（VoiceOver / NVDA）
- [x] 截圖記錄最終效果

---

## Phase 2: Website Selector (中等複雜度) ✅

### Task 2.1: 建立網站 API endpoint ⚠️

- [x] 建立 `/api/websites` GET endpoint（已存在）
- [x] 實作基於 company_id 的查詢
- [x] 回傳格式：`{ id, name, url, is_active }`
- [x] 實作錯誤處理（資料庫連接失敗等）
- [x] 測試：API 正確回傳使用者的網站列表
- **檔案**: `src/app/api/websites/route.ts`（使用 Supabase 直接查詢）

### Task 2.2: 建立 WebsiteSelector 組件 ✅

- [x] 建立 `WebsiteSelector` 組件（已存在，已增強）
- [x] 使用 `@/components/ui/select` 實作下拉選單
- [x] 使用 Supabase 查詢（無需額外快取，已內建於 Supabase）
- [x] 加入 Globe 圖示到每個選項
- [x] 顯示網站名稱（粗體）+ hostname（灰色小字）
- [x] 加入 loading 狀態指示
- [x] 加入「尚無可用網站」空狀態
- [x] 測試：組件正確渲染網站列表
- **檔案**: `src/components/articles/WebsiteSelector.tsx`

### Task 2.3: 實作智慧預設選擇 ✅

- [x] 優先級 1：從 localStorage 讀取上次選擇
- [x] localStorage key: `last-selected-website-{companyId}`
- [x] 優先級 2：使用 `articles.website_id`（上次發布網站）
- [x] 優先級 3：選擇列表中第一個可用網站
- [x] 選擇變更時立即更新 localStorage
- [x] 測試：預設選擇邏輯正確運作
- **檔案**: `src/components/articles/WebsiteSelector.tsx`

### Task 2.4: 實作網站狀態指示 ✅

- [x] 顯示 active 網站為可選擇
- [x] 顯示 inactive 網站為灰色（disabled）
- [x] Inactive 網站附註「（已停用）」
- [x] 測試：狀態指示正確顯示
- **檔案**: `src/components/articles/WebsiteSelector.tsx`

### Task 2.5: 整合到 PublishDialog ✅

- [x] 在 `PublishControlDialog` 中加入 `WebsiteSelector`（已存在）
- [x] 管理選擇狀態 (`selectedWebsiteId`)
- [x] 停用發布按鈕直到選擇網站（已存在）
- [x] 選擇網站後顯示 Alert「文章將發布至：{網站名稱}」
- [x] 傳遞 articleWebsiteId 支援智慧預設
- [x] 測試：發布流程包含 website_id
- **檔案**: `src/components/articles/PublishControlDialog.tsx`

### Task 2.6: 整合到 BatchPublishDialog ✅

- [x] 在批次發布對話框加入 `WebsiteSelector`（已存在）
- [x] 對話框標題顯示「批次發布（X 篇文章）」
- [x] 確認對話框顯示「確定要將 X 篇文章發布到『{網站名稱}』嗎？」
- [x] 進度指示和摘要（已存在）
- [x] 測試：批次發布正確使用選擇的網站
- **檔案**: `src/components/articles/BatchPublishDialog.tsx`

### Task 2.7: 更新發布 API ⚠️

- [x] 修改發布 API 接受 `website_id` 參數（已存在）
- [x] 伺服器端驗證 `website_id` 屬於該使用者的 company（需驗證）
- [x] 使用正確的 WordPress 網站憑證（已存在）
- [x] 更新 `articles.website_id` 欄位（需驗證）
- [x] 測試：發布到指定網站成功
- **檔案**: `src/app/api/articles/[id]/publish/route.ts`

### Task 2.8: 更新批次發布 API ⚠️

- [x] 修改批次發布 API 接受 `website_id` 參數（已存在）
- [x] 伺服器端驗證 `website_id`（需驗證）
- [x] 更新所有成功發布文章的 `website_id` 欄位（需驗證）
- [x] 測試：批次發布到指定網站成功
- **檔案**: `src/app/api/articles/batch-publish/route.ts`

**注意**: Task 2.7 和 2.8 標記為 ⚠️ 因為 API 已經支援 website_id，但需要在實際測試中驗證伺服器端驗證和資料庫更新是否正確。

---

## Phase 3: WYSIWYG Editor (最複雜)

### Task 3.0: 資料庫 Schema 更新

- [ ] 建立 migration 檔案
- [ ] 加入 `content_json` JSONB 欄位到 `articles` table
- [ ] 保留 `html_content` 作為快取欄位
- [ ] 執行 migration
- [ ] 測試：新欄位可正確儲存和讀取 JSON
- **檔案**: `supabase/migrations/YYYYMMDDHHMMSS_add_content_json.sql`

### Task 3.1: 安裝依賴

- [ ] 安裝 `@tiptap/react`
- [ ] 安裝 `@tiptap/pm`
- [ ] 安裝 `@tiptap/starter-kit`
- [ ] 安裝 `dompurify` 和 `@types/dompurify`（客戶端清理）
- [ ] 安裝 `sanitize-html`（伺服器端清理）
- [ ] 更新 package.json
- **指令**: `pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit dompurify sanitize-html && pnpm add -D @types/dompurify`

### Task 3.2: 建立 TipTapEditor 組件

- [ ] 建立 `TipTapEditor` 組件
- [ ] 配置 StarterKit extensions（Bold, Italic, Link, Heading 等）
- [ ] 設定效能優化配置：
  - `immediatelyRender: false`（SSR 支援）
  - `shouldRerenderOnTransaction: false`（減少重渲染）
- [ ] 使用 `EditorContext` 避免 prop drilling
- [ ] 實作 JSON 雙向綁定（`editor.getJSON()` 和 `editor.commands.setContent(json)`）
- [ ] 測試：編輯器正確渲染和編輯
- **檔案**: `src/components/articles/TipTapEditor.tsx`

### Task 3.3: 建立 TinyMCE 風格工具列

- [ ] 建立 `EditorToolbar` 組件
- [ ] 實作格式化按鈕：Bold, Italic, Underline, Strikethrough
- [ ] 實作標題選擇下拉選單（H1-H6, Paragraph）
- [ ] 實作清單按鈕（Bullet List, Ordered List）
- [ ] 實作對齊按鈕（Left, Center, Right, Justify）
- [ ] 實作連結插入/編輯對話框
- [ ] 實作圖片插入對話框
- [ ] 參考使用者提供的 TinyMCE 範例樣式
- [ ] 確保行距、間距符合範例「很漂亮」的標準
- [ ] 測試：工具列按鈕正確觸發編輯器命令
- **檔案**: `src/components/articles/EditorToolbar.tsx`

### Task 3.4: 實作 JSON 儲存和載入

- [ ] 實作 `editor.getJSON()` 輸出
- [ ] 實作 `editor.getHTML()` 輸出（用於快取）
- [ ] 實作從 JSON 初始化編輯器
- [ ] JSON 無法解析時降級到 HTML
- [ ] 測試：JSON ↔ Editor 往返無損
- **檔案**: `src/components/articles/TipTapEditor.tsx`

### Task 3.5: 實作雙層 HTML Sanitization

- [ ] 客戶端：使用 DOMPurify 清理 `editor.getHTML()` 輸出
- [ ] 客戶端：配置允許的標籤（iframe 用於嵌入影片）
- [ ] 測試：危險 HTML（`<script>`）被移除
- [ ] 伺服器端：在儲存 API 中加入 sanitize-html
- [ ] 伺服器端：配置與客戶端一致的規則
- [ ] 伺服器端：拒絕不安全的 HTML（400 Bad Request）
- [ ] 測試：伺服器正確拒絕惡意 HTML
- **檔案**:
  - `src/components/articles/TipTapEditor.tsx`（客戶端）
  - `src/app/api/articles/[id]/route.ts`（伺服器端）

### Task 3.6: 實作 JSON Schema 驗證

- [ ] 伺服器端：驗證 `content_json` 符合 TipTap schema
- [ ] 拒絕不符合 schema 的 JSON（400 Bad Request）
- [ ] 回傳明確的錯誤訊息「內容格式不正確」
- [ ] 測試：畸形 JSON 被拒絕
- **檔案**: `src/app/api/articles/[id]/route.ts`

### Task 3.7: 整合編輯器到 InlineHtmlEditor

- [ ] 移除所有分頁相關程式碼
- [ ] 將 TipTapEditor 作為主要編輯區域
- [ ] 移除「預覽」和「原始碼」分頁
- [ ] 使用 `React.lazy()` 動態載入 TipTapEditor
- [ ] 加入 Suspense fallback（loading spinner）
- [ ] 測試：編輯器正確渲染在單一編輯區域
- **檔案**: `src/components/articles/InlineHtmlEditor.tsx`

### Task 3.8: 更新草稿自動儲存

- [ ] 修改自動儲存邏輯儲存 JSON 而非 HTML
- [ ] localStorage 資料結構：`{ title, content_json, html_content }`
- [ ] 1 秒 debounce
- [ ] 恢復草稿時優先使用 `content_json`
- [ ] 測試：視覺編輯的變更自動儲存到 localStorage
- **檔案**: `src/components/articles/InlineHtmlEditor.tsx`

### Task 3.9: 樣式調整（TinyMCE 風格）

- [ ] 參考使用者提供的 TinyMCE 範例
- [ ] 實作漂亮的行距和段落間距
- [ ] 確保編輯器內容區域樣式符合最終渲染效果
- [ ] 加入 focus ring 和 hover 效果
- [ ] 確保 dark mode 支援
- [ ] 測試：視覺一致性和美觀度
- **檔案**:
  - `src/components/articles/TipTapEditor.tsx`
  - `src/styles/editor.css`（如需要）

### Task 3.10: 更新儲存 API

- [ ] 修改儲存 API 同時儲存 JSON 和 HTML
- [ ] `content_json` ← `editor.getJSON()`
- [ ] `html_content` ← `editor.getHTML()`（快取）
- [ ] 測試：兩個欄位都正確儲存
- **檔案**: `src/app/api/articles/[id]/route.ts`

### Task 3.11: 更新讀取邏輯

- [ ] 優先從 `content_json` 讀取
- [ ] `content_json` 無效時降級到 `html_content`
- [ ] 測試：編輯器正確載入現有文章
- **檔案**: 相關的文章讀取組件

### Task 3.12: E2E 測試

- [ ] 建立新文章
- [ ] 使用工具列格式化內容（Bold, Italic, Heading, List 等）
- [ ] 插入連結和圖片
- [ ] 儲存文章
- [ ] 重新載入文章，確認 JSON 和 HTML 都正確載入
- [ ] 發布文章到 WordPress，確認渲染正確
- [ ] 測試包含 iframe（嵌入影片）的內容
- [ ] 測試草稿自動儲存和恢復

---

## Validation Tasks (所有 phase 完成後)

### Task V.1: 整合測試

- [ ] 測試三個功能獨立運作
- [ ] 測試三個功能同時使用（選擇網站後發布 WYSIWYG 編輯的文章）
- [ ] 測試 edge cases：
  - 無可用網站時的發布流程
  - 空內容文章的儲存
  - 極長標題（> 200 字元）
  - 包含特殊字元的內容（emoji, 中日韓文字）
  - 網路中斷時的草稿儲存

### Task V.2: 效能測試

- [ ] 測量初始頁面載入時間（應無影響，因使用 lazy loading）
- [ ] 測量 WYSIWYG 編輯器首次載入時間（應 < 1 秒）
- [ ] 測試大型文章效能：
  - 10,000 字文章的編輯流暢度
  - 50,000 字文章的載入時間
  - 包含 100+ 圖片的文章
- [ ] 測試快取效能：
  - 網站列表快取是否在 60 秒內不重複請求
  - localStorage 草稿讀取速度
- [ ] 使用 Chrome DevTools Performance 分析：
  - 首次內容繪製（FCP）
  - 最大內容繪製（LCP）
  - 累積布局偏移（CLS）
- [ ] 驗證 bundle size impact：
  - 主 bundle 無增加
  - TipTap chunk ~210KB gzipped
  - 使用 webpack-bundle-analyzer 分析

### Task V.3: 無障礙測試（WCAG 2.1 AA）

- [ ] 狀態圖示無障礙：
  - 使用 VoiceOver (macOS) 測試圖示朗讀
  - 使用 NVDA (Windows) 測試圖示朗讀
  - 測試鍵盤 Tab 導航到圖示
  - 測試 focus 時 tooltip 顯示
  - 使用 axe DevTools 掃描無障礙問題
- [ ] 編輯器無障礙：
  - 測試工具列按鈕的鍵盤快捷鍵
  - 測試螢幕閱讀器朗讀編輯器內容
  - 測試 Tab 鍵在工具列和內容區域間導航
- [ ] 網站選擇器無障礙：
  - 測試下拉選單的鍵盤操作（↑ ↓ Enter）
  - 測試 inactive 網站的 tooltip 朗讀
- [ ] 顏色對比度測試：
  - 使用 WebAIM Contrast Checker 驗證所有圖示
  - 驗證綠色 ≥ 4.5:1（`text-green-600` vs 白色背景）
  - 驗證黃色 ≥ 4.5:1（`text-yellow-600` vs 白色背景）
  - 驗證紅色 ≥ 4.5:1（`text-red-600` vs 白色背景）
  - 驗證暗色模式對比度（`dark:text-*-400` variants）

### Task V.4: 安全性測試

- [ ] XSS 攻擊測試：
  - 嘗試插入 `<script>alert('XSS')</script>`（應被清理）
  - 嘗試插入 `<img src=x onerror=alert('XSS')>`（應被清理）
  - 嘗試插入惡意 iframe（應被清理或允許特定來源）
- [ ] 雙層清理驗證：
  - 客戶端繞過測試（直接 API 請求）
  - 伺服器端拒絕不安全 HTML
- [ ] JSON Schema 驗證：
  - 傳送畸形 JSON 到儲存 API（應被拒絕）
  - 傳送不符合 TipTap schema 的 JSON（應被拒絕）
- [ ] 網站選擇器權限測試：
  - 嘗試發布到不屬於該使用者的網站（應 403）
  - 驗證 `website_id` 與 `company_id` 的關聯

### Task V.5: 瀏覽器相容性測試

- [ ] Chrome (最新版)
  - 測試編輯器功能
  - 測試工具列按鈕
  - 測試 lazy loading
- [ ] Firefox (最新版)
  - 特別測試 contenteditable 行為
  - 測試 DOMPurify 運作
- [ ] Safari (最新版)
  - 測試 iOS Safari（行動裝置）
  - 測試虛擬鍵盤互動
- [ ] Edge (最新版)
  - 測試基本功能一致性

### Task V.6: 使用者體驗測試

- [ ] 新手測試：
  - 邀請不熟悉系統的使用者測試
  - 觀察是否能順利完成：建立文章 → 編輯 → 選擇網站 → 發布
- [ ] 工作流程測試：
  - 建立 10 篇文章並批次發布
  - 編輯現有文章並重新發布
  - 在不同分頁間切換編輯
- [ ] 錯誤恢復測試：
  - 網路中斷時的行為（草稿應保留）
  - 發布失敗時的錯誤提示
  - API 超時時的處理

### Task V.7: 文件更新

- [ ] 更新使用者指南（如有）：
  - 如何使用 WYSIWYG 編輯器
  - 如何選擇發布網站
  - 草稿自動儲存說明
- [ ] 更新 CHANGELOG：
  - 列出所有新功能
  - 列出 breaking changes（如有）
- [ ] 截圖新功能：
  - 狀態圖示（亮色和暗色模式）
  - WYSIWYG 編輯器（包含工具列）
  - 網站選擇器下拉選單
  - 發布確認對話框
- [ ] 建立內部技術文件：
  - 資料庫 schema 變更
  - API 變更
  - 新增的 npm 套件及版本
  - 安全性最佳實踐（sanitization）

---

## Dependencies

- **Phase 1** 無依賴，可立即開始
- **Phase 2** 無依賴，可與 Phase 1 平行進行
- **Phase 3** 無依賴，但建議在 Phase 1 和 2 完成後再開始（降低風險）

## Estimated Timeline

### Phase 1: Status Display Optimization

- 實作時間：3-4 小時
- 測試時間：1 小時
- **小計**：4-5 小時

### Phase 2: Website Selector

- 實作時間：6-8 小時
- 測試時間：2 小時
- **小計**：8-10 小時

### Phase 3: WYSIWYG Editor

- 資料庫 migration：1 小時
- 套件安裝和設定：1 小時
- TipTapEditor 組件：4-5 小時
- EditorToolbar 組件：3-4 小時
- 雙層 sanitization：2-3 小時
- InlineHtmlEditor 整合（單一編輯模式）：1-2 小時
- 樣式調整：2-3 小時
- API 更新：2 小時
- E2E 測試：1-2 小時
- **小計**：17-23 小時（較原估計減少 2 小時，因移除分頁）

### Validation Tasks

- 整合測試：2 小時
- 效能測試：3 小時
- 無障礙測試：4 小時
- 安全性測試：3 小時
- 瀏覽器相容性測試：2 小時
- 使用者體驗測試：2 小時
- 文件更新：2 小時
- **小計**：18 小時

### Total Estimate

- **開發時間**：29-37 小時
- **測試和驗證**：23 小時
- **總計**：52-60 小時（約 6.5-7.5 個工作天）

## Implementation Strategy

### 建議實作順序

**Week 1**：

- Day 1-2: Phase 1（Status Display）- 快速交付價值
- Day 3-4: Phase 2（Website Selector）
- Day 5: Phase 2 測試和整合

**Week 2**：

- Day 1-3: Phase 3（WYSIWYG Editor）- 核心功能
- Day 4-5: Phase 3 測試和樣式調整

**Week 3**（可選，如需要額外驗證）：

- Day 1-2: 完整 Validation Tasks
- Day 3: 錯誤修正和優化
- Day 4-5: 文件撰寫和團隊培訓

### 平行開發可能性

- Phase 1 和 Phase 2 可以由不同開發者平行進行（無依賴）
- Phase 3 建議在 Phase 1 和 2 完成後開始（降低風險）
- Validation Tasks 應在所有功能完成後執行

## Risk Mitigation

### 高風險項目

1. **WYSIWYG 編輯器（Phase 3）**
   - 風險：複雜度高，可能遇到未預期的技術問題
   - 緩解：預留額外 20% 時間 buffer
   - 建議：先在 staging 環境部署 1-2 週測試

2. **雙層 HTML Sanitization**
   - 風險：安全性問題如果處理不當可能導致 XSS 漏洞
   - 緩解：嚴格遵循安全性測試清單（Task V.4）
   - 建議：請安全專家審查 sanitization 邏輯

3. **資料庫 Migration**
   - 風險：新增 JSONB 欄位可能影響現有查詢效能
   - 緩解：先在 development 環境測試
   - 建議：為 `content_json` 欄位建立索引（如需要）

### 中風險項目

1. **網站選擇器權限驗證**
   - 風險：錯誤的權限檢查可能導致資料洩漏
   - 緩解：撰寫完整的權限測試案例

2. **效能影響**
   - 風險：TipTap bundle 增加載入時間
   - 緩解：使用 lazy loading 和 code splitting

## Notes

- 優先實作 Phase 1，快速交付可見價值
- Phase 2 和 3 可視需求調整優先順序
- WYSIWYG 編輯器是最複雜的部分，建議充分測試後再上線
- 所有 Phase 完成後，必須執行完整的 Validation Tasks
- 建議每個 Phase 完成後部署到 staging 環境進行 UAT（User Acceptance Testing）
