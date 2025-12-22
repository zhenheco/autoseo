# PAYUNi 金流整合 TDD 實作計劃

## 規劃摘要

以 TDD 方式實作 PAYUNi 金流整合，包含：

1. 建立 PAYUNi 客戶端（基於現有 SDK 文檔）
2. 實作 Admin 付款測試頁面（1 元正式環境測試）
3. 刪除所有藍新金流（NewebPay）相關代碼

---

## 技術選型

| 技術                  | 選擇理由                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Vitest                | 專案已使用，支援 ESM 和 TypeScript                                                          |
| Web Crypto API        | 相容 Edge Runtime，用於 HMAC-SHA256 簽名                                                    |
| PAYUNi 金流微服務 SDK | 遵循 `/Volumes/500G/Claudecode/Finished/affiliate-system/docs/sdk/payment-integration` 規格 |

---

## 實作階段

### 第一階段：TDD 測試先行 - PayUniClient

**目標**：先寫測試，再實作 PAYUNi 客戶端

#### 任務 1.1：建立測試檔案

- 建立 `src/lib/payment/__tests__/payuni-client.test.ts`
- 測試案例：
  - SDK 初始化（缺少參數時拋出錯誤）
  - `createPayment()` 單次付款
  - `createPeriodPayment()` 定期定額
  - `verifyWebhook()` 簽名驗證

#### 任務 1.2：建立類型定義

- 建立 `src/lib/payment/payuni-types.ts`
- 定義所有 PAYUNi 相關介面

#### 任務 1.3：實作 PayUniClient

- 建立 `src/lib/payment/payuni-client.ts`
- 基於 SDK 文檔實作（參考 `/Volumes/500G/Claudecode/Finished/affiliate-system/docs/sdk/payment-integration/payment-client.ts`）

---

### 第二階段：TDD 測試先行 - Webhook 處理

#### 任務 2.1：建立 Webhook 測試

- 建立 `src/lib/payment/__tests__/payuni-webhook.test.ts`
- 測試案例：
  - HMAC-SHA256 簽名驗證
  - 時間安全字串比較
  - 事件解析（payment.success, period.authorized 等）

#### 任務 2.2：實作 Webhook 處理器

- 建立 `src/lib/payment/payuni-webhook.ts`

---

### 第三階段：Admin 付款測試頁面

#### 任務 3.1：建立測試頁面

- 建立 `src/app/(dashboard)/dashboard/admin/payment-test/page.tsx`
- 功能：
  - 付款類型選擇（單次 / 定期定額）
  - 金額輸入（預設 1 元）
  - 訂單描述輸入
  - 付款按鈕觸發 PAYUNi 表單提交
  - 顯示付款結果

#### 任務 3.2：建立 API Route

- 建立 `src/app/api/admin/test-payment/route.ts`
- 處理測試付款請求

#### 任務 3.3：更新側邊欄

- 修改 `src/components/dashboard/sidebar.tsx`
- 在 `adminItems` 陣列新增：
  ```typescript
  {
    titleKey: "paymentTest",
    href: "/dashboard/admin/payment-test",
    icon: CreditCard,
  }
  ```

#### 任務 3.4：新增翻譯

- 更新 `src/messages/zh-TW.json`
- 更新 `src/messages/en.json`

---

### 第四階段：重構 PaymentService

#### 任務 4.1：撰寫整合測試

- 更新 `src/lib/payment/__tests__/payment-service.test.ts`

#### 任務 4.2：重構 payment-service.ts

- 移除 NewebPayService 依賴
- 整合 PayUniClient

---

### 第五階段：刪除藍新金流代碼

#### 任務 5.1：刪除核心檔案

- `src/lib/payment/newebpay-service.ts`
- `dist/lib/payment/newebpay-service.js`

#### 任務 5.2：刪除相關目錄

- `newebpay/` 整個目錄

#### 任務 5.3：清理引用

- 移除 `src/lib/security/webhook-validator.ts` 中的 `verifyNewebPayCallback`
- 移除 `src/lib/config/api-endpoints.ts` 中的 `NEWEBPAY_CONFIG`
- 更新 `.env.example` 移除 `NEWEBPAY_*` 環境變數

#### 任務 5.4：清理 API Routes

- 重構或刪除不再需要的藍新相關 routes

---

## 關鍵檔案路徑

### 新建檔案

