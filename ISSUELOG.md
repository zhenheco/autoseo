# 問題解決記錄

## 2025-11-04: 升級規則驗證系統實作完成

### 完成項目
✅ **Phase 1**: 修復單次購買核心問題（RLS 和 JSON 解析）
✅ **Phase 2**: 實作完整的升級規則驗證系統
✅ **Phase 3**: 撰寫測試和文件

### 詳細成果

#### Phase 2.1: 創建升級規則驗證函式庫
- 檔案: `src/lib/subscription/upgrade-rules.ts`
- 實作 `TIER_HIERARCHY` 階層定義
- 實作 `canUpgrade()` 函式：驗證升級是否符合業務規則
- 實作 `getUpgradeBlockReason()` 函式：返回升級失敗原因
- 完整的 JSDoc 註解和使用範例

**升級規則**:
- **同階層**: 月繳→年繳→終身 ✅，年繳→月繳 ❌，終身→任何 ❌
- **跨階層**: 只能升級到更高階層 ✅，無法降級 ❌
- **新用戶**: 可訂閱任何方案 ✅

#### Phase 2.2-2.3: Pricing 頁面升級邏輯
- 檔案: `src/app/pricing/page.tsx`
- 實作 `loadUser()` 查詢當前訂閱狀態
- 查詢 `recurring_mandates` 取得 active mandate
- Join `subscription_plans` 取得 plan slug 和 billing period
- 按鈕使用 `canUpgrade()` 驗證，顯示正確的狀態（目前方案/無法升級/開始使用）

#### Phase 2.4: 後端升級驗證
- 檔案: `src/app/api/payment/recurring/create/route.ts`
- 在建立支付前驗證升級規則
- 查詢用戶當前 tierSlug 和 billingPeriod
- 使用 `canUpgrade()` 和 `getUpgradeBlockReason()` 驗證
- 不符合規則時返回 400 錯誤並記錄日誌

#### Phase 2.5: 升級規則測試
- 檔案: `src/lib/subscription/upgrade-rules.test.ts`
- 19 個測試案例，涵蓋所有升級情境
- 測試: 新用戶訂閱、同階層升級/降級、跨階層升級/降級、終身方案限制
- ✅ 所有測試通過

### 相關 Commits
- `67b3499`: 文檔: 記錄 token 包購買問題的成功解決
- `9c4b16c`: 實作升級規則驗證系統（Phase 2.1-2.5）
- 下一個 commit: 修正 getUpgradeBlockReason 邏輯並完成測試

---

## 2025-11-04: 升級規則測試與修正

### 測試過程

#### 建立測試環境
1. **建立測試用戶**: `test-upgrade@zhenhe-co.com`
   - Script: `src/scripts/create-test-user.ts`
   - 公司 tier: free
   - 無 active mandate

2. **建立自動化測試**: `src/scripts/test-upgrade-rules.ts`
   - 6 個端到端測試案例
   - 涵蓋所有升級規則場景

#### 測試結果（第一次）
- **失敗**: Test 2 (同階層升級：月繳→年繳)
- **原因**: `getUpgradeBlockReason()` 返回「無法縮短計費週期」而非 `null`

### 問題分析

**根本原因**:
`getUpgradeBlockReason()` 在處理同階層升級時的邏輯錯誤：

```typescript
// 錯誤邏輯（修正前）
if (targetTierLevel === currentTierLevel) {
  if (currentBillingPeriod === 'yearly' && targetBillingPeriod === 'monthly') {
    return '年繳無法變更為月繳'
  }
  if (currentBillingPeriod === targetBillingPeriod) {
    return '目前方案'
  }
  return '無法縮短計費週期'  // ← 錯誤：月繳→年繳也會返回這個
}
```

**問題**: 當月繳嘗試升級到年繳時：
1. `targetTierLevel === currentTierLevel` ✅ 成立（同階層）
2. `currentBillingPeriod === 'yearly' && targetBillingPeriod === 'monthly'` ❌ 不成立
3. `currentBillingPeriod === targetBillingPeriod` ❌ 不成立
4. 直接返回「無法縮短計費週期」❌ 錯誤！

### 修正方案

