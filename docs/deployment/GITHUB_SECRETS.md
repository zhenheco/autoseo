# GitHub Actions Secrets 設定指南

## 必要的 GitHub Secrets

在 GitHub Repository Settings > Secrets and Variables > Actions 中設定以下 secrets：

### 1. CLOUDFLARE_ACCOUNT_ID

- **說明**：Cloudflare 帳戶 ID
- **取得方式**：
  1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
  2. 在右側欄找到「Account ID」
  3. 複製該 ID

### 2. CLOUDFLARE_API_TOKEN

- **說明**：Cloudflare API Token（需要 Workers 部署權限）
- **建立方式**：
  1. 前往 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
  2. 點擊「Create Token」
  3. 使用「Custom token」模板
  4. 設定權限：
     - Account > Cloudflare Workers Scripts > Edit
     - Zone > Zone > Read
     - Zone > Workers Routes > Edit
  5. 複製生成的 Token

### 3. CLOUDFLARE_WORKERS_SUBDOMAIN

- **說明**：你的 Workers 子網域
- **格式**：`your-subdomain`（不包含 .workers.dev）
- **範例**：如果你的 Workers 網址是 `my-app.my-team.workers.dev`，則填入 `my-team`

## 環境變數設定

部署後，需要在 Cloudflare Workers 中設定以下環境變數：

```bash
# 使用 wrangler 設定 secrets
wrangler secret put NEXT_PUBLIC_SUPABASE_URL --env production
wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY --env production
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
wrangler secret put DATABASE_URL --env production

# NewebPay 支付相關
wrangler secret put NEWEBPAY_MERCHANT_ID --env production
wrangler secret put NEWEBPAY_HASH_KEY --env production
wrangler secret put NEWEBPAY_HASH_IV --env production

# 其他服務
wrangler secret put GMAIL_USER --env production
wrangler secret put GMAIL_APP_PASSWORD --env production
wrangler secret put NEXT_PUBLIC_APP_URL --env production
```

## CI/CD 工作流程

### 自動部署觸發條件：

1. **生產環境部署** (main 分支)
   - 推送到 `main` 分支時自動部署到生產環境
   - 網址：`https://seo.zhenhe-dm.com`

2. **預覽環境部署** (develop 分支)
   - 推送到 `develop` 分支時自動部署到預覽環境
   - 網址：`https://auto-pilot-seo-staging.*.workers.dev`

3. **PR 預覽部署**
   - 建立 Pull Request 時自動部署預覽版本
   - 網址：`https://auto-pilot-seo-pr-{PR號碼}.*.workers.dev`

### 手動觸發部署：

可以在 GitHub Actions 頁面手動觸發 workflow。

## 驗證設定

設定完成後，可以通過以下方式驗證：

1. 建立一個測試 PR 來觸發預覽部署
2. 合併到 develop 分支測試預覽環境部署
3. 合併到 main 分支測試生產環境部署

## 故障排除

### 常見問題：

1. **部署失敗：Authentication error**
   - 檢查 `CLOUDFLARE_API_TOKEN` 是否有正確權限
   - 確認 token 尚未過期

2. **部署失敗：Account not found**
   - 檢查 `CLOUDFLARE_ACCOUNT_ID` 是否正確

3. **預覽 URL 404**
   - 檢查 `CLOUDFLARE_WORKERS_SUBDOMAIN` 是否正確設定

## 安全注意事項

- **絕不**將 secrets 直接寫在代碼中
- 定期更新 API tokens
- 使用最小權限原則設定 API token 權限
- 監控 GitHub Actions 日誌確保沒有洩漏敏感資訊
