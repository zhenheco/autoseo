# Cloudflare 部署配置

## ADDED Requirements

### Requirement: Workers 部署配置

**Priority**: 🔴 Critical
**Component**: Infrastructure
**Dependencies**: None

系統必須配置 Cloudflare Workers 以處理 Next.js SSR 和複雜業務邏輯。

#### Scenario: Workers 設定完成

**Given**: 專案已有 `wrangler.jsonc` 配置檔案
**When**: 執行 `npm run deploy:cf-workers`
**Then**:

- Workers 部署成功
- OpenNext worker.js 正確載入
- nodejs_compat 標誌啟用
- ASSETS 綁定配置正確

**Acceptance Criteria**:

- [ ] `wrangler.jsonc` 包含 `nodejs_compat` 相容性標誌
- [ ] `main` 指向 `.open-next/worker.js`
- [ ] `assets.directory` 設定為 `.open-next/assets`
- [ ] 環境變數透過 `wrangler secret` 設定
- [ ] 部署後網站可正常訪問

**Implementation Notes**:

```jsonc
{
  "name": "auto-pilot-seo",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-03-25",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS",
  },
}
```

---

### Requirement: Pages 靜態資源部署

**Priority**: 🔴 Critical
**Component**: Infrastructure
**Dependencies**: None

系統必須配置 Cloudflare Pages 以服務靜態資源和輕量 Functions。

#### Scenario: Pages 部署成功

**Given**: 專案已執行 `npm run build`
**When**: 執行 Pages 部署
**Then**:

- 靜態資源上傳到 Pages
- Functions 正確配置
- 自訂域名綁定成功
- HTTPS 自動啟用

**Acceptance Criteria**:

- [ ] Pages 專案名稱：`auto-pilot-seo`
- [ ] 靜態資源從 `.open-next/assets` 上傳
- [ ] Pages Functions 處理 `/api/*` 輕量 endpoints
- [ ] 自訂域名 `seo.zhenhe-dm.com` 綁定成功
- [ ] 自動 HTTPS 證書配置

**Implementation Notes**:

```bash
# 部署到 Pages
wrangler pages deploy .open-next/assets --project-name=auto-pilot-seo

# 綁定自訂域名
wrangler pages domain add seo.zhenhe-dm.com --project-name=auto-pilot-seo
```

---

### Requirement: Workers 和 Pages 路由整合

**Priority**: 🟡 High
**Component**: Infrastructure
**Dependencies**: Workers 部署配置, Pages 靜態資源部署

系統必須正確路由請求到 Workers（SSR）或 Pages（靜態）。

#### Scenario: 請求路由正確

**Given**: Workers 和 Pages 皆已部署
**When**: 使用者訪問不同類型的 URL
**Then**:

- 靜態資源（CSS, JS, 圖片）由 Pages 服務
- SSR 頁面由 Workers 處理
- API routes 根據複雜度分配

**Acceptance Criteria**:

- [ ] `/_next/*` 靜態資源由 Pages 服務
- [ ] `/api/simple/*` 由 Pages Functions 處理
- [ ] `/api/ai/*` 由 Workers 處理
- [ ] SSR 頁面由 Workers 處理
- [ ] 無路由衝突

**Implementation Notes**:

```javascript
// Workers 路由邏輯
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 靜態資源交給 Pages
    if (
      url.pathname.startsWith("/_next/") ||
      url.pathname.match(/\.(css|js|png|jpg|svg)$/)
    ) {
      return env.ASSETS.fetch(request);
    }

    // SSR 和複雜 API 由 Workers 處理
    return handleSSR(request, env);
  },
};
```

---

### Requirement: 環境變數管理

**Priority**: 🔴 Critical
**Component**: Configuration
**Dependencies**: None

系統必須安全地管理敏感環境變數。

#### Scenario: 環境變數正確設定

**Given**: 需要部署到生產環境
**When**: 執行 `wrangler secret put` 命令
**Then**:

- 敏感資料加密儲存
- Workers 和 Pages 都能存取
- 本地開發使用 `.dev.vars`

**Acceptance Criteria**:

