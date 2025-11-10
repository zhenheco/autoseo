# Design: Fix Signup User Existence Check

## Context

當前註冊系統使用 Supabase Admin API 的 `listUsers()` 方法檢查用戶是否已存在，但這個方法：
1. 有分頁限制（預設 50 筆）
2. 沒有 email filter 參數
3. 配合 Supabase 的 email confirmation 安全機制，導致無法可靠地偵測已存在用戶

**Supabase 官方文件和社群最佳實踐**建議使用 PostgreSQL RPC 函數直接查詢 `auth.users` 表。

**參考資料**：
- [Supabase Admin API 文件](https://supabase.com/docs/reference/javascript/admin-api)
- [Stack Overflow: Query users by email](https://stackoverflow.com/questions/68334303/supabase-how-to-query-users-by-email)
- [GitHub Discussion #29327](https://github.com/orgs/supabase/discussions/29327)

## Goals / Non-Goals

### Goals
- ✅ 精確查詢用戶是否存在（無分頁限制）
- ✅ 區分已驗證和未驗證用戶
- ✅ 提供正確的用戶反饋（前往登入 vs 重發驗證信）
- ✅ 保持代碼簡潔和可維護性
- ✅ 遵循官方推薦的最佳實踐

### Non-Goals
- ❌ 不改變前端組件（已經支援 verified/unverified 參數）
- ❌ 不修改 Supabase 認證流程本身
- ❌ 不需要複雜的快取機制（查詢已經很快）

## Decisions

### Decision 1: 使用 PostgreSQL RPC 函數

**Why**:
- 官方推薦方法
- 效能最佳（直接查詢資料庫）
- 精確查詢，無分頁限制
- 安全性高（使用 SECURITY DEFINER）

**Alternatives considered**:
1. **改進 listUsers 分頁遍歷**：
   - ❌ 效能差（需要多次 API 呼叫）
   - ❌ 程式碼複雜度高
   - ❌ 仍有潛在問題（大量用戶時）

2. **使用 Supabase Edge Functions**：
   - ❌ 額外的部署和維護成本
   - ❌ 不必要的複雜性
   - ❌ RPC 函數已經足夠

### Decision 2: 在 try block 中直接檢查用戶

**Why**:
- 邏輯清晰，不依賴 catch block 進行流程控制
- 可以精確控制返回的參數（verified/unverified）
- 避免使用 catch block 做非錯誤的流程控制

**Before** (使用 catch block 做流程控制):
```typescript
try {
  await signUp(email, password)  // 不會拋出錯誤
} catch (error) {
  // 嘗試從錯誤訊息判斷用戶狀態（不可靠）
  const msg = await translateErrorMessage(error, email)
  redirect(`/signup?error=${msg}`)
}
```

**After** (在 try block 中明確檢查):
```typescript
try {
  const user = await getUserByEmail(email)
  if (user) {
    if (user.email_confirmed_at) {
      redirect(`/signup?error=...&verified=true`)
    } else {
      redirect(`/signup?error=...&unverified=true&email=${email}`)
    }
  }
  await signUp(email, password)
  redirect(`/signup?success=...`)
} catch (error) {
  // 只處理真實錯誤
}
```

### Decision 3: 移除 translateErrorMessage 函數

**Why**:
- 不再需要從錯誤訊息推斷用戶狀態
- 減少代碼複雜度
- 避免依賴容易變化的錯誤訊息格式

## RPC Function Implementation

```sql
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
  SELECT au.id, au.email, au.email_confirmed_at
  FROM auth.users au
  WHERE au.email = email_input;
END;
$$ LANGUAGE plpgsql;

-- 限制只有 service_role 可以執行
REVOKE EXECUTE ON FUNCTION get_user_by_email FROM anon, authenticated, public;
```

**安全性考量**:
- 使用 `SECURITY DEFINER` 確保函數以定義者權限執行
- 明確 REVOKE 公開訪問權限
- 只返回必要的欄位（id, email, email_confirmed_at）

## Risks / Trade-offs

### Risk 1: RPC 函數需要資料庫權限
- **Mitigation**: 提供清晰的 SQL 腳本和執行步驟
- **Fallback**: 如果無法創建 RPC，可以使用改進的分頁遍歷方案（但不推薦）

### Risk 2: SECURITY DEFINER 函數的安全風險
- **Mitigation**:
  - 只查詢必要欄位
  - 使用參數化查詢防止 SQL 注入
  - 明確 REVOKE 公開權限

### Trade-off: 依賴自定義 SQL 函數
- **好處**: 效能最佳、精確查詢
- **代價**: 需要在資料庫層面維護額外的函數
- **決策**: 接受，因為這是官方推薦且簡單的函數

## Migration Plan

### Step 1: 創建 RPC 函數
1. 登入 Supabase Dashboard
2. 前往 SQL Editor
3. 執行 RPC 函數創建腳本
4. 驗證函數創建成功

### Step 2: 修改應用代碼
1. 修改 `signup/actions.ts` 使用 RPC
2. 本地測試驗證
3. 提交代碼

### Step 3: 部署驗證
1. 部署到 Vercel
2. 測試所有用戶場景
3. 監控錯誤日誌

### Rollback Strategy
如果 RPC 函數出現問題：
1. 立即回滾到前一版本代碼
2. 檢查 RPC 函數權限設定
3. 如有必要，刪除並重新創建 RPC 函數

## Open Questions

- [x] **Q**: RPC 函數是否會影響效能？
  - **A**: 不會，直接查詢資料庫比多次 API 呼叫更快

- [x] **Q**: 是否需要快取 RPC 結果？
  - **A**: 不需要，查詢已經很快，且註冊是低頻操作

- [x] **Q**: 前端組件是否需要修改？
  - **A**: 不需要，前端已經支援 verified/unverified 參數