**修正邏輯**（明確檢查允許的升級路徑）:
```typescript
if (targetTierLevel === currentTierLevel) {
  if (currentBillingPeriod === targetBillingPeriod) {
    return '目前方案'
  }

  // 月繳 → 年繳或終身 (allowed)
  if (currentBillingPeriod === 'monthly' &&
      (targetBillingPeriod === 'yearly' || targetBillingPeriod === 'lifetime')) {
    return null  // ← 允許升級
  }

  // 年繳 → 終身 (allowed)
  if (currentBillingPeriod === 'yearly' && targetBillingPeriod === 'lifetime') {
    return null  // ← 允許升級
  }

  // 年繳 → 月繳 (blocked)
  if (currentBillingPeriod === 'yearly' && targetBillingPeriod === 'monthly') {
    return '年繳無法變更為月繳'
  }

  return '無法縮短計費週期'
}
```

### 測試結果（修正後）

✅ **所有測試通過！**

1. **自動化測試**: 6/6 通過
   - Test 1: 無訂閱用戶（Free Tier）✅
   - Test 2: 同階層升級（月繳→年繳）✅
   - Test 3: 同階層降級（年繳→月繳）✅
   - Test 4: 跨階層升級（Starter→Business）✅
   - Test 5: 跨階層降級（Business→Starter）✅
   - Test 6: 終身方案限制 ✅

2. **單元測試**: 19/19 通過
   - 所有原有測試保持通過
   - 無回歸問題

3. **TypeScript 類型檢查**: 通過
   - 無類型錯誤

### 經驗教訓

1. **邏輯正確性**: `canUpgrade()` 正確實作了升級規則，但 `getUpgradeBlockReason()` 未完全對應
2. **測試驅動開發**: 自動化測試立即發現了邏輯錯誤
3. **明確性優於簡潔性**: 明確列出所有允許的升級路徑比使用 catch-all 邏輯更可靠
4. **同步函式對**: `canUpgrade()` 和 `getUpgradeBlockReason()` 應該保持邏輯一致

### 相關 Commits
- 下一個 commit: 修正 getUpgradeBlockReason 邏輯並完成所有測試

---

## 2025-11-04: Token 包購買「找不到訂單」問題

### 問題現象
- **症狀**: Token 包購買後，藍新金流回調時報錯「找不到訂單」
- **影響範圍**: 所有單次購買（token 包、終身方案）
- **正常功能**: 定期定額訂閱正常運作

### 錯誤日誌
```
[API Callback] 付款處理失敗: 找不到訂單
訂單已建立: ORD17621952148816159
回調時間差: 22-28 秒
```

### 根本原因分析

#### 調查過程
1. **初步假設**: 資料庫複製延遲
   - ❌ 已有 20 次重試機制，應該足夠

2. **第二假設**: 藍新金流回調格式問題
   - ❌ 解密邏輯正常，定期定額使用相同邏輯成功

3. **第三假設**: 訂單查詢邏輯問題
   - ❌ 查詢邏輯與定期定額相同

4. **最終發現**: **Supabase Client 類型錯誤** ✅

#### 關鍵發現

比對兩個回調路由的代碼：

| 路由 | 使用的 Client | 是否受 RLS 限制 | 結果 |
|------|--------------|----------------|------|
| `/api/payment/recurring/callback` | `createAdminClient()` | ❌ 否 | ✅ 成功 |
| `/api/payment/callback` | `createClient()` | ✅ 是 | ❌ 失敗 |
| `/api/payment/notify` | `createClient()` | ✅ 是 | ❌ 失敗 |

**問題核心**：
- 藍新金流的回調請求**沒有使用者 session**
- `createClient()` 需要使用者 session 才能通過 RLS (Row Level Security)
- `createAdminClient()` 使用 Service Role Key，**繞過 RLS**
- 定期定額一開始就用對了，所以正常
- 單次購買用錯了，所以失敗

### 修正方案

**修改檔案**:
1. `src/app/api/payment/callback/route.ts`
   - 將 `createClient()` 改為 `createAdminClient()`
   - 移除 `await`（Admin client 是同步的）

2. `src/app/api/payment/notify/route.ts`
   - 將 `createClient()` 改為 `createAdminClient()`
   - 移除 `await`

