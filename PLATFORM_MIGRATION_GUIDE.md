# 平台遷移指南 (Platform Migration Guide)

## 目錄

- [GitHub 帳號遷移](#github-帳號遷移)
- [Vercel 部署配置](#vercel-部署配置)
- [Cloudflare 設定](#cloudflare-設定)
- [環境變數配置](#環境變數配置)
- [測試和驗證](#測試和驗證)

---

## GitHub 帳號遷移

### 前置準備

1. **備份當前代碼**

   ```bash
   # 確認所有變更已提交
   git status

   # 如有未提交的變更，先提交
   git add -A
   git commit -m "備份: 遷移前的最後提交"
   ```

2. **匯出當前 repository 資訊**

   ```bash
   # 記錄當前 remote URL
   git remote -v > git-remotes-backup.txt

   # 記錄分支資訊
   git branch -a > git-branches-backup.txt
   ```

### 步驟 1: 建立新的 GitHub 帳號

1. 前往 [GitHub](https://github.com/signup) 註冊新帳號
2. 驗證電子郵件地址
3. 設定雙因素認證 (2FA) - **強烈建議**

### 步驟 2: 在新帳號建立 repository

```bash
# 方式 1: 透過 GitHub CLI (建議)
gh auth login  # 登入新帳號
gh repo create Auto-pilot-SEO --private --source=. --remote=new-origin

# 方式 2: 手動透過網頁介面
# 1. 登入新 GitHub 帳號
# 2. 點擊右上角 "+" -> "New repository"
# 3. Repository name: Auto-pilot-SEO
# 4. 選擇 Private
# 5. 不要初始化 README、.gitignore 或 license
# 6. 點擊 "Create repository"
```

### 步驟 3: 更新本地 repository 的 remote

```bash
# 移除舊的 remote
git remote remove origin

# 加入新的 remote (替換 YOUR_NEW_USERNAME)
git remote add origin https://github.com/YOUR_NEW_USERNAME/Auto-pilot-SEO.git

# 或使用 SSH (需先設定 SSH key)
git remote add origin git@github.com:YOUR_NEW_USERNAME/Auto-pilot-SEO.git

# 驗證 remote 設定
git remote -v
```

### 步驟 4: 推送代碼到新 repository

```bash
# 推送 main 分支
git push -u origin main

# 推送所有分支 (如果需要)
git push --all origin

# 推送所有 tags (如果需要)
git push --tags origin
```

### 設定 SSH Key (可選但建議)

```bash
# 1. 生成新的 SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# 2. 啟動 ssh-agent
eval "$(ssh-agent -s)"

# 3. 將 SSH key 加入 ssh-agent
ssh-add ~/.ssh/id_ed25519

# 4. 複製公鑰
cat ~/.ssh/id_ed25519.pub

# 5. 在 GitHub 設定中加入 SSH key
# Settings > SSH and GPG keys > New SSH key
```

---

## Vercel 部署配置

### 前置準備

1. **Vercel 帳號**
   - 如果沒有帳號，前往 [Vercel](https://vercel.com/signup) 註冊
   - 建議使用 GitHub 帳號登入

### 步驟 1: 連接新的 GitHub Repository

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 點擊 "Add New..." > "Project"
3. 選擇 "Import Git Repository"
4. 授權 Vercel 存取你的新 GitHub 帳號
5. 選擇 `Auto-pilot-SEO` repository
6. 點擊 "Import"

### 步驟 2: 配置專案設定

#### 基本設定

```
Framework Preset: Next.js
Root Directory: ./
Build Command: pnpm run build
Output Directory: .next
Install Command: pnpm install
```

#### 環境變數設定

⚠️ **重要**: 必須設定所有環境變數才能成功部署

在 Vercel Dashboard > Settings > Environment Variables 加入以下變數：

##### 必要變數 (REQUIRED)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://postgres:password@host:5432/database
SUPABASE_DB_URL=postgresql://postgres:password@host:5432/database

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
COMPANY_NAME=Auto Pilot SEO
NODE_ENV=production

# Cron Job 認證
CRON_SECRET=generate_a_random_string_for_cron_authentication

# Email (Gmail)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password

# NextAuth
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=generate-a-secure-random-string
```

##### AI 服務 API Keys (REQUIRED)

```bash
# DeepSeek
DEEPSEEK_API_KEY=sk-replace-with-your-key

# OpenRouter
OPENROUTER_API_KEY=sk-or-replace-with-your-key

# OpenAI
OPENAI_API_KEY=sk-proj-replace-with-your-key

# Perplexity
PERPLEXITY_API_KEY=pplx-replace-with-your-key
```

##### 金流服務 (如需要)

```bash
# 藍新金流 NewebPay
NEWEBPAY_MERCHANT_ID=your-merchant-id
NEWEBPAY_HASH_KEY=your-hash-key
NEWEBPAY_HASH_IV=your-hash-iv
NEWEBPAY_API_URL=https://ccore.newebpay.com/MPG/mpg_gateway
NEWEBPAY_PERIOD_API_URL=https://ccore.newebpay.com/MPG/period
NEWEBPAY_RETURN_URL=https://your-domain.com/api/payment/callback
NEWEBPAY_NOTIFY_URL=https://your-domain.com/api/payment/notify
NEWEBPAY_CLIENT_BACK_URL=https://your-domain.com/dashboard/billing
```

##### 圖片儲存 (Cloudflare R2)

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name

# Fallback: Supabase Storage
SUPABASE_STORAGE_BUCKET=article-images
```

##### 可選變數 (OPTIONAL)

```bash
# 自訂 API Base URLs (用於代理或鏡像)
DEEPSEEK_API_BASE_URL=https://api.deepseek.com
OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_BASE_URL=https://api.openai.com/v1
PERPLEXITY_API_BASE_URL=https://api.perplexity.ai

# 允許的額外域名
NEXT_PUBLIC_ALLOWED_DOMAINS=api.your-domain.com,cdn.your-domain.com

# N8N Workflow 整合
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook/article-generation
N8N_API_KEY=generate_a_random_string

# GitHub Actions (避免 Vercel 超時)
USE_GITHUB_ACTIONS=false
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_replace_with_your_token

# 錯誤追蹤
ERROR_TRACKING_ENABLED=false
# SENTRY_DSN=https://your-sentry-dsn.ingest.sentry.io/project-id
```

### 步驟 3: 部署設定

#### 部署分支設定

1. **Production Branch**: `main`
   - 每次推送到 `main` 分支會自動部署到生產環境

2. **Preview Deployments**: 啟用
   - 每個 Pull Request 會自動建立預覽部署

#### Build & Development Settings

```json
{
  "buildCommand": "pnpm run build",
  "devCommand": "pnpm run dev",
  "installCommand": "pnpm install",
  "outputDirectory": ".next"
}
```

#### 函數配置

```json
{
  "maxDuration": 300,
  "memory": 1024,
  "regions": ["hkg1"]
}
```

### 步驟 4: 網域設定

#### 加入自訂網域

1. 前往 Vercel Dashboard > Settings > Domains
2. 加入你的網域 (例如: `yourdomain.com`)
3. 按照指示設定 DNS 記錄

#### DNS 配置範例

```
# A Record
Type: A
Name: @
Value: 76.76.21.21

# CNAME Record (www)
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 步驟 5: 部署驗證

```bash
# 本地測試建置
pnpm run build

# 如果成功，推送到 GitHub 觸發部署
git push origin main

# 檢查部署狀態
# 在 Vercel Dashboard 查看部署日誌
```

---

## Cloudflare 設定

### 前置準備

1. **Cloudflare 帳號**
   - 如果沒有帳號，前往 [Cloudflare](https://dash.cloudflare.com/sign-up) 註冊

### 場景 1: Cloudflare 作為 DNS 管理 (搭配 Vercel)

#### 步驟 1: 加入網域到 Cloudflare

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 點擊 "Add a Site"
3. 輸入你的網域名稱
4. 選擇免費方案
5. Cloudflare 會掃描現有的 DNS 記錄

#### 步驟 2: 更新 Nameservers

在你的網域註冊商處，將 nameservers 更新為 Cloudflare 提供的 nameservers：

```
nameserver1.cloudflare.com
nameserver2.cloudflare.com
```

#### 步驟 3: 配置 DNS 記錄

在 Cloudflare Dashboard > DNS > Records 加入以下記錄：

```
# Vercel 部署
Type: CNAME
Name: @
Target: cname.vercel-dns.com
Proxy status: Proxied (橘色雲朵)

Type: CNAME
Name: www
Target: cname.vercel-dns.com
Proxy status: Proxied (橘色雲朵)
```

#### 步驟 4: SSL/TLS 設定

1. 前往 SSL/TLS > Overview
2. 選擇 **Full (strict)** 模式
3. 啟用 "Always Use HTTPS"
4. 啟用 "Automatic HTTPS Rewrites"

#### 步驟 5: 頁面規則 (Page Rules)

建立以下頁面規則優化效能：

```
# 規則 1: API 路由不快取
URL: *yourdomain.com/api/*
Settings:
- Cache Level: Bypass

# 規則 2: 靜態資源快取
URL: *yourdomain.com/_next/static/*
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 year
```

### 場景 2: Cloudflare Workers (進階部署)

⚠️ **注意**: 這是進階選項，需要修改部署架構

#### 使用時機

- 需要邊緣運算功能
- 需要自訂路由邏輯
- 需要更細粒度的快取控制

#### 基本步驟

1. **安裝 Wrangler CLI**

   ```bash
   pnpm add -D wrangler
   ```

2. **建立 wrangler.toml**

   ```toml
   name = "auto-pilot-seo"
   main = "worker.js"
   compatibility_date = "2025-11-23"

   [env.production]
   vars = { ENVIRONMENT = "production" }
   ```

3. **部署 Worker**
   ```bash
   pnpm exec wrangler deploy
   ```

### 場景 3: Cloudflare R2 (圖片儲存)

#### 步驟 1: 建立 R2 Bucket

1. 前往 Cloudflare Dashboard > R2
2. 點擊 "Create bucket"
3. Bucket name: `article-images`
4. Location: Automatic
5. 點擊 "Create bucket"

#### 步驟 2: 設定公開存取

1. 進入 bucket 設定
2. Settings > Public Access
3. 點擊 "Allow Access"
4. 記錄公開 URL: `https://pub-xxxxx.r2.dev`

#### 步驟 3: 建立 API Token

1. 前往 R2 > Manage R2 API Tokens
2. 點擊 "Create API Token"
3. Token name: `auto-pilot-seo-r2`
4. Permissions: Object Read & Write
5. 記錄以下資訊：
   - Access Key ID
   - Secret Access Key
   - Account ID

#### 步驟 4: 更新環境變數

在 Vercel 和本地 `.env.local` 加入：

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=article-images
```

---

## 環境變數配置

### 本地開發環境

建立 `.env.local` 檔案（不要提交到 Git）：

```bash
# 從 .env.example 複製
cp .env.example .env.local

# 編輯並填入實際值
nano .env.local
```

### 生產環境（Vercel）

使用 Vercel CLI 批量設定環境變數：

```bash
# 安裝 Vercel CLI
pnpm add -g vercel

# 登入
vercel login

# 連結專案
vercel link

# 從本地 .env.local 同步環境變數到 Vercel
# ⚠️ 注意：這會覆蓋 Vercel 上的現有變數
vercel env pull .env.local
vercel env add VARIABLE_NAME production < value.txt
```

### 環境變數安全檢查清單

- [ ] ✅ 所有敏感資訊都使用環境變數
- [ ] ✅ `.env.local` 已加入 `.gitignore`
- [ ] ✅ 生產環境變數已在 Vercel 設定
- [ ] ✅ 開發環境變數已在本地 `.env.local`
- [ ] ✅ 沒有在程式碼中硬編碼 API Keys
- [ ] ✅ CRON_SECRET 已設定並且足夠隨機
- [ ] ✅ NEXTAUTH_SECRET 已設定並且足夠隨機

### 生成安全的隨機字串

```bash
# 生成 CRON_SECRET
openssl rand -hex 32

# 生成 NEXTAUTH_SECRET
openssl rand -base64 32
```

---

## 測試和驗證

### 部署前檢查

```bash
# 1. 本地建置測試
pnpm run build

# 2. 類型檢查
pnpm exec tsc --noEmit

# 3. Lint 檢查（可選，可能會記憶體不足）
# pnpm run lint

# 4. 測試開發伺服器
pnpm run dev
```

### 部署後驗證

#### 1. 檢查部署狀態

```bash
# 使用 Vercel CLI
vercel ls

# 檢查最新部署
vercel inspect
```

#### 2. 健康檢查

```bash
# 測試首頁
curl -I https://your-domain.com

# 測試 API
curl https://your-domain.com/api/health

# 測試 CORS
curl -H "Origin: https://your-domain.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://your-domain.com/api/articles
```

#### 3. 安全 Headers 驗證

```bash
# 使用 curl 檢查安全 headers
curl -I https://your-domain.com

# 應該看到以下 headers:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# Referrer-Policy: strict-origin-when-cross-origin
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# Content-Security-Policy: ...
# Permissions-Policy: ...
```

#### 4. 功能測試清單

- [ ] ✅ 使用者可以登入
- [ ] ✅ 文章列表可以載入
- [ ] ✅ 可以建立新文章
- [ ] ✅ 圖片上傳正常運作
- [ ] ✅ API 回應正常
- [ ] ✅ Cron Job 認證正常
- [ ] ✅ 支付回調驗證正常

#### 5. 效能測試

使用 [WebPageTest](https://www.webpagetest.org/) 或 [PageSpeed Insights](https://pagespeed.web.dev/) 測試：

- [ ] ✅ First Contentful Paint < 1.8s
- [ ] ✅ Largest Contentful Paint < 2.5s
- [ ] ✅ Time to Interactive < 3.8s
- [ ] ✅ Cumulative Layout Shift < 0.1

---

## 故障排除 (Troubleshooting)

### 常見問題

#### 1. 部署失敗：缺少環境變數

**錯誤訊息**: `Missing required environment variable: XXX`

**解決方案**:

```bash
# 在 Vercel Dashboard 設定缺少的環境變數
# 或使用 CLI
vercel env add XXX production
```

#### 2. 資料庫連接失敗

**錯誤訊息**: `Connection timed out` 或 `ECONNREFUSED`

**解決方案**:

- 檢查 `DATABASE_URL` 和 `SUPABASE_DB_URL` 是否正確
- 確認資料庫允許來自 Vercel 的連接
- 檢查 Supabase 專案是否啟用並正常運行

#### 3. CORS 錯誤

**錯誤訊息**: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**解決方案**:

- 確認 `NEXT_PUBLIC_APP_URL` 設定正確
- 檢查 `next.config.js` 的 CORS 配置
- 驗證請求的 Origin header

#### 4. 圖片無法載入

**錯誤訊息**: `Failed to load resource` 或 `403 Forbidden`

**解決方案**:

- 檢查 R2 bucket 的公開存取設定
- 驗證 R2 API credentials
- 確認 `next.config.js` 的 `remotePatterns` 包含圖片來源

#### 5. Cron Job 未執行

**解決方案**:

- 檢查 Vercel Cron Jobs 設定
- 驗證 `CRON_SECRET` 環境變數
- 查看 Vercel 函數日誌

---

## 回滾策略

### Vercel 部署回滾

```bash
# 方式 1: 透過 Vercel Dashboard
# 1. 前往 Deployments
# 2. 找到上一個成功的部署
# 3. 點擊 "..." > "Promote to Production"

# 方式 2: 透過 CLI
vercel rollback
```

### Git 回滾

```bash
# 回滾到上一個 commit
git revert HEAD
git push origin main

# 回滾到特定 commit
git revert <commit-hash>
git push origin main

# 強制回滾（不建議）
git reset --hard <commit-hash>
git push --force origin main
```

---

## 監控和告警

### Vercel Analytics

1. 前往 Vercel Dashboard > Analytics
2. 啟用 Web Analytics
3. 啟用 Speed Insights

### Cloudflare Analytics

1. 前往 Cloudflare Dashboard > Analytics
2. 查看流量統計
3. 設定告警規則

### 自訂監控

建議整合以下服務：

- **Sentry**: 錯誤追蹤
- **LogRocket**: 使用者 session 記錄
- **UptimeRobot**: 服務可用性監控

---

## 持續整合/部署 (CI/CD)

### GitHub Actions 工作流程

建立 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

---

## 支援和資源

### 官方文件

- [Vercel Documentation](https://vercel.com/docs)
- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)

### 社群資源

- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)

---

## 檢查清單總結

### GitHub 遷移

- [ ] ✅ 備份現有代碼
- [ ] ✅ 建立新 GitHub 帳號
- [ ] ✅ 建立新 repository
- [ ] ✅ 更新 remote URL
- [ ] ✅ 推送所有代碼
- [ ] ✅ 設定 SSH key

### Vercel 部署

- [ ] ✅ 連接 GitHub repository
- [ ] ✅ 配置建置設定
- [ ] ✅ 設定所有環境變數
- [ ] ✅ 配置自訂網域
- [ ] ✅ 驗證部署成功
- [ ] ✅ 測試所有功能

### Cloudflare 設定

- [ ] ✅ 加入網域到 Cloudflare
- [ ] ✅ 更新 nameservers
- [ ] ✅ 配置 DNS 記錄
- [ ] ✅ 設定 SSL/TLS
- [ ] ✅ 建立 R2 bucket
- [ ] ✅ 配置 API tokens

### 安全和效能

- [ ] ✅ 驗證安全 headers
- [ ] ✅ 測試 CORS 配置
- [ ] ✅ 檢查錯誤處理
- [ ] ✅ 驗證 Cron Job 認證
- [ ] ✅ 測試支付回調驗證
- [ ] ✅ 執行效能測試

---

**最後更新**: 2025-11-23