- [ ] 所有敏感變數使用 `wrangler secret put`
- [ ] `.dev.vars` 包含本地開發變數（已加入 .gitignore）
- [ ] `.env.example` 記錄所需變數名稱
- [ ] 無敏感資料硬編碼

**Required Secrets**:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Database
DATABASE_URL
SUPABASE_DB_URL

# Third-party
GMAIL_USER
GMAIL_APP_PASSWORD
EXCHANGE_RATE_API_KEY
```

**Implementation Notes**:

```bash
# 設定單個 secret
echo "your-secret-value" | wrangler secret put SECRET_NAME

# 批次設定
for secret in DATABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  echo "請輸入 $secret:"
  read -s value
  echo "$value" | wrangler secret put "$secret"
done
```

---

### Requirement: CI/CD 自動化部署

**Priority**: 🟡 High
**Component**: DevOps
**Dependencies**: Workers 部署配置, Pages 靜態資源部署

系統必須透過 GitHub Actions 實現自動化部署。

#### Scenario: Git push 觸發自動部署

**Given**: GitHub Actions workflow 已配置
**When**: push 到 `main` 或 `deployment` 分支
**Then**:

- 自動執行 lint 和 typecheck
- 自動建置專案
- 自動部署到 Cloudflare
- 部署狀態通知

**Acceptance Criteria**:

- [ ] `.github/workflows/cloudflare-deploy.yml` 存在
- [ ] Lint 失敗會阻止部署
- [ ] Typecheck 失敗會阻止部署
- [ ] 部署成功後發送通知
- [ ] 支援手動觸發部署

**Implementation Notes**:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, deployment]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run build

      - name: Deploy to Cloudflare Workers
        run: npm run deploy:cf-workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

## MODIFIED Requirements

### Requirement: Build 配置優化

**Priority**: 🟡 High
**Component**: Build
**Previous**: Vercel 部署配置
**Changes**: 調整為 Cloudflare Workers 和 Pages

系統的建置配置必須支援 Cloudflare 部署。

#### Scenario: 建置產生正確輸出

**Given**: `next.config.js` 已正確配置
**When**: 執行 `npm run build`
**Then**:

- 產生 standalone 輸出
- OpenNext 可正確轉換
- 靜態資源分離
- 無建置錯誤

**Acceptance Criteria**:

- [ ] `next.config.js` 包含 `output: 'standalone'`
- [ ] `outputFileTracingRoot` 正確設定
- [ ] 建置後 `.next/standalone` 存在
- [ ] OpenNext 建置成功產生 `.open-next/`
- [ ] 無 TypeScript 錯誤
- [ ] 無 Turbopack（OpenNext 不支援）

**Before**:

```javascript
module.exports = {
  // Vercel 預設配置
};
```

**After**:

```javascript
const path = require("path");

module.exports = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  typescript: {
    ignoreBuildErrors: false,
  },
  // 移除 Turbopack
  // turbopack: {}, // ❌ OpenNext 不支援
};
```

---

## Testing Requirements

### Requirement: 部署驗證測試

**Priority**: 🔴 Critical
**Component**: Testing

部署後必須驗證所有功能正常運作。

#### Scenario: 部署後功能驗證

**Given**: 已完成 Cloudflare 部署
**When**: 執行驗證測試腳本
**Then**:

- 所有頁面可正常訪問
- API endpoints 正常響應
- SSR 正常運作
- 靜態資源載入成功

**Acceptance Criteria**:

- [ ] 首頁載入成功（HTTP 200）
- [ ] 登入頁面正常
- [ ] API `/api/health` 返回 200
- [ ] 圖片資源正常載入
- [ ] CSS/JS 正確載入
- [ ] 無 console 錯誤

**Test Script**:

```bash
#!/bin/bash

BASE_URL="https://seo.zhenhe-dm.com"

# 測試首頁
curl -I "$BASE_URL/" | grep "200 OK" || exit 1

# 測試 API
curl "$BASE_URL/api/health" | grep "ok" || exit 1

# 測試靜態資源
curl -I "$BASE_URL/_next/static/css/main.css" | grep "200 OK" || exit 1

echo "✅ 所有驗證測試通過"
```
