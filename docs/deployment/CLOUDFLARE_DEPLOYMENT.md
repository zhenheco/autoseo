# Cloudflare Workers 部署指南

本專案使用 OpenNext 部署到 Cloudflare Workers，支援 Next.js 16 SSR 功能。

## 前置準備

已完成的配置：

- ✅ 安裝 `@opennextjs/cloudflare` 和 `wrangler`
- ✅ 建立 `wrangler.jsonc` 配置檔
- ✅ 建立 `open-next.config.ts` 配置檔
- ✅ 更新 `next.config.js` 加入 `standalone` 輸出
- ✅ 更新 `.gitignore` 忽略 Cloudflare 相關檔案

## 部署步驟

### 1. 設定環境變數

執行以下腳本將所有環境變數設定到 Cloudflare：

```bash
./scripts/setup-cf-secrets.sh
```

驗證環境變數是否設定成功：

```bash
npx wrangler secret list --name auto-pilot-seo
```

### 2. 本地預覽測試

在部署到生產環境前，先在本地測試 Worker：

```bash
npm run preview:cf
```

這會：

1. 執行 `next build` 建置專案
2. 執行 OpenNext 建置產生 Worker 程式碼
3. 啟動本地 Worker 伺服器

測試項目：

- [ ] 首頁載入正常
- [ ] 語系切換功能正常
- [ ] API 路由運作正常
- [ ] 資料庫連接正常
- [ ] 認證功能正常

### 3. 部署到 Cloudflare

測試通過後，執行部署指令：

```bash
npm run deploy:cf
```

部署完成後，Cloudflare 會提供一個 Worker URL，格式如下：

```
https://auto-pilot-seo.<your-subdomain>.workers.dev
```

### 4. 驗證部署

使用 `curl` 測試部署的 Worker：

```bash
# 測試首頁
curl -I https://auto-pilot-seo.<your-subdomain>.workers.dev

# 測試語系路徑
curl -I https://auto-pilot-seo.<your-subdomain>.workers.dev/zh
curl -I https://auto-pilot-seo.<your-subdomain>.workers.dev/en

# 測試 API
curl https://auto-pilot-seo.<your-subdomain>.workers.dev/api/health
```

### 5. 查看即時日誌

使用 wrangler tail 監控 Worker 運行狀況：

```bash
npx wrangler tail auto-pilot-seo --format pretty
```

在另一個終端執行請求，即可看到即時日誌。

## 常見問題

### TypeScript 編譯錯誤

如果在建置時遇到類型錯誤，執行：

```bash
npm run type-check
```

系統性修復所有類型錯誤後再重新建置。

### 環境變數未生效

確認環境變數已正確設定：

```bash
npx wrangler secret list --name auto-pilot-seo
```

如需重新設定單個環境變數：

```bash
npx wrangler secret put VARIABLE_NAME --name auto-pilot-seo <<< "value"
```

### Standalone 目錄結構錯誤

確認 `next.config.js` 包含以下設定：

```javascript
output: 'standalone',
outputFileTracingRoot: require('path').join(__dirname),
```

檢查建置輸出：

```bash
ls .next/standalone/.next/server/pages-manifest.json
```

如果找不到檔案，表示 `outputFileTracingRoot` 配置有誤。

### 資料庫連接失敗

Cloudflare Workers 需要使用連接池連接 Supabase：

- ✅ 正確：`postgresql://...pooler.supabase.com:5432/postgres`
- ❌ 錯誤：`postgresql://...supabase.co:5432/postgres`

確認 `SUPABASE_DB_URL` 環境變數包含 `pooler`。

## 效能優化

### 快取策略