| 檔案路徑                                                    | 用途              |
| ----------------------------------------------------------- | ----------------- |
| `src/lib/payment/payuni-client.ts`                          | PAYUNi SDK 客戶端 |
| `src/lib/payment/payuni-types.ts`                           | 類型定義          |
| `src/lib/payment/payuni-webhook.ts`                         | Webhook 處理      |
| `src/lib/payment/__tests__/payuni-client.test.ts`           | SDK 單元測試      |
| `src/lib/payment/__tests__/payuni-webhook.test.ts`          | Webhook 測試      |
| `src/app/(dashboard)/dashboard/admin/payment-test/page.tsx` | 測試頁面          |
| `src/app/api/admin/test-payment/route.ts`                   | 測試付款 API      |

### 修改檔案

| 檔案路徑                               | 修改內容                      |
| -------------------------------------- | ----------------------------- |
| `src/components/dashboard/sidebar.tsx` | 新增付款測試連結到 adminItems |
| `src/lib/payment/payment-service.ts`   | 移除 NewebPay，整合 PAYUNi    |
| `src/messages/zh-TW.json`              | 新增翻譯鍵值                  |
| `src/messages/en.json`                 | 新增翻譯鍵值                  |
| `.env.example`                         | 更新環境變數說明              |

### 刪除檔案

| 檔案路徑                               | 說明         |
| -------------------------------------- | ------------ |
| `src/lib/payment/newebpay-service.ts`  | 藍新核心服務 |
| `newebpay/*.pdf`                       | 藍新技術文檔 |
| `dist/lib/payment/newebpay-service.js` | 編譯輸出     |

---

## 環境變數

```bash
# PAYUNi 金流微服務（新增）
PAYUNI_API_KEY=your_api_key
PAYUNI_SITE_CODE=your_site_code
PAYUNI_WEBHOOK_SECRET=your_webhook_secret
PAYUNI_ENVIRONMENT=production

# 移除以下藍新相關變數
# NEWEBPAY_MERCHANT_ID
# NEWEBPAY_HASH_KEY
# NEWEBPAY_HASH_IV
# NEWEBPAY_API_URL
# ... 等
```

---

## 測試策略

### 單元測試

```bash
pnpm test src/lib/payment/__tests__/payuni-client.test.ts
pnpm test src/lib/payment/__tests__/payuni-webhook.test.ts
```

### 測試案例清單

**PayUniClient 測試：**

- ✅ 初始化成功
- ✅ 缺少 apiKey 時拋出錯誤
- ✅ 缺少 siteCode 時拋出錯誤
- ✅ createPayment 成功建立單次付款
- ✅ createPeriodPayment 成功建立定期定額
- ✅ 金額驗證（必須 > 0）
- ✅ API 錯誤處理

**Webhook 測試：**

- ✅ 簽名驗證成功
- ✅ 簽名驗證失敗
- ✅ 解析 payment.success 事件
- ✅ 解析 period.authorized 事件
- ✅ 無效 JSON 拋出錯誤

---

## 安全性考量

1. **HMAC-SHA256 簽名驗證**
   - 使用 Web Crypto API
   - 時間安全字串比較（防止 timing attack）

2. **環境變數**
   - API Key 和 Secret 不可硬編碼
   - 使用 `.env.local` 儲存

3. **Admin 權限檢查**
   - 測試頁面僅 super-admin 可見
   - 驗證 `NEXT_PUBLIC_SUPER_ADMIN_EMAILS`

---

## 潛在風險

| 風險                       | 解決方案                             |
| -------------------------- | ------------------------------------ |
| 刪除藍新代碼後現有訂單失效 | 保留資料庫表格結構，只移除服務層代碼 |
| PAYUNi API 變更            | 基於 SDK 文檔實作，保持介面一致      |
| Webhook 驗證失敗           | 完整單元測試覆蓋簽名邏輯             |

---

## 參考資料

- [PAYUNi SDK 文檔](/Volumes/500G/Claudecode/Finished/affiliate-system/docs/sdk/payment-integration/)
- [PAYUNi 官方 API 文檔](https://www.payuni.com.tw/docs/web/)
- [PAYUNi GitHub](https://github.com/payuni)

---

## 執行順序

```
1. 撰寫 PayUniClient 測試（紅燈）
2. 實作 PayUniClient（綠燈）
3. 撰寫 Webhook 測試（紅燈）
4. 實作 Webhook 處理（綠燈）
5. 建立 Admin 測試頁面
6. 更新側邊欄
7. 手動測試正式環境 1 元付款
8. 確認一切正常後刪除藍新代碼
```
