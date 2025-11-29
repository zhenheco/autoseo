# Vercel 環境變數設定指南

## 問題說明

網站目前出現 `MIDDLEWARE_INVOCATION_FAILED` 錯誤，這是因為 Vercel 部署缺少必要的環境變數。

## 錯誤資訊

```
A server error has occurred
MIDDLEWARE_INVOCATION_FAILED
```

## 原因

Middleware 需要以下 Supabase 環境變數：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

這些環境變數未在 Vercel 中設定，導致 middleware 執行失敗。

## 解決方案

### 方法 1: 使用自動化腳本（推薦）

1. **確保本地 `.env.local` 檔案包含所有必要的環境變數**

   ```bash
   # 檢查環境變數
   cat .env.local
   ```

2. **執行 Vercel 環境變數設定腳本**

   ```bash
   source .env.local && bash scripts/setup-vercel-env.sh
   ```

3. **重新部署**
   ```bash
   pnpm exec vercel --prod
   ```

### 方法 2: 手動設定（透過 Vercel Dashboard）

1. **前往 Vercel Dashboard**
   - 網址: https://vercel.com/acejou27s-projects/autopilot-seo/settings/environment-variables

2. **新增以下環境變數**

   #### Supabase（必要）

   ```
   名稱: NEXT_PUBLIC_SUPABASE_URL
   值: https://your-project.supabase.co
   環境: Production, Preview, Development
   ```

   ```
   名稱: NEXT_PUBLIC_SUPABASE_ANON_KEY
   值: your-anon-key-here
   環境: Production, Preview, Development
   ```

   ```
   名稱: SUPABASE_SERVICE_ROLE_KEY
   值: your-service-role-key-here
   環境: Production, Preview, Development
   ```

   ```
   名稱: SUPABASE_DB_URL
   值: postgresql://postgres:password@host:port/database
   環境: Production
   ```

   #### 應用配置（必要）

   ```
   名稱: NEXT_PUBLIC_APP_URL
   值: https://1wayseo.com
   環境: Production, Preview, Development
   ```

   ```
   名稱: COMPANY_NAME
   值: Auto Pilot SEO
   環境: Production, Preview, Development
   ```

   #### NewebPay（必要 - 用於支付功能）

   ```
   名稱: NEWEBPAY_MERCHANT_ID
   值: your-merchant-id
   環境: Production, Preview, Development
   ```

   ```
   名稱: NEWEBPAY_HASH_KEY
   值: your-hash-key
   環境: Production, Preview, Development
   ```

   ```
   名稱: NEWEBPAY_HASH_IV
   值: your-hash-iv
   環境: Production, Preview, Development
   ```

   ```
   名稱: NEWEBPAY_API_URL
   值: https://ccore.newebpay.com/MPG/mpg_gateway
   環境: Production, Preview, Development
   ```

   #### Gmail（選用 - 用於發送郵件）

   ```
   名稱: GMAIL_USER
   值: your-email@gmail.com
   環境: Production
   ```

   ```
   名稱: GMAIL_APP_PASSWORD
   值: your-app-password
   環境: Production
   ```

   #### AI API Keys（選用 - 用於內容生成）

   ```
   名稱: DEEPSEEK_API_KEY
   值: your-deepseek-key
   環境: Production
   ```

   ```
   名稱: OPENROUTER_API_KEY
   值: your-openrouter-key
   環境: Production
   ```

   ```
   名稱: PERPLEXITY_API_KEY
   值: your-perplexity-key
   環境: Production
   ```

3. **儲存變更後，觸發重新部署**
   - 在 Vercel Dashboard 的 Deployments 頁面
   - 點擊最新部署旁的 "..." → "Redeploy"

### 方法 3: 使用 Vercel CLI（命令列）

```bash
# 設定單個環境變數
vercel env add NEXT_PUBLIC_SUPABASE_URL production

# 從 .env.local 批量導入
while IFS='=' read -r key value; do
  if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]]; then
    echo "設定 $key..."
    echo "$value" | vercel env add "$key" production
  fi
done < .env.local
```

## 驗證

### 1. 檢查環境變數是否設定成功

```bash
# 列出所有環境變數
vercel env ls
```

### 2. 測試網站

```bash
# 測試首頁
curl -I https://1wayseo.com/

# 應該返回 HTTP/2 200
# 如果還是錯誤，等待幾分鐘讓部署完成
```

### 3. 檢查 Vercel 部署日誌

前往 Vercel Dashboard → Deployments → 選擇最新部署 → Functions 標籤，查看 middleware 執行日誌。

## 常見問題

### Q1: 設定環境變數後還是出現錯誤？

**A**: 需要重新部署才能讓環境變數生效。執行：

```bash
pnpm exec vercel --prod
```

### Q2: 如何找到 Supabase 環境變數？

**A**:

1. 前往 https://supabase.com/dashboard
2. 選擇你的專案
3. Settings → API
4. 複製 `URL` 和 `anon key`

### Q3: 測試環境需要設定環境變數嗎？

**A**: 是的，建議在 Production、Preview、Development 三個環境都設定相同的變數。

### Q4: 如何刪除或修改環境變數？

**A**:

```bash
# 刪除
vercel env rm VARIABLE_NAME production

# 修改（需先刪除再新增）
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production
```

## 安全性注意事項

1. **絕對不要** 在程式碼中硬編碼敏感資訊
2. **絕對不要** 將 `.env.local` 提交到 Git
3. **定期輪換** API keys 和密鑰
4. **使用不同的** keys 在測試和生產環境

## 下一步

設定完環境變數後：

1. ✅ 驗證網站可以正常訪問
2. ✅ 測試登入/註冊功能
3. ✅ 測試支付功能（使用測試卡號）
4. ✅ 檢查 Console 是否還有錯誤

---

**更新日期**: 2025-11-02
**相關文檔**:

- `scripts/setup-vercel-env.sh` - 自動化設定腳本
- `.env.example` - 環境變數範例
- `docs/deployment/DEPLOYMENT_STATUS.md` - 部署狀態
