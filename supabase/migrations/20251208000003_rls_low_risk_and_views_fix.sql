-- Migration: RLS Low Risk + Views Fix
-- Description: 修復低風險表格和 Views 的安全問題
-- Phase: 3 of 3

-- ============================================
-- 1. subscription_plans (公開讀取)
-- 定價方案，所有人可查看
-- ============================================

DROP POLICY IF EXISTS "Anyone can read subscription plans" ON subscription_plans;
CREATE POLICY "Anyone can read subscription plans"
ON public.subscription_plans FOR SELECT
USING (true);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. token_packages (公開讀取)
-- Token 方案，所有人可查看
-- ============================================

DROP POLICY IF EXISTS "Anyone can read token packages" ON token_packages;
CREATE POLICY "Anyone can read token packages"
ON public.token_packages FOR SELECT
USING (true);

ALTER TABLE public.token_packages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. affiliate_tiers (公開讀取)
-- 聯盟層級，所有人可查看
-- ============================================

DROP POLICY IF EXISTS "Anyone can read affiliate tiers" ON affiliate_tiers;
CREATE POLICY "Anyone can read affiliate tiers"
ON public.affiliate_tiers FOR SELECT
USING (true);

ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. 修復 Views (改為 SECURITY INVOKER)
-- SECURITY INVOKER 表示使用查詢者的權限
-- ============================================

-- 4.1 agent_execution_stats
DROP VIEW IF EXISTS public.agent_execution_stats;
CREATE VIEW public.agent_execution_stats
WITH (security_invoker = true)
AS
SELECT
    ae.agent_name,
    COUNT(*) as total_executions,
    SUM(CASE WHEN ae.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN ae.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    ROUND(AVG(ae.execution_time_ms), 2) as avg_execution_time_ms,
    MAX(ae.execution_time_ms) as max_execution_time_ms,
    MIN(ae.execution_time_ms) as min_execution_time_ms
FROM agent_executions ae
WHERE ae.status IN ('completed', 'failed')
GROUP BY ae.agent_name;

COMMENT ON VIEW agent_execution_stats IS 'Agent 執行統計視圖 (SECURITY INVOKER)';

-- 4.2 daily_cost_stats
DROP VIEW IF EXISTS public.daily_cost_stats;
CREATE VIEW public.daily_cost_stats
WITH (security_invoker = true)
AS
SELECT
    DATE(act.created_at) as date,
    act.agent_name,
    act.model,
    SUM(act.input_tokens) as total_input_tokens,
    SUM(act.output_tokens) as total_output_tokens,
    SUM(act.cost_usd) as total_cost_usd,
    SUM(act.cost_twd) as total_cost_twd,
    COUNT(*) as execution_count
FROM agent_cost_tracking act
GROUP BY DATE(act.created_at), act.agent_name, act.model
ORDER BY date DESC, total_cost_usd DESC;

COMMENT ON VIEW daily_cost_stats IS '每日成本統計視圖 (SECURITY INVOKER)';
