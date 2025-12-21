## 規劃摘要

修復金流授權成功後跳轉到 `/payment/result` 出現 405 Method Not Allowed 錯誤的問題。

## 問題分析

### 現象

- 用戶完成藍新金流授權後，被導向到 `https://1wayseo.com/payment/result?paymentId=xxx&orderId=xxx&status=success`
- 出現 **Error 405 Method Not Allowed**

### 根本原因

1. **金流微服務 SDK** 的 `callbackUrl` 設定為 `/payment/result`
2. 藍新金流授權完成後使用 **POST** 方法將用戶重定向回 `callbackUrl`
3. `/payment/result` 只有 `page.tsx`（React 客戶端頁面），沒有 `route.ts`（API 路由）
4. Next.js 的頁面組件（`page.tsx`）不處理 POST 請求，只處理 GET

### 代碼追蹤

```
payment-service.ts:241  →  callbackUrl: `${baseUrl}/payment/result`
payment-service.ts:490  →  callbackUrl: `${baseUrl}/payment/result`
                                 ↓
                    藍新金流 POST 到此 URL
                                 ↓
                    /payment/result/page.tsx 無法處理
                                 ↓
                         405 Method Not Allowed
```

## 技術選型

### 方案 A：新增 API Route 處理 POST（推薦）

在 `/src/app/payment/result/route.ts` 新增 API 處理：

- 接收藍新金流的 POST 回調
- 解析金流微服務回傳的參數
- 重定向到同路徑的頁面（page.tsx 會處理顯示）

**優點**：

- 不需要修改現有的 SDK 或 payment-service
- 符合金流微服務的設計預期
- 頁面和 API 在同一路徑，架構清晰

**缺點**：

- 需要新增一個檔案

### 方案 B：修改 callbackUrl 使用現有 API

修改 `payment-service.ts` 的 `callbackUrl` 為 `/api/payment/callback`

**優點**：

- 不需要新增檔案

**缺點**：

- 需要修改現有的 `/api/payment/callback/route.ts` 來區分 SDK 模式和直接串接模式
- 增加代碼複雜度
- `/api/payment/callback` 目前的設計是處理藍新加密資料，與 SDK 的回調格式不同

### 決策：採用方案 A

方案 A 更簡潔，且符合金流微服務 SDK 的設計意圖。

## 實作階段

### 第一階段：建立 API Route

**任務 1：建立 `/src/app/payment/result/route.ts`**

```typescript
// 處理金流微服務回調的 POST 請求
// 金流微服務會將藍新的回調結果透過 query params 傳遞
export async function POST(request: NextRequest) {
  // 1. 從 request body 或 query params 取得參數
  // 2. 驗證來源（可選：使用金流微服務的簽名驗證）
  // 3. 重定向到同路徑的頁面，帶上 query params
}

// 保險起見也處理 GET（用戶手動訪問時）
export async function GET(request: NextRequest) {
  // 重定向到頁面
}
```

**任務 2：確認金流微服務回調格式**

根據 SDK 文件，金流微服務回調時會帶上：

- `paymentId`: 付款 ID
- `orderId`: 訂單 ID（我們傳入的 orderNo）
- `status`: 付款狀態 (SUCCESS | FAILED | CANCELLED)

### 第二階段：整合測試

**任務 1：本地測試**

- 使用測試卡號完成付款流程
- 確認 POST 回調正確處理
- 確認頁面正確顯示結果

**任務 2：驗證 Webhook**

- 確認 `/api/payment/gateway-webhook` 也正確收到通知
- 確認業務邏輯正確執行（訂閱啟用、代幣增加）

## 潛在風險

1. **風險 A - 金流微服務回調格式不確定**
   - 解決方案：需要查看金流微服務的實際回調格式，或查閱其文件
   - 可能需要聯繫金流微服務開發者確認

2. **風險 B - 雙重處理**
   - 解決方案：確保 Webhook 和 Callback 的處理邏輯有冪等性
   - `/payment/result` 只負責顯示結果，不執行業務邏輯

3. **風險 C - 安全性驗證**
   - 解決方案：金流微服務應該在 Webhook 中處理業務邏輯
   - Callback 只是用戶體驗，不需要嚴格驗證

## 測試策略

### 單元測試

- 測試 `/payment/result/route.ts` 的 POST 處理
- 測試參數解析和重定向邏輯

### 整合測試

- 使用藍新金流測試環境
- 測試卡號：4000-2211-1111-1111（成功）
- 測試卡號：4000-2211-1111-1112（失敗）

### E2E 測試

- 完整付款流程測試
- 確認訂閱狀態正確更新

## 效能考量

- Route handler 應該快速返回，避免阻塞用戶
- 業務邏輯在 Webhook 中異步處理
- 重定向使用 302 狀態碼

## 安全性考量

- Callback URL 不應執行敏感業務邏輯
- 所有業務邏輯（訂閱啟用、代幣增加）應在 Webhook 中處理
- Webhook 需要驗證簽名

## 參考資料

- 金流微服務 SDK：`src/lib/payment/payment-gateway-client.ts`
- 現有回調處理：`src/app/api/payment/callback/route.ts`
- Webhook 處理：`src/app/api/payment/gateway-webhook/route.ts`

## 待確認事項

1. **金流微服務回調的確切格式**
   - POST body 是什麼格式？
   - 還是使用 query params？
   - 是否有驗證簽名？

2. **金流微服務是否已上線**
   - sandbox 環境是否可用？
   - production 環境狀態？

---

_最後更新：2025-12-22_
