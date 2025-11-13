# 註冊/登入流程修正計畫

## 📋 問題分析

根據探索結果，發現以下問題：

### 🔴 主要問題
**nelsonjou@gmail.com 顯示「註冊失敗」**
- **原因**: `get_user_by_email` RPC 函數不存在
- **影響**: 已驗證用戶檢查失敗，導致錯誤訊息
- **位置**: `/src/app/(auth)/signup/actions.ts:24`

### ✅ 已正確實作
- ace@zhenhe-co.com（未驗證）→ 提示重發驗證信 ✅
- avy@zhenhe-co.com（新用戶）→ 註冊成功 ✅
- 載入狀態（註冊中...、登入中...）✅

---

## 🔧 修正方案

### 步驟 1: 建立資料庫 RPC 函數

在 Supabase SQL Editor 中執行：

```sql
CREATE OR REPLACE FUNCTION get_user_by_email(email_input TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  email_confirmed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email::TEXT, u.email_confirmed_at
  FROM auth.users u
  WHERE u.email = email_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 賦予執行權限給 authenticated 和 anon 角色
GRANT EXECUTE ON FUNCTION get_user_by_email(TEXT) TO authenticated, anon;
```

**說明**:
- `SECURITY DEFINER`: 使函數以創建者權限執行，可存取 `auth.users`
- `GRANT EXECUTE`: 允許前端調用此函數

---

### 步驟 2: 驗證前端顯示邏輯

檢查 `/src/app/(auth)/signup/page.tsx` 確保正確處理三種情況：

#### 情況 1: 已驗證用戶 (`verified=true`)
```typescript
// URL: /signup?error=此電子郵件已註冊，請直接登入&verified=true
顯示:
- ❌ 錯誤訊息：「此電子郵件已註冊，請直接登入」
- 🔗 按鈕：「前往登入 →」
```

#### 情況 2: 未驗證用戶 (`unverified=true`)
```typescript
// URL: /signup?error=此電子郵件已註冊但尚未驗證...&unverified=true&email=xxx
顯示:
- ⚠️ 警告訊息：「此電子郵件已註冊但尚未驗證」
- 📧 按鈕：「重發驗證郵件」
```

#### 情況 3: 新用戶（無特殊參數）
```typescript
// URL: /signup?success=註冊成功！我們已發送驗證郵件...
顯示:
- ✅ 成功訊息：「註冊成功！請查收驗證郵件」
```

---

### 步驟 3: 測試流程

#### 測試案例 1: nelsonjou@gmail.com（已驗證）
1. 訪問註冊頁面
2. 輸入 nelsonjou@gmail.com + 密碼
3. 點擊「建立帳號」
4. **預期結果**:
   - 顯示「此電子郵件已註冊，請直接登入」
   - 出現「前往登入 →」按鈕
   - 點擊按鈕跳轉到 `/login?email=nelsonjou@gmail.com`

#### 測試案例 2: ace@zhenhe-co.com（未驗證）
1. 訪問註冊頁面
2. 輸入 ace@zhenhe-co.com + 密碼
3. 點擊「建立帳號」
4. **預期結果**:
   - 顯示「此電子郵件已註冊但尚未驗證」
   - 出現「重發驗證郵件」按鈕
   - 點擊按鈕調用 `/api/auth/resend-verification`

#### 測試案例 3: 新信箱（如 test@example.com）
1. 訪問註冊頁面
2. 輸入新信箱 + 密碼
3. 點擊「建立帳號」
4. **預期結果**:
   - 顯示「註冊成功！我們已發送驗證郵件到您的信箱」
   - 自動建立公司、成員、訂閱、推薦碼

#### 測試案例 4: 載入狀態
1. 點擊「建立帳號」或「繼續」按鈕
2. **預期結果**:
   - 按鈕文字變為「註冊中...」或「登入中...」
   - 顯示旋轉的 Loader 圖示
   - 按鈕變為 disabled 狀態

---

## 📁 影響檔案

### 資料庫
- **Supabase Database** - 新增 `get_user_by_email` RPC 函數

### 後端
- `/src/app/(auth)/signup/actions.ts` - 調用 RPC 函數（已實作，只需確認）
- `/src/lib/auth.ts` - 註冊核心邏輯（無需修改）

### 前端
- `/src/app/(auth)/signup/page.tsx` - 驗證顯示邏輯（需檢查）
- `/src/app/(auth)/signup/signup-form.tsx` - 載入狀態（已正確實作）
- `/src/app/(auth)/login/login-form.tsx` - 載入狀態（已正確實作）

---

## ✅ 預期結果

完成修正後，三種信箱類型應有不同的反應：

| 信箱類型 | 範例 | 顯示訊息 | 操作按鈕 |
|---------|------|---------|---------|
| 已驗證 | nelsonjou@gmail.com | 此電子郵件已註冊，請直接登入 | 前往登入 → |
| 未驗證 | ace@zhenhe-co.com | 此電子郵件已註冊但尚未驗證 | 重發驗證郵件 |
| 新用戶 | avy@zhenhe-co.com | 註冊成功！請查收驗證郵件 | - |

---

## 🔍 技術細節

### RPC 函數工作原理

```typescript
// 前端調用 (signup/actions.ts:24)
const { data: userData } = await supabase.rpc('get_user_by_email', {
  email_input: email
})

// 資料庫執行
// 1. 接收 email_input 參數
// 2. 在 auth.users 中查詢對應的用戶
// 3. 返回 id, email, email_confirmed_at
// 4. 前端根據 email_confirmed_at 判斷驗證狀態

// 判斷邏輯
if (userData && userData.length > 0) {
  const user = userData[0]
  const isConfirmed = user.email_confirmed_at !== null // 已驗證

  if (isConfirmed) {
    redirect(`/signup?error=...&verified=true`) // 已驗證 → 去登入
  } else {
    redirect(`/signup?error=...&unverified=true&email=${email}`) // 未驗證 → 重發驗證
  }
}
```

### 載入狀態實作

```typescript
// signup-form.tsx:22
const [isSubmitting, setIsSubmitting] = useState(false)

// 提交處理
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true) // 開始載入

  try {
    await signup(formData) // 執行註冊
  } finally {
    setIsSubmitting(false) // 結束載入
  }
}

// 按鈕顯示
<Button disabled={isSubmitting}>
  {isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      註冊中...
    </>
  ) : '建立帳號'}
</Button>
```

---

## 📝 部署檢查清單

完成修正後，部署前確認：

- [ ] ✅ RPC 函數已在 Supabase 建立
- [ ] ✅ RPC 函數權限已設定（GRANT EXECUTE）
- [ ] ✅ 前端顯示邏輯已驗證
- [ ] ✅ 三種測試案例全部通過
- [ ] ✅ 載入狀態正常顯示
- [ ] ✅ `npm run build` 成功
- [ ] ✅ 無 TypeScript 錯誤
- [ ] ✅ 提交並推送到 main 分支

---

## 🚀 執行順序

1. **建立 RPC 函數** - 在 Supabase Dashboard 執行 SQL
2. **驗證前端邏輯** - 檢查 `/src/app/(auth)/signup/page.tsx`
3. **執行測試** - 測試三種信箱類型
4. **確認載入狀態** - 測試按鈕載入動畫
5. **本地建置** - `npm run build`
6. **部署** - 提交並推送到 main 分支

---

生成時間: 2025-11-10
