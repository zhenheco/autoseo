# 修正文章預覽顯示、移除批次清除按鈕（含安全性強化）

## 概述

此變更解決兩個關鍵使用者體驗問題並強化安全性：
1. **文章預覽顯示問題**：目前預覽頁面顯示 Markdown 格式，應改為 HTML 渲染以提供更好的預覽體驗
2. **圖片顯示問題**：預覽頁面中的圖片無法正常顯示，可能因 Markdown 語法無法處理
3. **移除批次清除按鈕**：「清除進行中任務」按鈕功能無效（無法清除任何任務），應完全移除此功能及相關代碼
4. **安全性強化**：實作 HTML 淨化和 Content Security Policy（CSP）防止 XSS 攻擊

**註記**：原計畫包含的 Token 扣款功能修復已分離至獨立的 OpenSpec 變更，因其複雜度較高且需要資料庫 schema 變更。

## 影響範圍

### 前端組件
- `src/app/(dashboard)/dashboard/articles/[id]/preview/page.tsx` - 預覽頁面顯示邏輯
- `src/components/article/ArticleHtmlPreview.tsx` - 新增客戶端 HTML 預覽組件
- `src/app/(dashboard)/dashboard/articles/page.tsx` - 文章列表頁面（移除批次清除按鈕）

### 後端 API
- `src/app/api/articles/jobs/clear/` - 批次清除 API（已移除）

### 安全性工具
- `src/lib/security/html-sanitizer.ts` - HTML 淨化服務
- `src/lib/security/image-validator.ts` - 圖片來源驗證器
- `next.config.js` - CSP 和安全 headers 配置

### 資料庫
- 無需 schema 變更

## 變更原因

### 1. 預覽顯示問題
- **現狀**：預覽頁面使用 `<pre>` 標籤顯示 Markdown 原始碼
- **問題**：使用者無法看到實際的文章排版和圖片
- **目標**：提供所見即所得的 HTML 預覽

### 2. 批次清除功能問題
- **現狀**：按鈕存在但無法清除任何任務（顯示「已清除 0 個任務」）
- **問題**：誤導使用者，造成困擾
- **目標**：完全移除此功能，避免使用者誤會系統有批次操作能力

### 3. 安全性問題
- **現狀**：直接使用 `dangerouslySetInnerHTML` 渲染 AI 生成的 HTML，沒有任何淨化
- **問題**：存在 XSS 攻擊風險，雖然 AI 生成內容較可信，但仍需防護
- **目標**：實作雙重淨化（伺服器端 + 客戶端）和 CSP 防護

## 相關變更

無，此為獨立的 UI/UX 修正和安全性強化。

## 非目標

- 不重新設計預覽頁面的整體佈局
- 不新增批次操作功能（只移除現有無效功能）
- 不實作 Token 扣款功能（已分離至獨立變更）
- 不撰寫單元測試（HTML 淨化和圖片驗證的測試為可選）

## 風險評估

### 低風險
- 預覽顯示改動：僅影響前端顯示邏輯，不影響資料
- 移除批次清除：移除無效功能，降低系統複雜度
- HTML 淨化：DOMPurify 是經過實戰檢驗的成熟函式庫
- CSP 配置：遵循 OWASP 最佳實踐

### 中風險
- CSP 可能影響某些第三方腳本：已配置允許必要的 unsafe-inline 和 unsafe-eval
- 圖片來源限制：需確保所有合法圖片來源都在白名單中

## 驗收標準

### 預覽功能
- [x] 預覽頁面顯示完整的 HTML 渲染內容（使用 ArticleHtmlPreview 組件）
- [x] 文章內的圖片能正常載入和顯示（已配置 CSP 和 next/image remotePatterns）
- [x] 保留 Markdown 原始碼展示（現狀保持）

### 批次清除移除
- [x] 文章列表頁面不再顯示「清除進行中任務」按鈕
- [x] `/api/articles/jobs/clear` API 路由已移除
- [x] 相關前端代碼已清理（handleClearJobs 函式已移除）

### 安全性
- [x] HTML 內容經過 DOMPurify 淨化（客戶端）
- [x] CSP headers 已配置（防止 XSS）
- [x] 圖片來源驗證器已實作（validateImageURL 函式）
- [x] X-Frame-Options, X-Content-Type-Options 等安全 headers 已設定

### 建置驗證
- [x] `npm run build` 成功完成，無 TypeScript 錯誤

## 實施計畫

1. **階段一：預覽顯示修正（含安全性強化）** ✅ 已完成
   - 安裝 isomorphic-dompurify
   - 實作 HTML 淨化服務和圖片驗證器
   - 建立 ArticleHtmlPreview 客戶端組件
   - 修改預覽頁面整合淨化組件
   - 配置 CSP 和安全 headers

2. **階段二：移除批次清除功能** ✅ 已完成
   - 從前端移除按鈕和 handleClearJobs 函式
   - 刪除 `/api/articles/jobs/clear` API 路由
   - 清理相關代碼

3. **階段三：建置驗證** ✅ 已完成
   - 執行 `npm run build` 確認無 TypeScript 錯誤
   - 只有 ESLint 警告（非阻斷性）

4. **階段四：Token 扣款功能** 🔄 已分離至獨立變更
   - 此功能因複雜度較高，已決定分離至新的 OpenSpec 變更
   - 詳見 `tasks.md` 中的註記
