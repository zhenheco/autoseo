-- API 使用量記錄表
-- 用於追蹤外部網站 API 的使用情況

-- 建立 API 使用量記錄表
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES public.website_configs(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    request_ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_website_id ON public.api_usage_logs(website_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON public.api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON public.api_usage_logs(endpoint);

-- 複合索引：用於統計查詢
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_website_date
ON public.api_usage_logs(website_id, created_at DESC);

-- 建立每日統計視圖（可選）
CREATE OR REPLACE VIEW public.api_usage_daily_stats AS
SELECT
    website_id,
    DATE(created_at) as date,
    endpoint,
    COUNT(*) as request_count,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count,
    COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
    AVG(response_time_ms)::INTEGER as avg_response_time_ms,
    MAX(response_time_ms) as max_response_time_ms
FROM public.api_usage_logs
GROUP BY website_id, DATE(created_at), endpoint;

-- 註解
COMMENT ON TABLE public.api_usage_logs IS 'API 使用量記錄，用於追蹤外部網站 API 調用';
COMMENT ON COLUMN public.api_usage_logs.website_id IS '網站 ID';
COMMENT ON COLUMN public.api_usage_logs.endpoint IS 'API 端點路徑';
COMMENT ON COLUMN public.api_usage_logs.method IS 'HTTP 方法';
COMMENT ON COLUMN public.api_usage_logs.status_code IS 'HTTP 回應狀態碼';
COMMENT ON COLUMN public.api_usage_logs.response_time_ms IS '回應時間（毫秒）';
COMMENT ON COLUMN public.api_usage_logs.request_ip IS '請求 IP';
COMMENT ON COLUMN public.api_usage_logs.user_agent IS '請求 User-Agent';

-- RLS 政策（僅允許 service role 操作）
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- 允許 service role 完整存取
CREATE POLICY "Service role can manage api_usage_logs"
ON public.api_usage_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 授予 service_role 權限
GRANT ALL ON public.api_usage_logs TO service_role;
GRANT SELECT ON public.api_usage_daily_stats TO service_role;
