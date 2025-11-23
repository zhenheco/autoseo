# NewebPay Webhook URL 更新指引

## 背景

從 Cloudflare Tunnel 遷移到 Vercel 後，需要更新 NewebPay 的 webhook URL 設定。

## 新的 Webhook URL

### 付款回調（Callback）

```
https://seo.zhenhe-dm.com/api/payment/recurring/callback
```

### 付款通知（Notify）

```
https://seo.zhenhe-dm.com/api/payment/recurring/notify
```

## 更新步驟

### 步驟 1: 登入 NewebPay 商店後台

1. 前往 [NewebPay 商店後台](https://www.newebpay.com/)
2. 使用商店帳號登入
   - 商店代號：MS357073141

### 步驟 2: 更新 Webhook 設定

1. 點擊 **系統設定** → **API 設定**
2. 找到 **信用卡定期定額** 或 **定期定額委託** 設定
3. 更新以下欄位：

#### 委託回傳網址（Callback URL）

```
https://seo.zhenhe-dm.com/api/payment/recurring/callback
```

#### 通知網址（Notify URL）

```
https://seo.zhenhe-dm.com/api/payment/recurring/notify
```

4. 點擊 **儲存** 或 **更新**

### 步驟 3: 驗證 Webhook 設定

NewebPay 通常會提供測試工具或發送測試通知。請使用以下方式驗證：

#### 使用 NewebPay 測試工具

1. 在後台找到 **測試工具** 或 **API 測試**
2. 發送測試請求到新的 webhook URL
3. 檢查是否收到成功回應

#### 手動測試

```bash
# 測試 webhook endpoint 是否可訪問
curl -I https://seo.zhenhe-dm.com/api/payment/recurring/callback

# 應該返回 HTTP 200 或 405 (Method Not Allowed, 因為只接受 POST)
```

### 步驟 4: 測試實際付款流程

1. 在測試環境進行一筆測試交易
2. 檢查 Vercel 日誌確認 webhook 被觸發
3. 確認資料庫正確更新訂閱狀態

```bash
# 查看 Vercel 日誌
pnpm exec vercel logs --production

# 或在 Vercel Dashboard 查看
https://vercel.com/acejou27s-projects/autopilot-seo/logs
```

## 重要注意事項

### SSL/TLS 要求

- ✅ NewebPay 要求 webhook URL 使用 HTTPS
- ✅ 我們的網站已配置 SSL 憑證（Vercel 自動提供）
- ✅ 網址：https://seo.zhenhe-dm.com

### IP 白名單（如有需要）

如果 NewebPay 需要設定 IP 白名單，請使用 Vercel 的 IP 範圍：

```bash
# 查詢 Vercel 的 IP
dig seo.zhenhe-dm.com +short

# 當前 IP:
# 76.76.21.22
# 66.33.60.34
```

**注意**: Vercel 的 IP 可能會變動，建議不要使用 IP 白名單，而是使用簽章驗證。

### 簽章驗證

NewebPay 使用 HashKey 和 HashIV 進行簽章驗證，確保環境變數正確設定：

```bash
# 在 Vercel Dashboard 確認這些環境變數：
NEWEBPAY_MERCHANT_ID=MS357073141
NEWEBPAY_HASH_KEY=7hyqDDb3qQmHfz1BDF5FqYtdlshGAvPQ
NEWEBPAY_HASH_IV=CGFoFgbiAPYMbSlP
NEWEBPAY_API_URL=https://ccore.newebpay.com/MPG/mpg_gateway
```

## 舊 vs 新 Webhook URL

| 項目     | 舊 URL（Cloudflare Tunnel）     | 新 URL（Vercel）                | 狀態      |
| -------- | ------------------------------- | ------------------------------- | --------- |
| 基礎域名 | seo.zhenhe-dm.com               | seo.zhenhe-dm.com               | ✅ 相同   |
| 協議     | HTTPS                           | HTTPS                           | ✅ 相同   |
| Callback | /api/payment/recurring/callback | /api/payment/recurring/callback | ✅ 相同   |
| Notify   | /api/payment/recurring/notify   | /api/payment/recurring/notify   | ✅ 相同   |
| 底層架構 | Cloudflare Tunnel → 本地伺服器  | Vercel Serverless               | ⚠️ 已變更 |

**重點**: URL 路徑完全相同，只是底層架構從 Cloudflare Tunnel 改為 Vercel Serverless。

## 測試檢查清單

- [ ] 登入 NewebPay 後台
- [ ] 更新 Callback URL
- [ ] 更新 Notify URL
- [ ] 儲存設定
- [ ] 使用測試工具驗證
- [ ] 執行測試交易
- [ ] 檢查 Vercel 日誌
- [ ] 確認資料庫更新正確
- [ ] 測試完整付款流程（從選擇方案到訂閱成功）

## 疑難排解

### 問題 1: Webhook 沒有被觸發

**檢查項目**:

1. NewebPay 後台的 URL 是否正確（包含 https://）
2. URL 是否可以從公網訪問（`curl -I https://seo.zhenhe-dm.com/api/payment/recurring/callback`）
3. Vercel 是否正常運行（https://vercel.com/acejou27s-projects/autopilot-seo）

### 問題 2: Webhook 返回錯誤

**檢查項目**:

1. 檢查 Vercel 日誌中的錯誤訊息
2. 確認環境變數正確設定（特別是 NEWEBPAY_HASH_KEY 和 NEWEBPAY_HASH_IV）
3. 檢查簽章驗證邏輯是否正確

### 問題 3: 資料庫未更新

**檢查項目**:

1. 檢查 webhook handler 的邏輯
2. 確認資料庫連接正常（SUPABASE_DB_URL）
3. 檢查交易資料格式是否符合預期

## 聯絡資訊

### NewebPay 客服

- 客服電話：(02) 2718-6898
- 服務時間：週一至週五 09:00-18:00
- Email：service@newebpay.com

### 技術支援

- NewebPay 技術文件：https://www.newebpay.com/website/Page/content/download_api
- 測試環境：https://ccore.newebpay.com/
- 正式環境：https://core.newebpay.com/

## 完成確認

更新完成後，請在此記錄：

**更新日期**: ****\_\_\_\_****
**更新者**: ****\_\_\_\_****
**測試結果**: ⬜ 成功 / ⬜ 失敗
**備註**: ****\_\_\_\_****

---

**最後更新**: 2025-11-02 16:10
**狀態**: 待更新
