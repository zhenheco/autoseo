# 問題解決記錄

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

### 測試結果
✅ **2025-11-04 測試成功**
- 使用者購買 token 包
- 藍新金流回調正常
- 訂單成功查詢並更新
- Token 正確發放
- 定期定額訂閱依然正常運作

### 相關 Commits
- `b251417`: 修正: 藍新金流單次付款格式兼容 - 支援 JSON 和扁平格式

---
