-- 修復所有函數的 search_path 安全問題
-- 參考：https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- 設定 search_path = '' 可防止 SQL 注入攻擊

-- ============================================
-- 修復所有 public schema 的函數
-- ============================================

-- Token 相關函數
ALTER FUNCTION public.check_and_reserve_tokens SET search_path = '';
ALTER FUNCTION public.create_token_reservation SET search_path = '';
ALTER FUNCTION public.consume_token_reservation SET search_path = '';
ALTER FUNCTION public.release_token_reservation SET search_path = '';
ALTER FUNCTION public.cleanup_stale_reservations SET search_path = '';
ALTER FUNCTION public.get_active_reservations_total SET search_path = '';
ALTER FUNCTION public.deduct_tokens_atomic SET search_path = '';
ALTER FUNCTION public.add_company_tokens SET search_path = '';
ALTER FUNCTION public.calculate_billing_tokens SET search_path = '';

-- 配額相關函數
ALTER FUNCTION public.check_quota SET search_path = '';
ALTER FUNCTION public.consume_quota SET search_path = '';
ALTER FUNCTION public.deduct_article_quota SET search_path = '';
ALTER FUNCTION public.reset_monthly_quota_if_needed SET search_path = '';
ALTER FUNCTION public.reset_monthly_quotas SET search_path = '';
ALTER FUNCTION public.reset_daily_quota SET search_path = '';
ALTER FUNCTION public.reset_all_expired_quotas SET search_path = '';
ALTER FUNCTION public.get_company_quota_status SET search_path = '';
ALTER FUNCTION public.check_and_increment_perplexity_quota SET search_path = '';
ALTER FUNCTION public.update_purchased_articles_total SET search_path = '';

-- AI 模型相關函數
ALTER FUNCTION public.get_company_ai_models SET search_path = '';
ALTER FUNCTION public.get_active_text_models SET search_path = '';
ALTER FUNCTION public.get_active_image_models SET search_path = '';
ALTER FUNCTION public.get_models_by_provider SET search_path = '';
ALTER FUNCTION public.get_model_fallback_chain SET search_path = '';
ALTER FUNCTION public.get_simple_processing_models SET search_path = '';
ALTER FUNCTION public.get_complex_processing_models SET search_path = '';

-- 文章相關函數
ALTER FUNCTION public.auto_update_article_status SET search_path = '';
ALTER FUNCTION public.calculate_article_similarity SET search_path = '';
ALTER FUNCTION public.generate_article_recommendations SET search_path = '';
ALTER FUNCTION public.reset_article_views_daily SET search_path = '';
ALTER FUNCTION public.reset_article_views_weekly SET search_path = '';
ALTER FUNCTION public.reset_article_views_monthly SET search_path = '';

-- 翻譯相關函數
ALTER FUNCTION public.get_article_translations SET search_path = '';
ALTER FUNCTION public.schedule_article_with_translations SET search_path = '';
ALTER FUNCTION public.cancel_translation_schedule SET search_path = '';
ALTER FUNCTION public.publish_translation SET search_path = '';
ALTER FUNCTION public.get_pending_translation_publishes SET search_path = '';
ALTER FUNCTION public.get_article_hreflang SET search_path = '';

-- 推薦/聯盟相關函數
ALTER FUNCTION public.generate_referral_code SET search_path = '';
ALTER FUNCTION public.increment_referral_clicks SET search_path = '';
ALTER FUNCTION public.increment_referral_count(UUID) SET search_path = '';
-- 注意：increment_referral_count(UUID, INTEGER) 這個 overload 不存在，已移除
ALTER FUNCTION public.increment_successful_referrals SET search_path = '';
ALTER FUNCTION public.get_referrals_with_email SET search_path = '';
ALTER FUNCTION public.check_referral_loop SET search_path = '';
ALTER FUNCTION public.add_referral_article_reward SET search_path = '';
ALTER FUNCTION public.update_affiliate_commission SET search_path = '';
ALTER FUNCTION public.update_affiliate_tier SET search_path = '';
ALTER FUNCTION public.unlock_affiliate_commissions SET search_path = '';
ALTER FUNCTION public.update_reseller_stats SET search_path = '';

-- 欺詐檢測函數
ALTER FUNCTION public.get_same_device_accounts SET search_path = '';

-- Agent 相關函數
ALTER FUNCTION public.get_or_create_agent_config SET search_path = '';
ALTER FUNCTION public.log_agent_execution SET search_path = '';
ALTER FUNCTION public.log_agent_cost SET search_path = '';
ALTER FUNCTION public.get_agent_execution_stats SET search_path = '';
ALTER FUNCTION public.create_default_workflow_settings SET search_path = '';
ALTER FUNCTION public.get_current_processing_stage SET search_path = '';
ALTER FUNCTION public.calculate_workflow_duration SET search_path = '';

-- 關鍵字相關函數
ALTER FUNCTION public.mark_keyword_used SET search_path = '';
ALTER FUNCTION public.get_next_keyword SET search_path = '';

-- 快取清理函數
ALTER FUNCTION public.cleanup_expired_cache SET search_path = '';
ALTER FUNCTION public.cleanup_expired_analytics_cache SET search_path = '';
ALTER FUNCTION public.cleanup_old_oauth_metrics SET search_path = '';

-- 加密函數
ALTER FUNCTION public.encrypt_data SET search_path = '';
ALTER FUNCTION public.decrypt_data SET search_path = '';

-- 用戶/公司相關函數
ALTER FUNCTION public.handle_new_user SET search_path = '';
ALTER FUNCTION public.create_company_for_user SET search_path = '';
ALTER FUNCTION public.get_user_by_email SET search_path = '';
ALTER FUNCTION public.has_permission SET search_path = '';

-- OAuth 相關函數
ALTER FUNCTION public.get_website_oauth_status SET search_path = '';
ALTER FUNCTION public.update_mandate_after_payment SET search_path = '';

-- updated_at 觸發器函數
ALTER FUNCTION public.update_updated_at_column SET search_path = '';
ALTER FUNCTION public.update_article_views_updated_at SET search_path = '';
ALTER FUNCTION public.update_suspicious_referrals_updated_at SET search_path = '';
ALTER FUNCTION public.update_payment_orders_updated_at SET search_path = '';
ALTER FUNCTION public.update_google_oauth_tokens_updated_at SET search_path = '';
ALTER FUNCTION public.update_refund_requests_updated_at SET search_path = '';
ALTER FUNCTION public.update_translations_updated_at SET search_path = '';
ALTER FUNCTION public.update_article_cache_updated_at SET search_path = '';
ALTER FUNCTION public.update_ai_models_updated_at SET search_path = '';
ALTER FUNCTION public.update_generated_articles_updated_at SET search_path = '';

-- ============================================
-- 將 http 擴展移到 extensions schema
-- ============================================

-- 確保 extensions schema 存在
CREATE SCHEMA IF NOT EXISTS extensions;

-- 授予必要權限
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 重新創建 http 擴展在 extensions schema
DROP EXTENSION IF EXISTS http;
CREATE EXTENSION http WITH SCHEMA extensions;

-- 授予 http 擴展的使用權限
GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, service_role;

COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions';
