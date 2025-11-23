# 自訂網域設定指南

## 設定 seo.zhenhe-dm.com 到 Cloudflare Workers

### 步驟 1: 登入 Cloudflare Dashboard

前往 [Cloudflare Dashboard](https://dash.cloudflare.com)

### 步驟 2: 進入 Workers 設定

1. 在左側選單選擇 **Workers & Pages**
2. 找到並點擊 **auto-pilot-seo** Worker
3. 點擊上方的 **Settings** 標籤
4. 在左側選單選擇 **Domains & Routes**

### 步驟 3: 新增自訂網域

1. 點擊 **Add Custom Domain**
2. 輸入網域：`seo.zhenhe-dm.com`
3. 點擊 **Add Domain**

### 步驟 4: 設定 DNS 記錄

Cloudflare 會自動為您建立 DNS 記錄：

- **類型**: CNAME 或 A 記錄
- **名稱**: seo.zhenhe-dm.com
- **目標**: auto-pilot-seo.acejou27.workers.dev

### 步驟 5: 等待生效

DNS 記錄通常在 1-5 分鐘內生效，SSL 憑證可能需要額外幾分鐘。

### 驗證設定

設定完成後，您可以訪問：

- https://seo.zhenhe-dm.com

應該可以正常載入應用程式。

## 測試付款回調

設定完成後，NewebPay 的回調 URL 將會是：

- `https://seo.zhenhe-dm.com/api/payment/recurring/callback`

這樣就能解決原本的 Cloudflare Tunnel Error 1033 問題！

## 故障排除

### DNS 未生效

- 等待 DNS 傳播完成（通常 1-5 分鐘）
- 使用 `nslookup seo.zhenhe-dm.com` 檢查 DNS 記錄

### SSL 憑證錯誤

- Cloudflare 會自動產生 SSL 憑證
- 通常需要幾分鐘時間

### 404 錯誤

- 確認 Worker 已成功部署
- 檢查 wrangler.jsonc 設定是否正確

## 檢查清單

- [ ] 登入 Cloudflare Dashboard
- [ ] 找到 auto-pilot-seo Worker
- [ ] 在 Settings > Domains & Routes 新增 seo.zhenhe-dm.com
- [ ] 確認 DNS 記錄已自動建立
- [ ] 等待 DNS 和 SSL 生效
- [ ] 訪問 https://seo.zhenhe-dm.com 測試
- [ ] 測試付款流程確認回調正常
