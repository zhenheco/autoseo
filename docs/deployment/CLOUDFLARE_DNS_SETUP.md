# Cloudflare DNS 設定指引

## 目標
將 `seo.zhenhe-dm.com` 指向 Vercel 部署

## 步驟 1: 登入 Cloudflare Dashboard

1. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 選擇網域 `zhenhe-dm.com`
3. 點擊左側選單的 **DNS** → **Records**

## 步驟 2: 新增 DNS 記錄

### 選項 A: CNAME Record（推薦）

| 欄位 | 值 |
|------|-----|
| Type | CNAME |
| Name | seo |
| Target | cname.vercel-dns.com |
| Proxy status | **DNS only** (灰色雲朵，關閉 Proxy) |
| TTL | Auto |

**為什麼選擇 DNS only？**
- Vercel 需要直接存取以設定 SSL 憑證
- 啟用 Proxy 會導致 SSL 憑證設定失敗

### 選項 B: A Record

| 欄位 | 值 |
|------|-----|
| Type | A |
| Name | seo |
| IPv4 address | 76.76.21.21 |
| Proxy status | **DNS only** (灰色雲朵，關閉 Proxy) |
| TTL | Auto |

## 步驟 3: 儲存設定

點擊 **Save** 儲存 DNS 記錄

## 步驟 4: 等待 DNS 傳播

DNS 傳播通常需要 **5-30 分鐘**，最多可能需要 48 小時

## 步驟 5: 驗證 DNS 設定

### 使用 dig 查詢
```bash
dig seo.zhenhe-dm.com
```

應該看到：
- CNAME: `seo.zhenhe-dm.com. 300 IN CNAME cname.vercel-dns.com.`
- 或 A: `seo.zhenhe-dm.com. 300 IN A 76.76.21.21`

### 使用 nslookup
```bash
nslookup seo.zhenhe-dm.com
```

### 測試網站
```bash
curl -I https://seo.zhenhe-dm.com
```

應該返回 HTTP 200 或 307 重定向

## 步驟 6: Vercel SSL 憑證

DNS 設定完成後，Vercel 會自動為 `seo.zhenhe-dm.com` 建立 SSL 憑證，這通常需要 **幾分鐘到數小時**。

你可以在 Vercel Dashboard 查看 SSL 狀態：
https://vercel.com/acejou27s-projects/autopilot-seo/settings/domains

## 常見問題

### DNS 記錄已存在
如果已經有 `seo` 的記錄，請：
1. 刪除舊記錄
2. 新增上述的 CNAME 或 A 記錄

### Proxy 狀態錯誤
確保 Proxy status 是 **DNS only**（灰色雲朵），不是 Proxied（橘色雲朵）

### SSL 憑證未生成
1. 確認 DNS 記錄正確
2. 確認 Proxy status 是 DNS only
3. 等待最多 24 小時
4. 如果仍未生成，在 Vercel Dashboard 手動觸發重新生成

## 使用 Cloudflare API 自動設定（進階）

如果你有 Cloudflare API Token，可以使用以下指令：

```bash
# 設定環境變數
export CF_API_TOKEN="your_api_token_here"
export CF_ZONE_ID="your_zone_id_here"

# 新增 CNAME 記錄
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "seo",
    "content": "cname.vercel-dns.com",
    "ttl": 1,
    "proxied": false
  }'
```

## 下一步

DNS 設定完成並傳播後：
1. ✅ 測試 https://seo.zhenhe-dm.com 是否可存取
2. ✅ 更新 NewebPay webhook URL
3. ✅ 測試付款回調功能
4. ✅ 驗證所有功能正常運作
