-- =====================================================
-- 生產環境 OAuth 清理腳本
-- =====================================================
-- 警告：執行前請確認已備份資料庫
--
-- 此腳本用於清理生產環境中殘留的 OAuth 相關物件
-- 包括：觸發器、函數、表格
--
-- 執行順序：
-- 1. 先執行檢查 SQL 確認有哪些物件存在
-- 2. 執行清理 SQL 移除這些物件
-- 3. 再次執行驗證 SQL 確認清理成功
-- =====================================================

-- =====================================================
-- 第一步：檢查是否有 OAuth 物件
-- =====================================================

-- 檢查 OAuth 相關表格
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'oauth_login_metrics';

-- 檢查 OAuth 相關觸發器
SELECT
  trigger_schema,
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%oauth%';

-- 檢查 OAuth 相關函數
SELECT
  routine_schema,
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name LIKE '%oauth%';

-- =====================================================
-- 第二步：移除 OAuth 物件
-- =====================================================

-- 移除觸發器
DROP TRIGGER IF EXISTS on_auth_user_created_oauth ON auth.users;

-- 移除函數
DROP FUNCTION IF EXISTS handle_new_oauth_user();
DROP FUNCTION IF EXISTS create_company_for_oauth_user(UUID, TEXT, TEXT);

-- 移除表格
DROP TABLE IF EXISTS oauth_login_metrics;

-- =====================================================
-- 第三步：驗證清理結果
-- =====================================================

-- 再次檢查表格（應該返回 0 行）
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_name = 'oauth_login_metrics';

-- 再次檢查觸發器（應該返回 0 行）
SELECT
  trigger_schema,
  trigger_name
FROM information_schema.triggers
WHERE trigger_name LIKE '%oauth%';

-- 再次檢查函數（應該返回 0 行）
SELECT
  routine_schema,
  routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%oauth%';

-- =====================================================
-- 清理完成
-- =====================================================
-- 如果驗證 SQL 都返回 0 行，表示 OAuth 物件已成功移除
