# PAYUNi 金流整合完整修復計劃

## 規劃摘要

修復 PAYUNi 付款整合中所有已識別的問題，確保一次性解決所有錯誤。

---

## 問題分析

### 問題 1：API 回應格式不匹配

**現狀**：金流微服務實際回傳格式：

```json
{
  "success": true,
  "paymentId": "xxx",
  "payuniForm": {...}
}
```

**前端期望**：

```json
{
  "success": true,
  "data": {
    "paymentId": "xxx",
    "payuniForm": {...}
  }
}
```

**影響**：前端使用 `result.data?.payuniForm` 取值，永遠是 `undefined`。

### 問題 2：類型定義與實際回應不符

`CreatePaymentResponse` 類型定義期望 `data.payuniForm`，但微服務返回 `payuniForm` 在根層級。

### 問題 3：錯誤處理未顯示完整資訊

錯誤時未能顯示微服務回傳的完整錯誤訊息。

---

## 技術選型

| 技術            | 選擇理由                     |
| --------------- | ---------------------------- |
| 修改類型定義    | 讓類型符合微服務實際回應格式 |
| 更新 SDK 客戶端 | 確保正確處理回應             |
| 更新前端頁面    | 正確提取 payuniForm 資料     |

---

## 實作階段

### 第一階段：修正類型定義

**檔案**：`src/lib/payment/payuni-types.ts`

**修改內容**：

```typescript
/** 建立付款回應 - 符合微服務實際回傳格式 */
export interface CreatePaymentResponse {
  success: boolean;
  /** 付款記錄 ID（成功時） */
  paymentId?: string;
  /** PAYUNi 表單資料（成功時） */
  payuniForm?: PayuniFormData;
  /** 錯誤資訊（失敗時） */
  error?: {
    code: string;
    message: string;
  };
}
```

### 第二階段：修正 SDK 客戶端

**檔案**：`src/lib/payment/payuni-client.ts`

**修改內容**：

1. 增強 API 請求日誌，便於診斷
2. 確保正確解析微服務回應
3. 處理網路錯誤時提供更多資訊

### 第三階段：修正前端頁面

**檔案**：`src/app/(dashboard)/dashboard/admin/payment-test/page.tsx`

**修改內容**：

```typescript
// 原本（錯誤）
if (result.data?.payuniForm) {
  submitPayuniForm(result.data.payuniForm);
}

// 修正後
if (result.payuniForm) {
  submitPayuniForm(result.payuniForm);
}
```

### 第四階段：修正 Admin Test API

**檔案**：`src/app/api/admin/test-payment/route.ts`

**修改內容**：

1. 增強日誌輸出，記錄完整回應
2. 直接返回微服務的回應，不做額外包裝

---

## 關鍵檔案路徑

| 檔案路徑                                                    | 修改內容                          |
| ----------------------------------------------------------- | --------------------------------- |
| `src/lib/payment/payuni-types.ts`                           | 修正 `CreatePaymentResponse` 類型 |
| `src/lib/payment/payuni-client.ts`                          | 增強錯誤處理和日誌                |
| `src/app/(dashboard)/dashboard/admin/payment-test/page.tsx` | 修正 payuniForm 存取路徑          |
| `src/app/api/admin/test-payment/route.ts`                   | 增強日誌輸出                      |

---

## 測試策略

### 手動測試

1. 在 `/dashboard/admin/payment-test` 頁面執行 1 元測試
2. 確認成功跳轉至 PAYUNi 付款頁面
3. 完成付款後確認回調正常

### 驗證點

- [ ] API 回應包含 `payuniForm`
- [ ] 前端正確提取 `payuniForm`
- [ ] 表單成功提交並跳轉至 PAYUNi
- [ ] 付款完成後正確回調

---

## 安全性考量

- API Key 和 Site Code 從環境變數讀取
- 不在日誌中輸出敏感資訊（只輸出是否存在）
- 使用 HTTPS 進行所有通訊

---

## 參考資料

- [金流微服務 SDK 文檔](/Volumes/500G/Claudecode/Finished/affiliate-system/docs/sdk/payment-integration/README.md)
- [微服務 API 實際回應格式](#問題分析)

---

## 執行順序

```
1. 修正類型定義（payuni-types.ts）
2. 更新 SDK 客戶端（payuni-client.ts）
3. 修正前端頁面（payment-test/page.tsx）
4. 更新 API 路由（test-payment/route.ts）
5. 執行本地建置測試
6. 提交並部署
7. 手動測試驗證
```
