-- 外部網站 API 使用量記錄表
-- 用於追蹤外部網站 API 的使用情況
-- 注意：api_usage_logs 已存在用於 AI token 追蹤，所以使用新表名

-- 建立外部網站 API 使用量記錄表
CREATE TABLE IF NOT EXISTS public.external_site_api_logs (
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
CREATE INDEX IF NOT EXISTS idx_external_site_api_logs_website_id ON public.external_site_api_logs(website_id);
CREATE INDEX IF NOT EXISTS idx_external_site_api_logs_created_at ON public.external_site_api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_site_api_logs_endpoint ON public.external_site_api_logs(endpoint);

-- 複合索引：用於統計查詢
CREATE INDEX IF NOT EXISTS idx_external_site_api_logs_website_date
ON public.external_site_api_logs(website_id, created_at DESC);

-- 建立每日統計視圖
CREATE OR REPLACE VIEW public.external_site_api_daily_stats AS
SELECT
    website_id,
    DATE(created_at) as date,
    endpoint,
    COUNT(*) as request_count,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count,
    COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
    AVG(response_time_ms)::INTEGER as avg_response_time_ms,
    MAX(response_time_ms) as max_response_time_ms
FROM public.external_site_api_logs
GROUP BY website_id, DATE(created_at), endpoint;

-- 註解
COMMENT ON TABLE public.external_site_api_logs IS '外部網站 API 使用量記錄，用於追蹤外部網站 API 調用';
COMMENT ON COLUMN public.external_site_api_logs.website_id IS '網站 ID';
COMMENT ON COLUMN public.external_site_api_logs.endpoint IS 'API 端點路徑';
COMMENT ON COLUMN public.external_site_api_logs.method IS 'HTTP 方法';
COMMENT ON COLUMN public.external_site_api_logs.status_code IS 'HTTP 回應狀態碼';
COMMENT ON COLUMN public.external_site_api_logs.response_time_ms IS '回應時間（毫秒）';
COMMENT ON COLUMN public.external_site_api_logs.request_ip IS '請求 IP';
COMMENT ON COLUMN public.external_site_api_logs.user_agent IS '請求 User-Agent';

-- RLS 政策（僅允許 service role 操作）
ALTER TABLE public.external_site_api_logs ENABLE ROW LEVEL SECURITY;

-- 允許 service role 完整存取
CREATE POLICY "Service role can manage external_site_api_logs"
ON public.external_site_api_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 授予 service_role 權限
GRANT ALL ON public.external_site_api_logs TO service_role;
GRANT SELECT ON public.external_site_api_daily_stats TO service_role;
