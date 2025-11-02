# Vercel 部署指南

## 為什麼選擇 Vercel？

✅ **無 bundle 大小限制**（Cloudflare Workers 限制 3MB/10MB）
✅ **原生支援 Next.js**（零配置）
✅ **支援外部 webhook**（NewebPay 付款回調）
✅ **可綁定自訂網域** seo.zhenhe-dm.com
✅ **免費方案足夠使用**
✅ **全球 Edge Network**（效能優異）

---

## 部署步驟

### 步驟 1：登入 Vercel

```bash
vercel login
```

這會開啟瀏覽器，請使用 GitHub/GitLab/Bitbucket 帳號登入。

---

### 步驟 2：部署到生產環境

```bash
vercel --prod --yes
```

部署過程會：
1. 自動偵測 Next.js 專案
2. 建置應用程式（約 2-5 分鐘）
3. 部署到 Vercel Edge Network
4. 提供部署 URL（例如：`https://auto-pilot-seo.vercel.app`）

---

### 步驟 3：設定環境變數

#### 方法 A：透過 Vercel Dashboard（推薦）

1. 前往 https://vercel.com/dashboard
2. 選擇 `auto-pilot-seo` 專案
3. 進入 **Settings** → **Environment Variables**
4. 新增以下環境變數：

**必要變數（Production）**：
```
NEXT_PUBLIC_SUPABASE_URL=<你的 Supabase URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<你的 Anon Key>
SUPABASE_SERVICE_ROLE_KEY=<你的 Service Role Key>
SUPABASE_DB_URL=<你的資料庫 URL>
NEWEBPAY_MERCHANT_ID=<藍新商店代號>
NEWEBPAY_HASH_KEY=<藍新 Hash Key>
NEWEBPAY_HASH_IV=<藍新 Hash IV>
NEWEBPAY_API_URL=https://ccore.newebpay.com
GMAIL_USER=<Gmail 帳號>
GMAIL_APP_PASSWORD=<Gmail App 密碼>
NEXT_PUBLIC_APP_URL=https://seo.zhenhe-dm.com
COMPANY_NAME=<公司名稱>
DEEPSEEK_API_KEY=<DeepSeek API Key>
OPENROUTER_API_KEY=<OpenRouter API Key>
PERPLEXITY_API_KEY=<Perplexity API Key>
```

5. 儲存後，執行 **Redeploy** 重新部署

#### 方法 B：透過 CLI

```bash
# 從 .env.local 讀取並設定
vercel env pull
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... 逐一新增其他變數
```

---

### 步驟 4：綁定自訂網域

1. 前往 Vercel Dashboard → **Settings** → **Domains**
2. 新增網域：`seo.zhenhe-dm.com`
3. Vercel 會提供 DNS 設定指引：

**A Record 設定**：
```
Type: A
Name: seo
Value: 76.76.21.21
```

**CNAME Record 設定**（替代方案）：
```
Type: CNAME
Name: seo
Value: cname.vercel-dns.com
```

4. 前往你的 DNS 服務商（Cloudflare）更新 DNS 記錄
5. 等待 DNS 傳播（通常 5-30 分鐘）
6. Vercel 會自動配置 SSL 憑證

---

### 步驟 5：驗證部署

#### 測試基本功能
```bash
# 檢查首頁
curl -I https://auto-pilot-seo.vercel.app

# 測試 API
curl https://auto-pilot-seo.vercel.app/api/ai-models
```

#### 測試付款回調 API
```bash
# 確認 webhook endpoint 可訪問
curl -I https://seo.zhenhe-dm.com/api/payment/recurring/callback
```

應返回 `200 OK` 或 `405 Method Not Allowed`（表示端點存在但不接受 GET）

---

## NewebPay 設定更新

部署完成後，更新 NewebPay 設定：

1. 登入 NewebPay 後台
2. 前往 **商店設定** → **Webhook 設定**
3. 更新回調 URL 為：
   ```
   https://seo.zhenhe-dm.com/api/payment/recurring/callback
   https://seo.zhenhe-dm.com/api/payment/recurring/notify
   ```

---

## 自動部署（CI/CD）

### GitHub 整合

Vercel 會自動與 GitHub repository 整合：

- **Main 分支**：自動部署到生產環境
- **其他分支**：自動建立預覽環境

### 本地更新流程

```bash
# 1. 修改代碼
git add .
git commit -m "更新: 功能描述"
git push

# 2. Vercel 自動部署（無需手動操作）
```

---

## 監控與日誌

### 查看部署日誌
1. Vercel Dashboard → **Deployments**
2. 選擇特定部署查看建置日誌

### 查看應用程式日誌
1. Vercel Dashboard → **Logs**
2. 即時查看應用程式執行日誌

### 效能監控
1. Vercel Dashboard → **Analytics**
2. 查看頁面載入時間、訪問量等指標

---

## 疑難排解

### 建置失敗
```bash
# 本地測試建置
pnpm run build

# 檢查 TypeScript 錯誤
pnpm run type-check

# 檢查 ESLint 錯誤
pnpm run lint
```

### 環境變數未生效
1. 確認環境變數已在 Vercel Dashboard 設定
2. 執行 **Redeploy** 重新部署
3. 檢查變數名稱是否正確（區分大小寫）

### 付款回調失敗
1. 檢查 `NEWEBPAY_HASH_KEY` 和 `NEWEBPAY_HASH_IV` 是否正確
2. 檢查 NewebPay 設定的回調 URL 是否正確
3. 查看 Vercel Logs 中的錯誤訊息

---

## 成本估算

### Vercel 免費方案限制
- ✅ 100 GB 頻寬/月
- ✅ 無限部署
- ✅ 自動 SSL
- ✅ 全球 CDN
- ✅ 預覽環境

**預估**：你的專案完全在免費方案範圍內。

---

## 比較：Vercel vs Cloudflare

| 項目 | Vercel | Cloudflare Workers |
|------|--------|-------------------|
| Bundle 大小限制 | 無 | 3MB (免費) / 10MB (付費) |
| Next.js 支援 | 原生 | 透過 OpenNext |
| 配置複雜度 | 零配置 | 需要 wrangler.jsonc |
| 環境變數設定 | Dashboard | wrangler secret |
| 冷啟動時間 | ~100ms | ~30ms |
| 全球節點 | ✅ | ✅ |
| 免費方案 | 完整功能 | 有限制 |
| **本專案適用性** | ✅ 完美 | ❌ Bundle 過大 |

---

## 下一步

1. 執行 `vercel login` 登入
2. 執行 `vercel --prod --yes` 部署
3. 在 Vercel Dashboard 設定環境變數
4. 綁定 seo.zhenhe-dm.com
5. 更新 NewebPay webhook URL
6. 使用 Chrome DevTools 測試前端功能
7. 測試付款流程
