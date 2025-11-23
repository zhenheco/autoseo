# Proposal: 修復文章預覽顯示與 Token 扣除邏輯

## Why

用戶回報兩個長期存在的關鍵問題：

1. **文章預覽顯示異常**：文章列表頁面右側預覽區域顯示 Markdown 連結格式（`https://...`）而非渲染後的 HTML 圖片，嚴重影響使用體驗
2. **Token 餘額未扣除**：文章生成完成後，Token 餘額沒有相應減少，導致用戶無法準確追蹤用量，影響計費準確性

這兩個問題直接影響：

- 用戶體驗：無法正常預覽文章內容和圖片
- 商業邏輯：Token 計費不準確，可能造成收入損失
- 系統可信度：用戶對 Token 扣除機制失去信心

此外，從 npm 遷移到 pnpm 後，可能存在幽靈依賴問題，以及 Vercel 出現的 jsdom/parse5 ESM 錯誤，這些都需要一併解決。

## 問題摘要

1. **文章預覽顯示問題**：文章列表頁面右側預覽區域顯示 Markdown 連結格式（如 `https://vidzeroeyingzffixfav.supabase.co/...`）而非渲染後的 HTML 圖片
2. **Token 未扣除問題**：文章生成完成後，Token 餘額沒有相應扣除，導致用戶餘額顯示不正確

## 問題根因分析

### 1. 預覽顯示問題

**現狀**：`src/app/(dashboard)/dashboard/articles/page.tsx:318` 使用 `dangerouslySetInnerHTML` 顯示 `html_content`

**根因**：

- 可能 `html_content` 欄位儲存的是 Markdown 格式而非 HTML
- 或者 HTML 生成階段（HTMLAgent）產生的內容格式不正確
- 需要驗證資料庫中實際儲存的內容格式

### 2. Token 扣除問題

**現狀分析**：

- ✅ `TokenBillingService` 已實作 `completeWithBilling()` 和 `deductTokensIdempotent()` 方法
- ✅ `/api/articles/generate/route.ts:87-101` 在建立 job 前檢查餘額
- ❌ **關鍵問題**：文章生成流程中沒有實際調用 Token 扣除邏輯

**問題細節**：

1. `scripts/process-jobs.ts` 調用 `orchestrator.execute()`
2. `ParallelOrchestrator.execute()` 完成後更新 `article_jobs.status = 'completed'`
3. **但沒有調用 `TokenBillingService.deductTokensIdempotent()` 扣除實際消耗的 Token**

**為什麼沒有扣除？**

- 當前架構在 job 建立時只進行「餘額檢查」（估算）
- 文章生成完成後沒有「實際扣除」步驟
- `TokenBillingService.completeWithBilling()` 是設計給即時 AI 調用的，但並未在多代理架構中使用

## 解決方案

### 方案 1：文章預覽修復

檢查並修正 HTML 內容生成與顯示流程：

1. **驗證資料庫內容格式**
   - 查詢 `generated_articles.html_content` 欄位
   - 確認是否正確儲存為 HTML 格式

2. **修正 HTMLAgent 輸出**
   - 確保 HTMLAgent 產生完整的 HTML（包含圖片標籤）
   - 驗證圖片 URL 是否正確轉換為 `<img>` 標籤

3. **改進前端顯示**
   - 使用 `ArticleHtmlPreview` 組件（已有安全淨化）
   - 確保 DOMPurify 配置允許 `<img>` 標籤和必要屬性

### 方案 2：Token 扣除實作

在文章生成完成時自動扣除 Token：

1. **在 Orchestrator 中整合 Token 扣除**
   - 修改 `ParallelOrchestrator.execute()`
   - 文章完成後調用 `deductTokensIdempotent()`
   - 使用 `articleJobId` 作為 idempotency key

2. **計算實際消耗的 Token**
   - 累積所有 AI 調用的實際 token 使用量
   - 或使用預設值（如 15000 tokens/article）
   - 記錄在 `token_usage_logs` 表

3. **錯誤處理**
   - 如果扣除失敗，不影響文章生成結果
   - 記錄錯誤但繼續完成流程
   - 後續可手動補扣

## 技術考量

1. **Idempotency（冪等性）**
   - 使用 `articleJobId` 確保同一篇文章不會重複扣除
   - 已有 `deductTokensIdempotent()` 支援

2. **Package Manager 相容性**
   - GitHub Actions 已改用 `pnpm`
   - Vercel 部署需確認是否也使用 pnpm
   - 檢查 `package-lock.json` 是否應移除

3. **Database 欄位驗證**
   - 確認 `generated_articles.html_content` 欄位定義
   - 確認 `token_usage_logs` 表結構符合需求

## 預期影響

**修復後效果**：

1. 文章預覽顯示正確的 HTML 內容（含圖片）
2. Token 餘額在文章生成完成後正確扣除
3. 用戶可以準確追蹤 Token 使用情況

**風險評估**：

- **低風險**：Token 扣除邏輯已存在，只需整合到現有流程
- **低風險**：預覽顯示修復不影響資料儲存
- **需驗證**：確保 idempotency 正確運作，避免重複扣除

## 下一步

1. 建立詳細的 `tasks.md`
2. 實作並測試修復方案
3. 在實際環境驗證 Token 扣除邏輯
4. 更新相關文件
