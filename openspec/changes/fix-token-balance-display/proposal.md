# Proposal: 修正 Token 餘額和訂閱顯示錯誤

## Why

用戶回報 Dashboard 和訂閱頁面顯示的 Token 餘額不正確，且購買方案時出現「找不到公司資料」錯誤。這些問題影響用戶體驗，可能導致用戶對系統產生不信任，並阻礙購買流程。

具體問題：
1. 免費方案應該顯示 10,000 tokens，但實際顯示 20,000
2. 訂閱頁面的月配額、購買 tokens、配額重置日顯示錯誤
3. 購買方案時出現錯誤：「找不到公司資料」
4. 文章生成功能可能存在錯誤（需進一步診斷）

## 概述

修正 Dashboard 和訂閱頁面中顯示的 Token 餘額、購買 Token 數量、配額重置日期等資料不正確的問題。

## 問題描述

根據用戶提供的截圖和錯誤描述，發現以下問題：

1. **Token 餘額顯示錯誤**
   - Dashboard 顯示 20,000 tokens，但免費方案應該是 10,000 tokens（一次性）
   - 資料來源混亂：部分顯示來自硬編碼，部分來自資料庫

2. **訂閱頁面資料錯誤**
   - 「月配額剩餘」顯示 0/0
   - 「購買 tokens」顯示 20,000（應該是 10,000）
   - 「配額重置日」顯示「無」（免費方案正確）
   - Token 餘額顯示 20,000（錯誤）

3. **購買方案時出現錯誤**
   - 錯誤訊息：「找不到公司資料」
   - 位置：`src/app/api/payment/recurring/create/route.ts:74`

4. **文章生成功能錯誤**
   - 輸入關鍵字生成標題時出現錯誤（需要更多資訊來診斷）

## 根本原因分析

### 1. 免費方案 Token 配置不一致

根據 `supabase/migrations/20251106000000_add_free_plan.sql`:
- 免費方案應該提供 **10,000 tokens**（一次性）
- `monthly_token_quota = 0`（標記為免費方案）
- `purchased_token_balance = 10,000`（一次性配額）

但實際顯示為 20,000，可能原因：
- 資料庫中的實際資料與遷移腳本不一致
- 前端組件使用了錯誤的硬編碼值
- API 回傳的資料計算邏輯錯誤

### 2. 公司資料查詢失敗

在 `src/app/api/payment/recurring/create/route.ts:66-76`:
```typescript
const { data: company } = await authClient
  .from('companies')
  .select('subscription_tier, subscription_period')
  .eq('id', companyId)
  .single()

if (!company) {
  return NextResponse.json(
    { error: '找不到公司資料' },
    { status: 404 }
  )
}
```

可能原因：
- **帳號重置導致資料不一致**：根據 `scripts/complete-reset-ace-fixed.sql`，ace@zhenhe-co.com 帳號曾經被重置過，可能導致：
  - `company_members` 記錄缺失或狀態不正確
  - `companies` 記錄缺失
  - `company_subscriptions` 記錄缺失或重複
- `companyId` 無效或不存在
- RLS 政策阻止查詢
- 資料庫中缺少公司記錄

## 解決方案

### 1. 統一 Token 餘額資料來源

**問題**：
- Dashboard (`src/app/(dashboard)/dashboard/page.tsx:32-48`) 直接從 `company_subscriptions` 計算餘額
- API (`src/app/api/token-balance/route.ts`) 也從同一表查詢
- 但兩者的計算邏輯應該一致

**解決**：
- 確保免費方案的判斷邏輯一致：`monthly_token_quota === 0`
- 免費方案只顯示 `purchased_token_balance`
- 付費方案顯示 `monthly_quota_balance + purchased_token_balance`

### 2. 修正資料庫資料

**問題**：
- 免費方案的 `purchased_token_balance` 應該是 10,000，但可能被設定為 20,000

**解決**：
- 建立遷移腳本修正免費方案用戶的 Token 餘額
- 確保所有免費方案的公司都有正確的配額

### 3. 修正「找不到公司資料」錯誤

**問題**：
- 購買方案時無法查詢到公司資料

**解決**：
- 加強錯誤日誌，記錄 `companyId` 和查詢條件
- 檢查 RLS 政策是否正確
- 在建立訂單前驗證公司存在性

### 4. 改善錯誤處理和日誌

**問題**：
- 文章生成錯誤缺乏詳細資訊
- 購買流程的錯誤訊息不夠清楚

**解決**：
- 加強 API 錯誤日誌
- 回傳更詳細的錯誤訊息給前端
- 實作統一的錯誤處理機制

## 影響範圍

### 修改的檔案

1. **資料庫遷移**
   - 新增遷移腳本修正免費方案 Token 餘額

2. **API Routes**
   - `src/app/api/token-balance/route.ts`：確保計算邏輯正確
   - `src/app/api/payment/recurring/create/route.ts`：加強錯誤處理

3. **前端組件**
   - `src/components/billing/TokenBalanceDisplay.tsx`：移除硬編碼值
   - `src/components/dashboard/TokenBalanceCard.tsx`：確保顯示邏輯正確
   - `src/app/(dashboard)/dashboard/page.tsx`：統一計算邏輯
   - `src/app/(dashboard)/dashboard/subscription/page.tsx`：修正顯示資料

### 不影響的功能

- 付費方案的 Token 計算（僅修正免費方案）
- Token 消耗邏輯
- 支付流程（僅修正錯誤處理）

## 驗證計畫

### 1. 單元測試

- 測試免費方案和付費方案的 Token 計算邏輯
- 測試 `/api/token-balance` 回傳正確資料

### 2. 整合測試

- 建立測試公司（免費方案和付費方案）
- 驗證 Dashboard 顯示正確的 Token 餘額
- 驗證訂閱頁面顯示正確的資料
- 驗證購買流程不會出現「找不到公司資料」錯誤

### 3. 手動測試

- 登入免費方案帳號，檢查顯示 10,000 tokens
- 登入付費方案帳號，檢查顯示正確的月配額和購買 tokens
- 嘗試購買方案，確認不會出現錯誤
- 測試文章生成功能

## 風險評估

### 低風險

- 修正顯示邏輯（不影響實際 Token 計算）
- 資料庫遷移（僅修正免費方案餘額）

### 中風險

- 修改 Token 計算邏輯（需要完整測試）
- 修改購買流程（需要測試支付功能）

### 緩解措施

- 在 staging 環境完整測試
- 保留資料庫備份
- 分階段部署（先修正顯示，再修正計算邏輯）

## 實作順序

1. **第一階段：診斷**（優先）
   - 查詢資料庫確認免費方案的實際配額
   - 追蹤「找不到公司資料」錯誤的根本原因
   - 重現文章生成錯誤

2. **第二階段：修正資料**
   - 建立遷移腳本修正免費方案 Token 餘額
   - 執行遷移並驗證

3. **第三階段：修正代碼**
   - 統一 Token 計算邏輯
   - 移除硬編碼值
   - 加強錯誤處理

4. **第四階段：測試和部署**
   - 執行完整測試
   - 部署到 production
   - 監控錯誤日誌

## 時間估計

- 診斷和分析：1-2 小時
- 實作修正：2-3 小時
- 測試和驗證：1-2 小時
- **總計：4-7 小時**

## 相關文件

- `supabase/migrations/20251106000000_add_free_plan.sql`：免費方案定義
- `src/app/api/token-balance/route.ts`：Token 餘額 API
- `src/components/billing/TokenBalanceDisplay.tsx`：Token 餘額顯示組件
- `openspec/specs/subscription-display/spec.md`：訂閱顯示規格（如果存在）
