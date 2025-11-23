-- =====================================================
-- 診斷 SQL：檢查 companies 表是否存在
-- =====================================================

-- 1. 檢查 companies 表是否存在
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'companies';

-- 2. 如果存在，查看欄位結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
ORDER BY ordinal_position;

-- 3. 列出所有 public schema 的資料表
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
