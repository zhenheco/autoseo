# Proposal: 修復 Credit 顯示與訂閱方案問題

## 問題描述

### 問題 1: Token/Credit 命名不統一

**現況**:

- 文章管理頁面顯示「Token 餘額」
- 訂閱頁面顯示「Credit 餘額」
- 資料庫欄位使用 `token_balance`, `monthly_token_quota` 等 token 字眼
- 程式碼中混用 Token 和 Credit 術語

**影響**:

- 用戶體驗不一致，造成困惑
- 品牌識別度降低
- 文件和程式碼維護困難

### 問題 2: 訂閱方案顯示錯誤

**現況**:

- 訂閱頁面顯示方案類型為 "basic"
- 但 `subscription_plans` 表中只有 FREE, STARTER, PROFESSIONAL, BUSINESS, AGENCY
- `companies.subscription_tier = 'basic'` 是無效值

**根本原因**:

- 訂閱頁面優先顯示 `companies.subscription_tier` (line 86-88)
- 應該優先顯示 `company_subscriptions.subscription_plans.name`
- 資料庫中存在歷史遺留的 'basic' tier 值

**影響**:

- 用戶看到無效的方案名稱
- 與 /pricing 頁面不一致
- 可能影響訂閱邏輯判斷

### 問題 3: HTML 預覽顯示 Markdown

**現況**:

- 文章列表右側預覽仍顯示 Markdown 格式（例如 `##`, `**`）
- 資料庫驗證顯示 `html_content` 欄位包含 Markdown 而非 HTML
- WritingAgent 已添加調試日誌但尚未看到輸出

**影響**:

- 用戶無法正確預覽文章
- 影響內容審核和編輯體驗

## 解決方案

### 方案 1: 統一使用 "Credit" 命名 ✅

**範圍**: 前端 UI 層
**影響**: 低風險（僅文字變更）

**變更清單**:

1. **文章管理頁面** (`src/components/billing/TokenBalanceDisplay.tsx`)
   - "Token 餘額" → "Credit 餘額"

2. **訂閱頁面** (`src/app/(dashboard)/dashboard/subscription/page.tsx`)
   - 已使用 "Credit"，保持不變

3. **其他頁面**
   - 搜尋所有 "Token 餘額"、"Token Balance" 等字眼並統一替換為 Credit

**注意事項**:

- **資料庫欄位名稱不變**: 保持 `token_balance`, `token_quota` 等，避免大規模遷移
- **程式碼內部變數名稱不變**: 僅修改面向用戶的 UI 文字
- **API 回應欄位名稱不變**: 保持向後相容

### 方案 2: 修正訂閱方案顯示邏輯 ✅

**變更位置**: `src/app/(dashboard)/dashboard/subscription/page.tsx:86-88`

**修改前**:

```typescript
{
  company.subscription_tier === "free"
    ? "免費方案"
    : (companySubscription?.subscription_plans as { name?: string } | null)
        ?.name || company.subscription_tier;
}
```

**修改後**:

```typescript
{
  (companySubscription?.subscription_plans as { name?: string } | null)?.name ||
    (company.subscription_tier === "free" ? "免費方案" : "未知方案");
}
```

**邏輯變更**:

1. 優先顯示 `company_subscriptions.subscription_plans.name` (正確來源)
2. 如果沒有，檢查是否為 'free' 顯示「免費方案」
3. 其他情況顯示「未知方案」（而非 'basic' 等無效值）

**資料庫修正** (可選，建議在後續執行):

```sql
-- 將所有 'basic' tier 更新為正確的方案
UPDATE companies
SET subscription_tier = 'starter'
WHERE subscription_tier = 'basic';
```

### 方案 3: 診斷並修復 HTML 轉換問題 🔍

**步驟 1: 驗證資料庫內容**

- ✅ 已確認 `html_content` 包含 Markdown
- ✅ 已添加 WritingAgent 調試日誌

**步驟 2: 生成測試文章**

- 選擇一個新關鍵字生成文章
- 查看 GitHub Actions 或 Vercel 日誌中的 WritingAgent 輸出
- 確認 `marked.parse()` 是否正確執行

**步驟 3: 根據日誌診斷**
可能原因:

1. `marked.parse()` 異步失敗但未拋出錯誤
2. `cleanedMarkdown` 變數在傳入前被修改
3. 資料庫儲存時誤用了 `markdown_content`

**步驟 4: 修復**

- 如果是 marked 問題：考慮降級或使用替代方案
- 如果是邏輯問題：修正 WritingAgent 或 article-storage 的程式碼

## 優先級

1. **高優先級** (立即修復):
   - 方案 2: 修正訂閱方案顯示（影響用戶信任）

2. **中優先級** (本次一併修復):
   - 方案 1: 統一 Credit 命名（提升一致性）

3. **待驗證** (需要更多資訊):
   - 方案 3: HTML 轉換問題（需要實際文章生成日誌）

## 成功標準

### 方案 1

- [ ] 所有面向用戶的介面統一顯示 "Credit" 而非 "Token"
- [ ] 不影響現有功能運作
- [ ] 通過前端測試

### 方案 2

- [ ] 訂閱頁面不再顯示 "basic" 或其他無效方案名稱
- [ ] 顯示的方案名稱與 /pricing 一致
- [ ] 免費方案正確顯示「免費方案」
- [ ] 付費方案顯示正確的方案名稱（STARTER, PROFESSIONAL 等）

### 方案 3

- [ ] 資料庫中新生成文章的 `html_content` 包含正確的 HTML 格式
- [ ] 文章預覽正確顯示渲染後的 HTML
- [ ] 不再出現 Markdown 語法（##, \*\*, 等）

## 風險評估

### 低風險

- 方案 1: 純文字變更，不影響邏輯
- 方案 2: 簡單邏輯修正，向後相容

### 需要驗證

- 方案 3: 需要實際測試確認問題，可能需要更深入的程式碼變更

## 後續建議

1. **資料庫清理**:
   - 統一清理所有 `companies.subscription_tier = 'basic'` 的記錄
   - 建立資料驗證規則防止無效 tier 值

2. **監控**:
   - 部署後監控訂閱頁面錯誤率
   - 追蹤 Credit 餘額扣除是否正常

3. **文件更新**:
   - 更新開發文件，明確規範使用 "Credit" 而非 "Token"
   - 更新 API 文件說明欄位名稱（資料庫用 token，UI 顯示 credit）
