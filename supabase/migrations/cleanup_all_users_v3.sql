-- =====================================================
-- 清除所有使用者和相關資料腳本 (v3 - 安全版本)
-- =====================================================
-- 警告：這將刪除所有使用者資料，無法恢復！
-- 僅用於開發環境清理，生產環境請謹慎使用
-- =====================================================

-- =====================================================
-- 方案一：使用 DO 區塊安全刪除（推薦）
-- =====================================================

DO $$
DECLARE
    table_record RECORD;
BEGIN
    -- 刪除 public schema 中的所有資料
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DELETE FROM %I', table_record.tablename);
        RAISE NOTICE 'Deleted all rows from %', table_record.tablename;
    END LOOP;

    -- 刪除所有使用者
    DELETE FROM auth.users;
    RAISE NOTICE 'Deleted all users from auth.users';
END $$;

-- =====================================================
-- 驗證清理結果
-- =====================================================

-- 檢查 auth.users
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users;

-- 檢查所有 public schema 的表格
SELECT
    schemaname,
    tablename,
    (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
    SELECT
        schemaname,
        tablename,
        query_to_xml(
            format('SELECT COUNT(*) as cnt FROM %I.%I', schemaname, tablename),
            false,
            true,
            ''
        ) as xml_count
    FROM pg_tables
    WHERE schemaname = 'public'
) t
ORDER BY tablename;
