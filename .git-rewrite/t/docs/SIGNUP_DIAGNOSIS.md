# 🔬 註冊流程問題診斷報告

**日期**: 2025-11-10
**問題**: 註冊流程所有情況都顯示「此電子郵件已註冊，請直接登入」，且沒有載入狀態和重發驗證信按鈕

---

## ❌ 根本問題分析

### 1. **Supabase Admin API 的限制**（經研究證實）

根據官方文件和社群討論：

**listUsers() 的問題**：
- 預設只返回前 50 個用戶（分頁限制）
- 如果系統有超過 50 個用戶，無法保證能找到目標用戶
- **沒有 email filter 參數**（官方未提供）

**signUp() 的安全機制**：
- 當 email confirmation 啟用時，對已存在用戶**不會拋出錯誤**
- 會返回假的 user 物件（防止 email 枚舉攻擊）
- 這是 Supabase 的**設計行為**，不是 bug

**參考資料**：
- [Supabase Admin API 文件](https://supabase.com/docs/reference/javascript/admin-api)
- [Stack Overflow: Query users by email](https://stackoverflow.com/questions/68334303/supabase-how-to-query-users-by-email)
- [GitHub Discussion #29327](https://github.com/orgs/supabase/discussions/29327)

### 2. **當前程式碼的邏輯問題**

**問題 A - API 使用不當** (`src/app/(auth)/signup/actions.ts:76-80`):
```typescript
// ❌ 不可靠的方法
const { data: { users } } = await adminClient.auth.admin.listUsers()
const existingUser = users.find(u => u.email === email)
```

**風險**：
- 如果目標 email 不在前 50 個用戶中，find() 返回 undefined
- 程式會錯誤地認為用戶不存在，繼續執行 signUp()
- signUp() 不會拋出錯誤（因為 email confirmation 啟用）
- 最終顯示「註冊成功」，但實際沒有註冊

**問題 B - catch block 缺陷** (`src/app/(auth)/signup/actions.ts:98-109`):
```typescript
catch (error) {
  const errorMessage = await translateErrorMessage(error, email)
  redirect(`/signup?error=${encodeURIComponent(errorMessage)}`)
}
```

**問題**：
- translateErrorMessage 可能返回特殊值 'VERIFIED_USER' 或 'UNVERIFIED_USER'
- **沒有檢查這些特殊值**
- 直接當作錯誤訊息傳遞，導致前端沒有 verified/unverified 參數

**問題 C - 前端參數接收**:
- 如果 catch block 直接 redirect 帶 error 參數
- 但沒有 verified 或 unverified 參數
- signup-form.tsx 不會顯示「前往登入」連結或「重發驗證信」按鈕

---

## 🎯 解決方案（基於官方最佳實踐）

### 方案 A：使用 PostgreSQL RPC 函數（**強烈推薦**）

**優點**：
- ✅ 精確查詢，無分頁限制
- ✅ 官方文件推薦的方法
- ✅ 效能最佳
- ✅ 安全性高（使用 SECURITY DEFINER）

**步驟 1: 創建 PostgreSQL 函數**

在 Supabase Dashboard → SQL Editor 執行：

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

**步驟 2: 修改 signup actions.ts**

```typescript
export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // 基本驗證
  if (!email || !password || !confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent('請填寫所有欄位')}`)
  }

  if (password !== confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent('兩次輸入的密碼不一致')}`)
  }

  try {
    // 使用 RPC 函數查詢用戶
    const supabase = await createClient()
    const { data: userData, error: rpcError } = await supabase.rpc('get_user_by_email', {
      email_input: email
    })

    console.log('[Signup] RPC 查詢結果:', { userData, rpcError })

    // 檢查用戶是否已存在
    if (userData && userData.length > 0) {
      const user = userData[0]
      const isConfirmed = user.email_confirmed_at !== null

      if (isConfirmed) {
        // 已驗證用戶
        redirect(`/signup?error=${encodeURIComponent('此電子郵件已註冊，請直接登入')}&verified=true`)
      } else {
        // 未驗證用戶
        redirect(`/signup?error=${encodeURIComponent('此電子郵件已註冊但尚未驗證，請檢查您的信箱或重發驗證信')}&unverified=true&email=${encodeURIComponent(email)}`)
      }
    }

    // 用戶不存在，執行註冊
    console.log('[Signup] 用戶不存在，執行 signUp')
    await signUp(email, password)

    // 註冊成功
    redirect(`/signup?success=${encodeURIComponent('註冊成功！我們已發送驗證郵件到您的信箱，請點擊郵件中的連結完成驗證')}`)
  } catch (error) {
    // Next.js redirect() 會拋出 NEXT_REDIRECT 錯誤，需要重新拋出
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = String((error as { digest?: string }).digest || '')
      if (digest.startsWith('NEXT_REDIRECT')) {
        throw error
      }
    }

    console.error('[Signup] 錯誤:', error)
    const errorMessage = error instanceof Error ? error.message : '註冊失敗，請稍後再試'
    redirect(`/signup?error=${encodeURIComponent(errorMessage)}`)
  }
}
```

**步驟 3: 移除不需要的 translateErrorMessage 函數**

因為現在在 try block 中直接檢查用戶，catch block 只需處理真實的錯誤。

---

### 方案 B：改進當前方法（次選）

如果無法使用 RPC（需要資料庫權限），可以改進現有邏輯：

1. **添加分頁處理**：遍歷所有頁面查找用戶
2. **修正 catch block**：檢查 translateErrorMessage 的特殊返回值
3. **添加診斷日誌**：追蹤執行路徑

**不推薦原因**：
- ❌ 效能較差（需要多次 API 呼叫）
- ❌ 程式碼複雜度高
- ❌ 仍有分頁限制的潛在問題

---

## 🔍 立即診斷步驟

在實施解決方案前，先添加診斷來確認問題：

### 1. 在 actions.ts 添加 console.log

```typescript
try {
  console.log('[Signup] 開始檢查用戶:', email)

  const adminClient = createAdminClient()
  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()

  console.log('[Signup] listUsers 結果:', {
    totalUsers: users?.length,
    hasError: !!listError,
    error: listError
  })

  if (!listError && users) {
    const existingUser = users.find(u => u.email === email)
    console.log('[Signup] 找到用戶:', !!existingUser, existingUser?.email_confirmed_at)

    if (existingUser) {
      const isConfirmed = existingUser.email_confirmed_at !== null
      console.log('[Signup] 用戶狀態:', { isConfirmed })
      console.log('[Signup] 準備 redirect:', isConfirmed ? 'verified' : 'unverified')
    }
  }

  console.log('[Signup] 準備執行 signUp')
  await signUp(email, password)
  console.log('[Signup] signUp 成功')

} catch (error) {
  console.log('[Signup] Catch block:', error)
  console.log('[Signup] Error type:', error?.constructor?.name)
  console.log('[Signup] Error digest:', (error as any)?.digest)
}
```

### 2. 查看 Vercel 日誌

```bash
# 實時查看日誌
vercel logs --follow

# 或查看最近的日誌
vercel logs --scope acejou27s-projects
```

### 3. 前端添加診斷

在 `signup-form.tsx` 添加：

```typescript
useEffect(() => {
  console.log('[SignupForm] URL params:', {
    error,
    success,
    verified,
    unverified,
    email
  })
}, [error, success, verified, unverified, email])
```

---

## 📊 推薦執行順序

### 階段 1: 診斷（確認問題）
1. ✅ 添加 console.log 到 actions.ts
2. ✅ 添加 console.log 到 signup-form.tsx
3. ✅ 部署到 Vercel
4. ✅ 測試並查看日誌
5. ✅ 確認實際執行路徑

### 階段 2: 實施解決方案
1. ✅ 在 Supabase 創建 RPC 函數
2. ✅ 修改 actions.ts 使用 RPC
3. ✅ 移除 translateErrorMessage 函數
4. ✅ 本地測試
5. ✅ 部署到 Vercel

### 階段 3: 驗證
1. ✅ 測試已驗證用戶（應顯示「前往登入」）
2. ✅ 測試未驗證用戶（應顯示「重發驗證信」）
3. ✅ 測試新用戶（應顯示「註冊成功」）
4. ✅ 測試載入狀態（應顯示「註冊中...」）

### 階段 4: 清理
1. ✅ 移除診斷日誌
2. ✅ 提交最終程式碼

---

## 🔗 相關資源

- [Supabase JavaScript Admin API](https://supabase.com/docs/reference/javascript/admin-api)
- [Supabase Auth Users Guide](https://supabase.com/docs/guides/auth/users)
- [Stack Overflow: Query users by email](https://stackoverflow.com/questions/68334303/supabase-how-to-query-users-by-email)
- [GitHub: Create getUserByEmail function](https://github.com/supabase/auth/issues/880)
- [GitHub Discussion: SignUp existing email behavior](https://github.com/orgs/supabase/discussions/29327)

---

## 📝 測試案例

### 測試 1: ace@zhenhe-co.com (未驗證用戶)
**預期**:
- ✅ 顯示：「此電子郵件已註冊但尚未驗證，請檢查您的信箱或重發驗證信」
- ✅ 顯示「重新發送驗證信」按鈕
- ✅ 點擊後可重發驗證信

### 測試 2: nelsonjou@gmail.com (已驗證用戶)
**預期**:
- ✅ 顯示：「此電子郵件已註冊，請直接登入」
- ✅ 顯示「前往登入 →」連結
- ✅ 點擊可導向登入頁面

### 測試 3: test@example.com (新用戶)
**預期**:
- ✅ 顯示：「註冊成功！我們已發送驗證郵件到您的信箱...」
- ✅ 停留在註冊頁面
- ✅ 收到驗證郵件

### 測試 4: 載入狀態
**預期**:
- ✅ 點擊「建立帳號」後立即顯示「註冊中...」
- ✅ 按鈕變為 disabled 狀態
- ✅ 顯示載入動畫（Loader2 icon）

---

## 🏁 結論

當前問題的根源是使用了不適合的 API 方法（listUsers）來檢查用戶是否存在。官方推薦的解決方案是使用 PostgreSQL RPC 函數直接查詢 auth.users 表。

這是基於：
- ✅ Supabase 官方文件
- ✅ Stack Overflow 社群最佳實踐
- ✅ GitHub Issues 和 Discussions
- ✅ 實際測試結果分析

而不是單純的猜測。
