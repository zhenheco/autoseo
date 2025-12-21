# 付款表單資料格式錯誤 - 問題診斷與修正規劃

## 規劃摘要

診斷 "付款表單資料格式錯誤" 問題的根本原因，並提供修正方案。

## 問題分析

### 錯誤位置

錯誤發生在 `src/app/(dashboard)/dashboard/billing/authorizing/page.tsx:131`：

```typescript
} catch (error) {
  console.error("[Authorizing] 解析付款表單失敗:", error);
  setErrorMessage("付款表單資料格式錯誤");
}
```

### 數據流追蹤

```
[Frontend Component]
       │
       ▼ POST /api/payment/onetime/create
[AutoSEO API]
       │
       ▼ SDK: createGatewayPayment()
[Gateway API: sandbox.affiliate.1wayseo.com]
       │
       ▼ Response: { success, paymentId, newebpayForm }
[AutoSEO API]
       │
       ▼ Response: { success, paymentForm }
[Frontend Component]
       │
       ▼ JSON.stringify() + encodeURIComponent()
       ▼ router.push(`/authorizing?paymentForm=${encoded}`)
[Authorizing Page]
       │
       ▼ decodeURIComponent() + JSON.parse()
       ▼ Validate: formData.action && formData.fields
       │
       ├─ [成功] → Submit form to 藍新金流
       └─ [失敗] → "付款表單資料格式錯誤"
```

### 預期格式 vs 實際格式

**Gateway 返回格式（正確）：**

```json
{
  "success": true,
  "paymentId": "xxx",
  "newebpayForm": {
    "action": "https://ccore.newebpay.com/MPG/mpg_gateway",
    "method": "POST",
    "fields": {
      "MerchantID": "MS357073141",
      "TradeInfo": "加密資料",
      "TradeSha": "雜湊值",
      "Version": "2.0"
    }
  }
}
```

**Authorizing Page 驗證邏輯：**

```typescript
if (formData.action && formData.fields) {
  // ✅ 新格式 - 應該匹配
}
```

### 測試結果

執行單元測試 `payment-flow.test.ts`：**10/10 通過**

這證明：

1. 數據格式定義正確
2. JSON 編碼/解碼邏輯正確
3. 驗證邏輯正確

## 根本原因分析

### 最可能的原因：Vercel 環境變數未設定

`.env.local` 只在本地開發環境生效。Vercel 部署需要在 Dashboard 中設定環境變數。

**需要設定的變數：**
| 變數名稱 | 值 |
|---------|-----|
| `PAYMENT_GATEWAY_API_KEY` | `4d50d17018eaa...` |
| `PAYMENT_GATEWAY_SITE_CODE` | `1WAYSEO` |
| `PAYMENT_GATEWAY_WEBHOOK_SECRET` | `1eca0da0-1bd4...` |
| `PAYMENT_GATEWAY_ENV` | `sandbox` |

### 其他可能原因

1. **Gateway API 返回錯誤** - SDK 可能沒有正確處理
2. **網路/CORS 問題** - Vercel → Cloudflare Workers 之間
3. **SDK 初始化失敗** - 缺少環境變數導致

## 實作階段

### 第一階段：驗證 Vercel 環境變數

1. 訪問診斷 API：`/api/debug/payment-config`
2. 確認所有環境變數已設定
3. 如未設定，在 Vercel Dashboard 中添加

### 第二階段：添加更詳細的錯誤日誌

修改 `authorizing/page.tsx` 添加錯誤詳情：

```typescript
catch (error) {
  console.error("[Authorizing] 解析付款表單失敗:", {
    error,
    paymentFormParam: paymentForm,
    paymentFormType: typeof paymentForm,
    paymentFormLength: paymentForm?.length,
  });
  // ...
}
```

### 第三階段：添加 API 層錯誤處理

在 `gateway-client.ts` 添加更詳細的錯誤日誌：

```typescript
async createPayment(params): Promise<PaymentResult> {
  console.log("[SDK] 建立付款請求:", {
    url: `${this.config.baseUrl}/api/payment/create`,
    siteCode: this.config.siteCode,
    environment: this.config.environment,
  });
  // ...
}
```

### 第四階段：部署並測試

1. 提交變更到 Git
2. 推送到 GitHub
3. Vercel 自動部署
4. 使用測試卡號進行付款測試

## 潛在風險

1. **環境變數洩露風險** - 診斷 API 已限制為非 production 環境
   - 解決方案：上線前刪除診斷 API

2. **CORS 配置問題** - Vercel 可能無法存取 Cloudflare Workers
   - 解決方案：確認 Gateway CORS 設定允許 `1wayseo.com`

## 測試策略

### 單元測試

- ✅ `payment-flow.test.ts` - 格式驗證（已通過）

### 整合測試

- 手動測試診斷 API
- 手動進行付款流程

### E2E 測試

- 使用測試卡號 `4000-2211-1111-1111` 完成付款

## 效能考量

無特殊效能影響。

## 安全性考量

1. 診斷 API 只在非 production 環境啟用
2. 不記錄完整的 API Key，只記錄前 8 個字元
3. 上線前必須刪除診斷相關代碼

## 參考資料

- 藍新金流 MPG API 文件
- Next.js 環境變數文件：https://nextjs.org/docs/basic-features/environment-variables
- Vercel 環境變數設定：https://vercel.com/docs/concepts/projects/environment-variables

---

_規劃建立於 2025-12-22 04:55_
