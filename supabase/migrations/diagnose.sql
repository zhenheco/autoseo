-- =====================================================
-- 診斷腳本：檢查資料庫狀態
-- =====================================================

-- 1. 檢查是否已存在 affiliates 表
SELECT
  'affiliates table exists' as status,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'affiliates';

-- 2. 如果存在，查看其結構
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'affiliates'
ORDER BY ordinal_position;

-- 3. 檢查是否有 companies 表
SELECT
  'companies table' as check_type,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'companies') as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'companies';

-- 4. 如果 companies 表存在，查看其結構
SELECT
  'companies columns:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

-- 5. 檢查所有與 affiliate 相關的表
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%affiliate%'
ORDER BY table_name;

-- 6. 檢查所有外鍵約束
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name LIKE '%affiliate%' OR ccu.table_name LIKE '%affiliate%')
ORDER BY tc.table_name;
