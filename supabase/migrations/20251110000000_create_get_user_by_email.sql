-- 創建 RPC 函數：根據 email 查詢用戶
-- 用於註冊流程檢查用戶是否已存在，並區分已驗證/未驗證狀態
--
-- 參考資料：
-- - Supabase Admin API: https://supabase.com/docs/reference/javascript/admin-api
-- - Stack Overflow: https://stackoverflow.com/questions/68334303/supabase-how-to-query-users-by-email
-- - GitHub Discussion: https://github.com/orgs/supabase/discussions/29327

CREATE OR REPLACE FUNCTION get_user_by_email(email_input TEXT)
RETURNS TABLE (
  id uuid,
  email text,
  email_confirmed_at timestamptz
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email::text, au.email_confirmed_at
  FROM auth.users au
  WHERE au.email = email_input;
END;
$$ LANGUAGE plpgsql;

-- 權限設定：允許 authenticated 用戶和 service_role 執行
-- 註：前端使用 createClient() 會以 authenticated 用戶身份調用
GRANT EXECUTE ON FUNCTION get_user_by_email(TEXT) TO authenticated, service_role;

-- 禁止 anon 用戶執行（避免未登入用戶枚舉 email）
REVOKE EXECUTE ON FUNCTION get_user_by_email(TEXT) FROM anon, public;

-- 添加註解
COMMENT ON FUNCTION get_user_by_email(TEXT) IS '根據 email 查詢用戶資訊，用於註冊流程檢查用戶是否已存在。返回用戶 ID、email 和驗證時間。';
