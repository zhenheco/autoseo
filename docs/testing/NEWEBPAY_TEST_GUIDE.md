# NewebPay 測試環境驗證指引

## 測試環境資訊

- **商店代號**: MS357073141
- **環境**: 測試環境
- **Webhook URL 已更新**: ✅

## Webhook Endpoints 驗證結果

### 1. Callback Endpoint

```
URL: https://1wayseo.com/api/payment/recurring/callback
狀態: ✅ 正常運作
回應: HTTP 307 (重定向到錯誤頁面，因為沒有有效資料)
```

### 2. Notify Endpoint

```
URL: https://1wayseo.com/api/payment/recurring/notify
狀態: ✅ 正常運作
回應: HTTP 405 (Method Not Allowed，因為需要 POST 請求)
```

## 測試流程

### 步驟 1: 使用瀏覽器測試付款流程

1. 開啟瀏覽器前往：https://1wayseo.com
2. 登入測試帳號
3. 前往價格頁面：https://1wayseo.com/pricing
4. 選擇一個訂閱方案
5. 填寫付款資訊（使用測試卡號）

### 步驟 2: 使用 NewebPay 測試卡號

#### 測試信用卡資訊

```
卡號: 4000 2211 1111 1111 (VISA)
或: 5200 0000 0000 0000 (MasterCard)

有效期限: 任何未來日期（如 12/25）
CVV: 任意 3 碼（如 123）
持卡人姓名: TEST USER
```

### 步驟 3: 觀察付款流程

1. **送出付款後**
   - 應該重定向到 NewebPay 付款頁面
   - 填寫測試卡號資訊
   - 確認付款

2. **付款完成後**
   - NewebPay 應該觸發 callback webhook
   - 應該重定向回您的網站
   - 檢查訂閱狀態是否更新

3. **檢查 Vercel 日誌**
   ```bash
   pnpm exec vercel logs --production
   ```
   或前往：https://vercel.com/acejou27s-projects/autopilot-seo/logs

### 步驟 4: 驗證資料庫

使用 Supabase Dashboard 確認：

1. 訂閱記錄已建立
2. 付款記錄已建立
3. 使用者訂閱狀態已更新

## Chrome DevTools 測試

### 開啟 DevTools

```
1. 按 F12 或 Cmd+Option+I (Mac)
2. 切換到 Console 標籤
3. 切換到 Network 標籤
```

### 測試付款流程時檢查

#### Console 標籤

- [ ] 沒有紅色錯誤訊息
- [ ] 沒有黃色警告訊息
- [ ] JavaScript 正常執行

#### Network 標籤

- [ ] 所有請求都成功（綠色或 200 狀態）
- [ ] API 請求正確送出
- [ ] Webhook 回調成功

#### Application 標籤

- [ ] Cookie 正確設定
- [ ] LocalStorage 有訂閱資訊（如果有使用）

## 測試檢查清單

### 前端測試

- [ ] 價格頁面正確顯示
- [ ] 選擇方案功能正常
- [ ] 表單驗證正常
- [ ] 付款按鈕可點擊

### NewebPay 整合

- [ ] 正確重定向到 NewebPay
- [ ] 測試卡號可以使用
- [ ] 付款成功後正確返回
- [ ] Webhook 被觸發

### 後端處理

- [ ] Callback endpoint 收到請求
- [ ] 簽章驗證通過
- [ ] 資料庫正確更新
- [ ] 使用者狀態更新

### 使用者體驗

- [ ] 付款成功訊息顯示
- [ ] 訂閱狀態正確顯示
- [ ] Dashboard 顯示訂閱資訊

## 可能的問題和解決方案

### 問題 1: Webhook 沒有被觸發

**檢查**:

1. NewebPay 後台 webhook URL 是否正確
2. URL 是否包含 `https://`
3. 檢查 Vercel 日誌是否有請求記錄

**解決**:

```bash
# 手動測試 webhook
curl -X POST https://1wayseo.com/api/payment/recurring/callback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Status=SUCCESS&MerchantID=MS357073141"
```

### 問題 2: 簽章驗證失敗

**檢查**:

1. NEWEBPAY_HASH_KEY 是否正確
2. NEWEBPAY_HASH_IV 是否正確
3. 簽章計算邏輯是否正確

**解決**:
在 Vercel Dashboard 重新檢查環境變數

### 問題 3: 資料庫沒有更新

**檢查**:

1. Supabase 連接是否正常
2. 資料庫 schema 是否正確
3. 權限設定是否正確

**解決**:
檢查 Vercel 日誌中的錯誤訊息

## 測試完成後

### 記錄測試結果

```
測試日期: __________
測試者: __________
測試結果: ⬜ 成功 / ⬜ 失敗

成功的項目：
- __________
- __________

失敗的項目：
- __________
- __________

備註：
__________
```

### 下一步

1. ✅ 測試環境驗證完成
2. ⏳ 準備正式環境部署
3. ⏳ 更新正式環境 webhook URL
4. ⏳ 正式環境測試

## 正式環境注意事項

### 切換到正式環境時需要：

1. 更新 NewebPay 商店設定為正式環境
2. 更新環境變數（正式環境的 API URL）
3. 使用真實信用卡測試（小額）
4. 確保有退款機制

### 正式環境 API URL

```
測試環境: https://ccore.newebpay.com/MPG/mpg_gateway
正式環境: https://core.newebpay.com/MPG/mpg_gateway
```

---

**建立日期**: 2025-11-02 16:20
**狀態**: 測試環境 webhook 已設定完成
