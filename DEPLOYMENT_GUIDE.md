# AI 模型價格自動更新部署指南

## 概述
此系統每天凌晨 02:00 自動抓取最新的 AI 模型價格並更新資料庫。

## 架構
- **Edge Function**: `supabase/functions/update-ai-pricing/index.ts`
- **pg_cron 排程**: 每天 02:00 觸發
- **資料來源**:
  - Anthropic Claude: https://claude.com/pricing
  - Google Gemini: https://ai.google.dev/gemini-api/docs/pricing
  - DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
  - OpenAI: 手動配置（API 限制訪問）

## 部署步驟

### 1. 部署 Edge Function

```bash
# 安裝 Supabase CLI（如果尚未安裝）
npm install -g supabase

# 登入 Supabase
supabase login

# 連結到專案
supabase link --project-ref <your-project-ref>

# 部署 Edge Function
supabase functions deploy update-ai-pricing
```

### 2. 設定環境變數

在 Supabase Dashboard 中設定以下環境變數：
- 前往 Project Settings → Edge Functions
- 添加環境變數：
  - `SUPABASE_URL`: 您的 Supabase URL
  - `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key

或使用 CLI：

```bash
supabase secrets set SUPABASE_URL=https://<your-project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. 執行 Migration 設定 Cron Job

```bash
# 執行 migration
supabase db push

# 或者手動執行 SQL
supabase db execute -f supabase/migrations/20250101000000_setup_ai_pricing_cron.sql
```

**重要**: 執行 migration 前，需要先更新 SQL 檔案中的 `<your-project-ref>`：

```sql
-- 在 migration 檔案中更新此行
url := 'https://<your-project-ref>.supabase.co/functions/v1/update-ai-pricing',
```

### 4. 驗證部署

#### 測試 Edge Function

```bash
# 使用 curl 測試
curl -X POST \
  https://<your-project-ref>.supabase.co/functions/v1/update-ai-pricing \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json"
```

#### 檢查 Cron Job

```sql
-- 查看已設定的 cron jobs
SELECT * FROM cron.job;

-- 查看 cron job 執行歷史
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'update-ai-pricing-daily')
ORDER BY start_time DESC
LIMIT 10;
```

#### 手動觸發測試

```sql
-- 手動執行一次（不等到 02:00）
SELECT cron.schedule_in_database(
  'test-update-ai-pricing',
  '1 second',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/update-ai-pricing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 刪除測試任務
SELECT cron.unschedule('test-update-ai-pricing');
```

### 5. 監控和維護

#### 查看最後更新時間

```sql
SELECT
  model_name,
  provider,
  input_price_per_1m,
  output_price_per_1m,
  updated_at
FROM ai_model_pricing
ORDER BY updated_at DESC;
```

#### 查看 Edge Function 日誌

```bash
# 查看實時日誌
supabase functions logs update-ai-pricing --tail
```

或在 Supabase Dashboard:
- 前往 Edge Functions → update-ai-pricing → Logs

#### 暫停/恢復 Cron Job

```sql
-- 暫停
UPDATE cron.job SET active = false WHERE jobname = 'update-ai-pricing-daily';

-- 恢復
UPDATE cron.job SET active = true WHERE jobname = 'update-ai-pricing-daily';

-- 完全刪除
SELECT cron.unschedule('update-ai-pricing-daily');
```

## 故障排除

### Edge Function 呼叫失敗

1. 檢查 Service Role Key 是否正確設定
2. 檢查 Edge Function 是否成功部署
3. 查看 Edge Function 日誌

### Cron Job 未執行

1. 確認 `pg_cron` extension 已啟用
2. 確認 cron job 狀態為 active
3. 檢查 PostgreSQL 時區設定

```sql
-- 查看時區
SHOW timezone;

-- 如果需要，設定時區為台北時間
ALTER DATABASE postgres SET timezone TO 'Asia/Taipei';
```

### 價格未更新

1. 檢查 Edge Function 回傳結果
2. 確認官網 HTML 結構未改變
3. 查看資料庫更新日誌

## 價格來源 API

各廠商的官方定價頁面：

| 廠商 | 官方定價頁面 | 備註 |
|------|-------------|------|
| Anthropic | https://claude.com/pricing | 需要處理重定向 |
| Google | https://ai.google.dev/gemini-api/docs/pricing | 官方 API 文件 |
| DeepSeek | https://api-docs.deepseek.com/quick_start/pricing | 官方 API 文件 |
| OpenAI | https://openai.com/api/pricing/ | 403 限制，需手動更新 |

## 更新頻率

目前設定為每天 02:00 (台北時間) 執行一次。如需調整：

```sql
-- 修改為每 12 小時執行一次
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'update-ai-pricing-daily'),
  schedule := '0 2,14 * * *'
);

-- 修改為每週一 02:00 執行
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'update-ai-pricing-daily'),
  schedule := '0 2 * * 1'
);
```

## 成本考量

- Edge Function 免費額度: 2M 請求/月
- 每日一次呼叫 = 30 次/月（遠低於免費額度）
- pg_cron 不產生額外費用

## 安全性

- 使用 Service Role Key 進行認證
- Edge Function 需要 Authorization header
- 價格資料來自官方公開頁面
- 所有敏感資料儲存在環境變數中
