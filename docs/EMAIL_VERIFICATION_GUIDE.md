# Supabase Email Verification 實作指南

> **版本**: 1.0
> **最後更新**: 2025-01-11
> **適用專案**: Auto-pilot-SEO
> **技術棧**: Next.js 15 + Supabase (SSR) + TypeScript

---

## 📋 目錄

1. [問題說明](#問題說明)
2. [解決方案](#解決方案)
3. [實作步驟](#實作步驟)
4. [程式碼範例](#程式碼範例)
5. [Supabase Dashboard 設定](#supabase-dashboard-設定)
6. [測試流程](#測試流程)
7. [疑難排解](#疑難排解)
8. [技術細節](#技術細節)
9. [參考資料](#參考資料)

---

## 問題說明

### 現象

使用者註冊後收到驗證信，點擊驗證連結時出現 **404 錯誤**。

**驗證信 URL 格式**：

```
https://1wayseo.com/auth/callback?token_hash=pkce_59779374ce4b1cea59d970e683224c7287fa29d2dd88c63388f2b6fd&type=email
```

### 根本原因

專案缺少處理 email verification callback 的 route handler，導致 `/auth/callback` 路由無法被正確處理。

---

## 解決方案

### 方案比較

| 項目         | 方案 A: `/auth/confirm` ✅  | 方案 B: `/auth/callback`           |
| ------------ | --------------------------- | ---------------------------------- |
| 語義清晰度   | ✅ 更清楚（confirm = 確認） | ⚠️ 較模糊（callback 可能是 OAuth） |
| 官方文件支援 | ✅ 符合 Supabase 範例       | ⚠️ 需自行調整                      |
| 程式碼改動   | ⚠️ 需更新 emailRedirectTo   | ✅ 無需修改現有設定                |
| 維護性       | ✅ 更好                     | ⚠️ 可能與 OAuth 混淆               |

**採用方案**: **方案 A** (`/auth/confirm`)

---

## 實作步驟

### 步驟 1: 建立 Auth Confirm Route Handler

**建立檔案**: `src/app/auth/confirm/route.ts`

此檔案負責：

- 接收 email verification callback
- 驗證 `token_hash` 和 `type` 參數
- 呼叫 `verifyOtp()` 完成驗證
- 重定向至適當頁面

### 步驟 2: 修改 Supabase Email Template

在 Supabase Dashboard 修改 **Confirm signup** 範本。

### 步驟 3: 更新程式碼中的 emailRedirectTo

修改以下檔案：

1. `src/lib/auth.ts`
2. `src/app/(auth)/register/page.tsx`
3. `src/app/api/auth/resend-verification/route.ts`

### 步驟 4: 測試與部署

完整測試流程後部署至生產環境。

---

## 程式碼範例

### 1. Auth Confirm Route Handler

**檔案**: `src/app/auth/confirm/route.ts`

```typescript
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/zh/dashboard";

  // 準備重定向 URL（清除驗證參數）
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  // 檢查必要參數
  if (token_hash && type) {
    const supabase = await createClient();

    // 驗證 OTP token
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // ✅ 驗證成功 - 重定向至目標頁面
      redirectTo.searchParams.delete("error");
      redirectTo.searchParams.delete("error_description");
      return NextResponse.redirect(redirectTo);
    }

    // ❌ 驗證失敗 - 重定向至登入頁並顯示錯誤
    redirectTo.pathname = "/zh/login";
    redirectTo.searchParams.set("error", "verification_failed");
    redirectTo.searchParams.set("error_description", error.message);
    return NextResponse.redirect(redirectTo);
  }

  // ❌ 缺少必要參數 - 重定向至登入頁並顯示錯誤
  redirectTo.pathname = "/zh/login";
  redirectTo.searchParams.set("error", "invalid_request");
  redirectTo.searchParams.set(
    "error_description",
    "Missing token_hash or type parameter",
  );
  return NextResponse.redirect(redirectTo);
}
```

**關鍵實作要點**：

✅ **使用 `verifyOtp()` 而非 `exchangeCodeForSession()`**

- `verifyOtp()`: 專門用於 email verification
- `exchangeCodeForSession()`: 用於 OAuth 和 PKCE flow

✅ **支援 `type` 參數**

- `email`: 註冊驗證
- `recovery`: 密碼重設
- `invite`: 團隊邀請

✅ **支援 `next` 參數**
允許自訂驗證成功後的重定向目標

✅ **完整錯誤處理**

- 驗證失敗
- 缺少必要參數
- 透過 query parameters 傳遞錯誤訊息

### 2. 更新 emailRedirectTo 設定

#### `src/lib/auth.ts`

```typescript
// 第 26 行
export async function signUp(email: string, password: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`, // ← 修改這裡
    },
  });
  // ...
}
```

#### `src/app/(auth)/register/page.tsx`

```typescript
// 第 30 行附近
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3168"}/auth/confirm`, // ← 修改這裡
  },
});
```

#### `src/app/api/auth/resend-verification/route.ts`

```typescript
// 第 21 行附近
const { error } = await supabase.auth.resend({
  type: "signup",
  email,
  options: {
    emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3168"}/auth/confirm`, // ← 修改這裡
  },
});
```

---

## Supabase Dashboard 設定

### 步驟 1: 登入 Supabase Dashboard

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案

### 步驟 2: 修改 Email Template

1. 導航至 **Authentication** → **Email Templates**
2. 選擇 **Confirm signup** 範本
3. 找到 `{{ .ConfirmationURL }}` 這一行
4. 替換為以下內容：

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

### 完整 Email Template 範例

```html
<h2>確認您的信箱</h2>
<p>感謝您註冊我們的服務！</p>
<p>請點擊下方連結完成信箱驗證：</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
    確認信箱
  </a>
</p>
<p>如果您沒有註冊此帳號，請忽略此信件。</p>
<p>此連結將在 5 分鐘後失效。</p>
```

### 步驟 3: 儲存變更

點擊 **Save** 按鈕儲存 template 修改。

---

## 測試流程

### 本地測試

#### 1. 啟動開發伺服器

```bash
npm run dev
```

#### 2. 註冊新帳號

1. 前往 `http://localhost:3168/zh/register`
2. 輸入測試信箱和密碼
3. 提交註冊表單

#### 3. 檢查驗證信

1. 登入您的信箱
2. 找到驗證信
3. 檢查連結格式是否為：
   ```
   http://localhost:3168/auth/confirm?token_hash=pkce_xxx&type=email
   ```

#### 4. 點擊驗證連結

**預期結果**：

- ✅ 重定向至 `/zh/dashboard`
- ✅ Session 正確建立（可以看到使用者資訊）
- ✅ 無 404 錯誤

### 錯誤情況測試

#### 測試 1: 無效的 token_hash

**測試 URL**:

```
http://localhost:3168/auth/confirm?token_hash=invalid_token&type=email
```

**預期結果**:

- 重定向至 `/zh/login?error=verification_failed`
- 顯示錯誤訊息

#### 測試 2: 缺少必要參數

**測試 URL**:

```
http://localhost:3168/auth/confirm
```

**預期結果**:

- 重定向至 `/zh/login?error=invalid_request`
- 顯示錯誤訊息

#### 測試 3: 過期的 token

1. 等待 5 分鐘後再點擊驗證連結

**預期結果**:

- 重定向至 `/zh/login?error=verification_failed`
- 錯誤訊息提示 token 已過期

### 生產環境測試

#### 1. 部署前檢查

```bash
# 確保建置成功
npm run build

# 檢查 TypeScript 類型
npm run typecheck

# 檢查 Lint
npm run lint
```

#### 2. 部署到 Vercel

```bash
git add -A
git commit -m "新增: 實作 Email Verification 功能"
git push origin main
```

#### 3. 等待部署完成

```bash
# 等待 90 秒
sleep 90

# 檢查部署狀態
vercel ls --scope acejou27s-projects | head -8
```

#### 4. 生產環境測試

1. 前往 `https://1wayseo.com/zh/register`
2. 重複本地測試流程
3. 確認所有功能正常運作

---

## 疑難排解

### 問題 1: 仍然出現 404 錯誤

**可能原因**:

1. Route handler 檔案未建立或路徑錯誤
2. 未重新建置專案

**解決方案**:

```bash
# 確認檔案存在
ls src/app/auth/confirm/route.ts

# 重新建置
npm run build

# 重啟開發伺服器
npm run dev
```

### 問題 2: 驗證成功但未建立 Session

**可能原因**:

- Middleware 未正確處理 session
- Cookie 設定問題

**解決方案**:

1. 檢查 `src/lib/supabase/middleware.ts` 是否正確實作
2. 檢查瀏覽器 Cookie 設定
3. 確認 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 環境變數正確

### 問題 3: Email Template 未更新

**可能原因**:

- Supabase Dashboard 修改未儲存
- 快取問題

**解決方案**:

1. 重新登入 Supabase Dashboard 確認修改
2. 使用無痕模式測試
3. 清除瀏覽器快取

### 問題 4: 收不到驗證信

**可能原因**:

- Email 被標記為垃圾郵件
- Supabase Email 服務設定問題

**解決方案**:

1. 檢查垃圾郵件資料夾
2. 前往 Supabase Dashboard → **Authentication** → **Providers** → **Email**
3. 確認 Email 服務已啟用
4. 考慮設定自訂 SMTP（生產環境建議）

### 問題 5: Token 過期錯誤

**說明**:

- Token 有效期限為 **5 分鐘**
- Token 只能使用 **一次**

**解決方案**:

1. 提供「重發驗證信」功能
2. 在登入頁顯示重發連結
3. 實作已在 `src/app/api/auth/resend-verification/route.ts`

---

## 技術細節

### token_hash vs code 的區別

| 項目         | token_hash         | code                       |
| ------------ | ------------------ | -------------------------- |
| **用途**     | Email verification | OAuth / PKCE flow          |
| **驗證方法** | `verifyOtp()`      | `exchangeCodeForSession()` |
| **來源**     | Email magic link   | OAuth redirect             |
| **參數名稱** | `token_hash`       | `code`                     |
| **有效期限** | 5 分鐘             | 5 分鐘                     |
| **使用次數** | 一次               | 一次                       |

### verifyOtp vs exchangeCodeForSession

#### `verifyOtp()`

```typescript
const { error } = await supabase.auth.verifyOtp({
  type: "email", // 或 'recovery', 'invite'
  token_hash: "xxx",
});
```

**使用場景**:

- Email verification (註冊驗證)
- Password recovery (密碼重設)
- Team invitation (團隊邀請)

#### `exchangeCodeForSession()`

```typescript
const { error } = await supabase.auth.exchangeCodeForSession(code);
```

**使用場景**:

- OAuth 登入 (Google, GitHub, etc.)
- PKCE flow
- Magic link (passwordless login)

### Session 管理

#### Cookie 設定

專案使用 `@supabase/ssr` 自動處理 cookie：

```typescript
// src/lib/supabase/server.ts
createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        /* ... */
      },
    },
  },
);
```

#### Middleware Session Refresh

```typescript
// src/lib/supabase/middleware.ts
export async function updateSession(request: NextRequest) {
  // 自動刷新 session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // ...
}
```

### 安全考量

#### 1. HTTPS Only (生產環境)

```typescript
// Cookie 自動設定 secure flag
{
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  httpOnly: true,
}
```

#### 2. Token 單次使用

- Token hash 驗證後立即失效
- 無法重複使用同一連結

#### 3. 時效性限制

- Token 有效期限：5 分鐘
- 超過時限需重發驗證信

#### 4. CSRF 防護

- Middleware 設定安全 headers
- 參考 `src/middleware.ts`

---

## 參考資料

### 官方文件

- [Supabase Auth - Server-Side Rendering](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Auth - PKCE Flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase Auth - Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Next.js 15 Documentation](https://nextjs.org/docs)

### 專案相關檔案

- `src/lib/supabase/server.ts` - Supabase server client
- `src/lib/supabase/middleware.ts` - Session 管理
- `src/lib/auth.ts` - 認證相關函式
- `src/middleware.ts` - Next.js middleware

### 延伸閱讀

- [Understanding OAuth 2.0 and PKCE](https://oauth.net/2/pkce/)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

---

## 版本歷史

| 版本 | 日期       | 說明                  |
| ---- | ---------- | --------------------- |
| 1.0  | 2025-01-11 | 初版建立 - 實作方案 A |

---

## 附錄

### A. 環境變數檢查清單

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
NEXT_PUBLIC_APP_URL=https://1wayseo.com
```

### B. 常用命令

```bash
# 開發
npm run dev

# 建置
npm run build

# 型別檢查
npm run typecheck

# Lint
npm run lint

# 部署（使用 Vercel CLI）
vercel --prod
```

### C. Debug 技巧

#### 1. 檢查 Route Handler 是否被調用

```typescript
// src/app/auth/confirm/route.ts
export async function GET(request: NextRequest) {
  console.log("[Auth Confirm] 收到請求:", request.url); // ← 加入 log
  // ...
}
```

#### 2. 檢查 Supabase 錯誤詳情

```typescript
const { error } = await supabase.auth.verifyOtp({ type, token_hash });
if (error) {
  console.error("[Auth Confirm] 驗證失敗:", {
    message: error.message,
    status: error.status,
    name: error.name,
  });
}
```

#### 3. 檢查 Session 狀態

```typescript
const {
  data: { session },
} = await supabase.auth.getSession();
console.log("[Auth] Session 狀態:", session ? "已登入" : "未登入");
```

---

**文件維護**: 此文件應在每次修改 email verification 流程時同步更新。

**回報問題**: 如發現文件錯誤或有改進建議，請在專案中建立 Issue。