**程式碼變更**:
```typescript
// 修正前 (錯誤)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// 修正後 (正確)
import { createAdminClient } from '@/lib/supabase/server'
const supabase = createAdminClient()
```

### 經驗教訓

1. **外部回調必須使用 Admin Client**
   - 所有來自第三方服務（藍新金流、Line Notify 等）的回調
   - 都沒有使用者 session
   - 必須使用 `createAdminClient()` 繞過 RLS

2. **比對成功案例是關鍵**
   - 定期定額成功 vs token 包失敗
   - 兩者邏輯幾乎相同，差異就在 client 類型
   - 系統性比對找出差異比盲目猜測更有效

3. **日誌的重要性**
   - 詳細的日誌幫助縮小範圍
   - 但有時問題不在日誌顯示的地方
   - 需要從架構層面思考

### 預防措施

1. **建立檢查清單**: 所有 webhook/callback 路由都應使用 Admin Client
2. **代碼審查**: 在 PR 中檢查 payment 相關路由的 client 類型
3. **測試覆蓋**: 為單次購買和定期定額都建立 E2E 測試

### 相關 Commits
- `85ccc47`: 修正: 單次購買公司查詢失敗 - 加入重試機制和診斷日誌（這個其實沒解決問題，但有助於診斷）
- `e081fb9`: 修正: 單次購買回調使用 Admin Client 繞過 RLS（部分修正，但還有問題）
- `65d3b7d`: 診斷: 加入詳細日誌以診斷單次購買解密問題
- 下一個 commit: 修正: 單次購買支援 JSON 格式解析

---

## 2025-11-04: Token 包購買「orderNo 為 undefined」問題（續）

### 新發現的問題
使用 Admin Client 後，RLS 問題解決了，但仍然「找不到訂單」。

### 根本原因
通過詳細日誌發現：

**藍新金流單次購買回傳 JSON 格式**：
```json
{
  "Status": "SUCCESS",
  "Message": "授權成功",
  "Result": {
    "MerchantOrderNo": "ORD17622286946227218",
    "TradeNo": "25110411582872444",
    "Amt": 1299,
    ...
  }
}
```

**但 `decryptCallback` 使用 URLSearchParams 解析**：
```typescript
const params = new URLSearchParams(decryptedData)  // ❌ 錯誤
// 結果: 整個 JSON 字串變成一個 key
{
  "{\"Status\":\"SUCCESS\",...}": 0
}
```

**所以**：
- `decryptedData.MerchantOrderNo` = `undefined` ❌
- `decryptedData.Status` = `undefined` ❌
- 無法取得任何資料

**為什麼定期定額沒問題？**
```typescript
decryptPeriodCallback(period: string) {
  try {
    return JSON.parse(decryptedData)  // ✅ 先嘗試 JSON
  } catch {
    // 失敗才用 URLSearchParams
  }
}
```

### 修正方案
將 `decryptCallback` 改成和 `decryptPeriodCallback` 相同的邏輯：
1. 先嘗試 `JSON.parse()`
2. 失敗才用 `URLSearchParams`（向後兼容）

修改 `handleOnetimeCallback` 處理兩種格式：
1. JSON 格式（有 Result 物件）
2. URLSearchParams 格式（扁平結構）

### 驗證結果
✅ **測試成功！** Token 包購買流程完全正常：
- JSON 格式正確解析
- orderNo 成功取得
- 訂單查詢成功
- Token 餘額正確更新
- 定期定額訂閱繼續正常運作（未受影響）

### 最終修正
- `b251417`: 修正: 單次購買支援 JSON 格式解析（與定期定額相同）

### 關鍵經驗
1. **詳細日誌是關鍵**：通過添加完整的解密資料日誌，立即發現了 JSON 解析問題
2. **比對成功案例**：定期定額和單次購買應該使用相同的解析邏輯
3. **系統性診斷**：
   - 第一層：RLS 權限問題（使用 Admin Client 解決）
   - 第二層：JSON 解析問題（統一解析邏輯解決）
4. **向後兼容**：保留 URLSearchParams 解析，確保舊格式也能正常運作

---
