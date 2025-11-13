# Email Verification 規範

## 範圍

定義使用者註冊後的 email verification 流程，確保驗證連結能正確處理並完成信箱驗證。

## ADDED Requirements

### Requirement: Email Verification Route Handler

系統 **MUST** 提供 `/auth/confirm` route handler 來處理 email verification callback。

#### Scenario: 成功驗證 email token

**Given** 使用者收到包含有效 token_hash 的驗證信
**When** 使用者點擊驗證連結 `/auth/confirm?token_hash=xxx&type=email`
**Then** 系統應：
1. 呼叫 `supabase.auth.verifyOtp()` 驗證 token
2. 建立使用者 session
3. 重定向至 `/dashboard`
4. 使用者狀態變更為已驗證

#### Scenario: Token 已過期或無效

**Given** 使用者點擊超過 5 分鐘的驗證連結
**When** 系統嘗試驗證 token_hash
**Then** 系統應：
1. `verifyOtp()` 返回錯誤
2. 重定向至 `/login?error=verification_failed`
3. 顯示錯誤訊息：「Email link is invalid or has expired」
4. 提供「重發驗證信」選項（如果適用）

#### Scenario: 缺少必要參數

**Given** 使用者訪問 `/auth/confirm` 但缺少 token_hash 或 type 參數
**When** Route handler 檢查參數
**Then** 系統應：
1. 重定向至 `/login?error=invalid_request`
2. 顯示錯誤訊息：「Missing token_hash or type parameter」

### Requirement: Email Template 配置

Supabase Email Templates **MUST** 使用正確的 callback URL。

#### Scenario: Confirm Signup Template

**Given** 管理員配置 Confirm signup Email Template
**Then** Template 應包含：
```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

#### Scenario: Magic Link Template

**Given** 管理員配置 Magic Link Email Template
**Then** Template 應包含：
```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
```

#### Scenario: Reset Password Template

**Given** 管理員配置 Reset Password Email Template
**Then** Template 應包含：
```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

### Requirement: 重定向路徑正確性

Route handler **MUST** 使用正確的重定向路徑（無語言前綴）。

#### Scenario: 驗證成功後重定向

**Given** Token 驗證成功
**When** 系統執行重定向
**Then** 應重定向至 `/dashboard`（不是 `/zh/dashboard`）

#### Scenario: 驗證失敗後重定向

**Given** Token 驗證失敗
**When** 系統執行重定向
**Then** 應重定向至 `/login?error=...`（不是 `/zh/login?error=...`）

### Requirement: Token 安全性

系統 **MUST** 遵守 Supabase token 安全性規範。

#### Scenario: Token 單次使用

**Given** 使用者成功驗證 email
**When** 使用者再次點擊相同的驗證連結
**Then** Token 應已失效，系統重定向至錯誤頁面

#### Scenario: Token 有效期限

**Given** 驗證信已發送
**Then** Token 有效期為 **5 分鐘**
**When** 超過 5 分鐘後點擊連結
**Then** 系統顯示 token 過期錯誤

## MODIFIED Requirements

### Requirement: emailRedirectTo 設定

所有註冊和驗證相關的 API **MUST** 使用正確的 `emailRedirectTo` 參數。

#### Scenario: 註冊時的 emailRedirectTo

**Given** 使用者提交註冊表單
**When** 呼叫 `supabase.auth.signUp()`
**Then** 應設定 `emailRedirectTo: "${NEXT_PUBLIC_APP_URL}/auth/confirm"`

#### Scenario: 重發驗證信的 emailRedirectTo

**Given** 使用者請求重發驗證信
**When** 呼叫 `supabase.auth.resend()`
**Then** 應設定 `emailRedirectTo: "${NEXT_PUBLIC_APP_URL}/auth/confirm"`

## 非功能性需求

### 效能

- Route handler 回應時間 **SHOULD** < 500ms
- Token 驗證 API 呼叫 **SHOULD** < 300ms

### 可用性

- 錯誤訊息 **MUST** 使用繁體中文
- 錯誤訊息 **MUST** 清楚說明問題和解決方案

### 安全性

- 所有 email 相關操作 **MUST** 使用 HTTPS（生產環境）
- Token **MUST** 無法被重複使用
- Token **MUST** 在 5 分鐘後自動失效
