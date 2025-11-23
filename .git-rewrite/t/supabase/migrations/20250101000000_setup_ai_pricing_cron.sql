-- 啟用必要的 extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- 建立每日 02:00 更新 AI 模型價格的排程
-- 注意：這個排程會呼叫 Edge Function，需要先部署 Edge Function
SELECT cron.schedule(
  'update-ai-pricing-daily',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://<your-project-ref>.supabase.co/functions/v1/update-ai-pricing',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- 查看已設定的 cron jobs
SELECT * FROM cron.job;

-- 如果需要刪除排程，可以使用：
-- SELECT cron.unschedule('update-ai-pricing-daily');