在 `open-next.config.ts` 中配置快取：

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // 設定快取策略
});
```

### 監控與分析

使用 Cloudflare Dashboard 查看：

- Workers 日誌
- CPU 使用時間
- 記憶體使用量
- 請求數量

## 回滾到先前版本

查看部署歷史：

```bash
npx wrangler deployments list --name auto-pilot-seo
```

回滾到指定版本：

```bash
npx wrangler rollback --version-id <version-id> --name auto-pilot-seo
```

## 自訂網域（解決 NewebPay 回調問題）

### 為什麼需要自訂網域？

**Cloudflare Tunnel 的限制**：

- ❌ 無法接收外部服務的 webhook（如 NewebPay 回調）
- ❌ 出現 Error 1033：外部服務無法主動連接

**Cloudflare Workers + 自訂網域的優勢**：

- ✅ 公開可訪問的 URL，NewebPay 可以直接發送回調
- ✅ 自動 SSL 證書
- ✅ 全球 300+ 邊緣節點
- ✅ DDoS 保護

### 在 Cloudflare Dashboard 設定

1. **前往 Workers & Pages**
   - 登入 Cloudflare Dashboard
   - 選擇 Workers & Pages → auto-pilot-seo

2. **設定自訂網域**
   - 點擊 "Settings" → "Custom Domains"
   - 點擊 "Add Custom Domain"
   - 輸入你的網域（如 `seo.zhenhe-dm.com`）
   - Cloudflare 會自動設定 DNS 記錄和 SSL

3. **等待生效**
   - DNS 傳播：約 5-15 分鐘
   - SSL 證書：自動配置，約 10-30 分鐘

### 使用 wrangler CLI 設定

```bash
# 新增自訂網域
npx wrangler domains add seo.zhenhe-dm.com --name auto-pilot-seo

# 驗證網域狀態
npx wrangler domains list --name auto-pilot-seo
```

### 更新環境變數

```bash
# 設定生產環境 URL（使用自訂網域，不是 workers.dev）
npx wrangler secret put NEXT_PUBLIC_APP_URL --name auto-pilot-seo
# 輸入: https://seo.zhenhe-dm.com
```

### 更新 NewebPay 設定

登入 NewebPay 管理後台，更新回調 URL：

**定期定額回調**：

- 從：`https://seo.zhenhe-dm.com/api/payment/recurring/callback` (Tunnel - 會失敗)
- 改為：`https://seo.zhenhe-dm.com/api/payment/recurring/callback` (Workers - 正常)

**一次性付款回調**：

- 從：`https://seo.zhenhe-dm.com/api/payment/onetime/callback` (Tunnel)
- 改為：`https://seo.zhenhe-dm.com/api/payment/onetime/callback` (Workers)

**返回 URL**：

- 成功：`https://seo.zhenhe-dm.com/payment/success`
- 取消：`https://seo.zhenhe-dm.com/payment/cancel`

### 驗證自訂網域

```bash
# 檢查 DNS
nslookup seo.zhenhe-dm.com

# 測試網站
curl -I https://seo.zhenhe-dm.com

# 測試回調端點
curl -X POST https://seo.zhenhe-dm.com/api/payment/recurring/callback \
  -H "Content-Type: application/json" \
  -d '{"test": "true"}'
```

## 持續部署

每次更新後：

```bash
# 1. 確保程式碼無誤
npm run lint
npm run type-check
npm run build

# 2. 本地測試
npm run preview:cf

# 3. 部署
npm run deploy:cf
```

## 支援的功能

✅ Server-Side Rendering (SSR)
✅ API Routes
✅ Server Actions
✅ Static Assets
✅ i18n 路由
✅ Middleware
✅ 圖片優化 (next/image)
✅ 環境變數

## 不支援的功能

❌ Incremental Static Regeneration (ISR)
❌ Edge Runtime（使用 Node.js Runtime）
❌ Image Optimization API（需使用外部服務）

## 相關文件

- [OpenNext Cloudflare 文件](https://opennext.js.org/cloudflare)
- [Cloudflare Workers 文件](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文件](https://developers.cloudflare.com/workers/wrangler/)
