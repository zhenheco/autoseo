# User Registration Specification

## ADDED Requirements

### Requirement: User Existence Check via RPC

系統 SHALL 使用 PostgreSQL RPC 函數 `get_user_by_email` 檢查用戶是否已存在，而非使用 `admin.listUsers()` API。

#### Scenario: 查詢已驗證用戶

- **WHEN** 用戶嘗試註冊已存在且已驗證的 email
- **THEN** 系統使用 RPC 函數查詢到用戶，確認 `email_confirmed_at` 不為 null
- **AND** 重定向到 `/signup?error=此電子郵件已註冊，請直接登入&verified=true`

#### Scenario: 查詢未驗證用戶

- **WHEN** 用戶嘗試註冊已存在但未驗證的 email
- **THEN** 系統使用 RPC 函數查詢到用戶，確認 `email_confirmed_at` 為 null
- **AND** 重定向到 `/signup?error=此電子郵件已註冊但尚未驗證，請檢查您的信箱或重發驗證信&unverified=true&email={email}`

#### Scenario: 查詢不存在的用戶

- **WHEN** 用戶註冊全新的 email
- **THEN** RPC 函數返回空結果（userData.length === 0）
- **AND** 系統繼續執行註冊流程

### Requirement: RPC Function Security

PostgreSQL RPC 函數 MUST 使用 `SECURITY DEFINER` 並限制訪問權限。

#### Scenario: 函數權限設定

- **WHEN** RPC 函數被創建
- **THEN** 函數使用 `SECURITY DEFINER` 權限
- **AND** 明確 REVOKE anon, authenticated, public 角色的執行權限
- **AND** 只有 service_role 可以執行

#### Scenario: 返回最小必要欄位

- **WHEN** RPC 函數被調用
- **THEN** 只返回 id, email, email_confirmed_at 三個欄位
- **AND** 不返回敏感資訊（如 encrypted_password, phone 等）

### Requirement: Signup Flow Logic Clarity

註冊流程 SHALL 在 try block 中明確檢查用戶狀態，而非依賴 catch block 進行流程控制。

#### Scenario: 先檢查後註冊

- **WHEN** 用戶提交註冊表單
- **THEN** 系統首先使用 RPC 查詢用戶是否存在
- **AND** 如果用戶存在，根據驗證狀態重定向並停止
- **AND** 如果用戶不存在，才執行 `signUp(email, password)`

#### Scenario: 註冊成功重定向

- **WHEN** 新用戶註冊成功
- **THEN** 系統重定向到 `/signup?success=註冊成功！我們已發送驗證郵件到您的信箱，請點擊郵件中的連結完成驗證`
- **AND** 用戶停留在註冊頁面查看成功訊息

#### Scenario: 真實錯誤處理

- **WHEN** 註冊過程中發生真實錯誤（非重定向）
- **THEN** catch block 捕獲錯誤
- **AND** 重新拋出 NEXT_REDIRECT 錯誤（Next.js 內部機制）
- **AND** 其他錯誤記錄日誌並顯示通用錯誤訊息

### Requirement: Remove translateErrorMessage Function

系統 MUST NOT 使用 `translateErrorMessage` 函數從錯誤訊息推斷用戶狀態。

#### Scenario: 直接檢查取代錯誤推斷

- **WHEN** 需要判斷用戶是否存在
- **THEN** 使用 RPC 函數直接查詢
- **AND** 不依賴 `signUp()` 拋出的錯誤訊息
- **AND** 不使用 `translateErrorMessage` 函數

#### Scenario: 簡化的錯誤處理

- **WHEN** catch block 捕獲錯誤
- **THEN** 只處理真實的系統錯誤
- **AND** 不檢查特殊返回值（如 'VERIFIED_USER', 'UNVERIFIED_USER'）

### Requirement: Frontend Integration

前端組件 SHALL 支援 verified 和 unverified 參數，無需修改。

#### Scenario: 已驗證用戶顯示登入連結

- **WHEN** URL 包含 `verified=true` 參數
- **THEN** 前端顯示「前往登入 →」連結
- **AND** 點擊後導向 `/login` 頁面

#### Scenario: 未驗證用戶顯示重發驗證信按鈕

- **WHEN** URL 包含 `unverified=true&email={email}` 參數
- **THEN** 前端顯示「重新發送驗證信」按鈕
- **AND** 點擊後調用重發驗證信 API

#### Scenario: 新用戶顯示成功訊息

- **WHEN** URL 包含 `success=...` 參數
- **THEN** 前端顯示註冊成功訊息
- **AND** 提示用戶檢查信箱

### Requirement: Loading State Display

註冊流程 MUST 正確顯示載入狀態。

#### Scenario: 提交後顯示載入中

- **WHEN** 用戶點擊「建立帳號」按鈕
- **THEN** 按鈕文字立即變為「註冊中...」
- **AND** 按鈕變為 disabled 狀態
- **AND** 顯示載入動畫（Loader2 icon）

#### Scenario: 完成後恢復正常狀態

- **WHEN** 註冊流程完成（成功或失敗）
- **THEN** 載入狀態自動消失
- **AND** 顯示相應的結果訊息

## MODIFIED Requirements

無（這是新增的規範，沒有修改現有需求）

## REMOVED Requirements

無（移除的是實現細節，不是需求）
