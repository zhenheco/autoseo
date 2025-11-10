# Fix Signup User Existence Check

## Why

當前註冊流程使用 `admin.listUsers()` API 檢查用戶是否已存在，但此方法有以下問題：

1. **分頁限制**：預設只返回前 50 個用戶，無法可靠地找到所有用戶
2. **無法精確查詢**：沒有 email filter 參數，只能在返回的結果中遍歷查找
3. **安全機制誤導**：當 email confirmation 啟用時，`signUp()` 對已存在用戶不會拋出錯誤，而是返回假的 user 物件（防止 email 枚舉攻擊）

這導致：
- 用戶註冊時無論是否已存在都顯示「此電子郵件已註冊，請直接登入」
- 沒有正確的載入狀態顯示
- 未驗證用戶無法看到「重發驗證信」按鈕

## What Changes

使用 PostgreSQL RPC 函數取代 `listUsers()` 進行用戶查詢：

- **新增 PostgreSQL RPC 函數** `get_user_by_email(email_input TEXT)` 直接查詢 `auth.users` 表
- **修改註冊邏輯**：在 try block 中使用 RPC 函數檢查用戶，根據驗證狀態返回正確的參數
- **簡化錯誤處理**：移除 `translateErrorMessage` 函數，catch block 只處理真實錯誤
- **改善用戶體驗**：確保已驗證/未驗證用戶分別看到「前往登入」連結和「重發驗證信」按鈕

## Impact

- **Affected specs**: user-registration（新增規範）
- **Affected code**:
  - `src/app/(auth)/signup/actions.ts` - 核心修改
  - Supabase Database - 新增 RPC 函數
- **Breaking changes**: 無（向後兼容，只改進內部實現）
- **User impact**:
  - ✅ 已驗證用戶看到「前往登入」
  - ✅ 未驗證用戶看到「重發驗證信」
  - ✅ 新用戶正常註冊
  - ✅ 所有情況顯示正確的載入狀態
