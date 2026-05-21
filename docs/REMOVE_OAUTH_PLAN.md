# 移除 Google OAuth 登入功能 - 完整執行計劃

**建立日期**：2025-11-10
**原因**：Google OAuth 登入功能持續出現問題，為了快速推進 MVP 上線，決定暫時移除此功能

---

## 📋 目標

移除所有 Google OAuth 相關功能，只保留 Email/Password 登入方式，確保 MVP 能快速穩定上線。

## 🔍 影響範圍分析

### 現況評估

- ✅ **註冊流程**：已經是純 Email/Password，無需修改
- ⚠️ **登入流程**：同時支援 Google OAuth 和 Email/Password
- ⚠️ **資料庫**：有 5 個 OAuth 相關遷移檔案
- ⚠️ **文檔**：有完整的 OpenSpec OAuth 修復文檔

### 移除後的系統狀態

- ✅ 用戶只能透過 Email/Password 註冊和登入
- ✅ 移除所有 OAuth 相關代碼和資料庫邏輯
- ✅ 簡化認證流程，減少維護成本
- ⚠️ 現有 OAuth 用戶無法登入（如果有的話）

---

## 📝 執行步驟

### 階段一：前端組件移除

**目的**：移除 UI 層的 Google 登入按鈕

#### 1. 刪除 OAuth 按鈕組件

```bash
rm src/components/auth/oauth-buttons.tsx
```

**影響檔案**：

- `src/components/auth/oauth-buttons.tsx` - 完全刪除

#### 2. 修改登入表單

**檔案**：`src/app/(auth)/login/login-form.tsx`

**需要移除的內容**：

- 第 9 行：`import { OAuthButtons, OAuthDivider } from '@/components/auth/oauth-buttons'`
- 第 101 行：`<OAuthButtons redirectTo="/dashboard" actionText="繼續" />`
- 第 103 行：`<OAuthDivider />`

**修改前**：

```tsx
import { OAuthButtons, OAuthDivider } from '@/components/auth/oauth-buttons'

// ...

<OAuthButtons redirectTo="/dashboard" actionText="繼續" />

<OAuthDivider />

<form ...>
```

**修改後**：

```tsx
// 移除 OAuthButtons import

// ...

// 直接開始表單，移除 OAuth 按鈕和分隔線

<form ...>
```

---

### 階段二：後端邏輯移除

**目的**：移除 OAuth 認證處理邏輯

#### 3. 刪除 OAuth 設置模組

```bash
rm src/lib/auth/oauth-setup.ts
```

**影響功能**：

- `ensureUserHasCompany()` - OAuth 用戶公司建立邏輯
- `waitForCompanySetup()` - 等待資料庫觸發器
- `createCompanyForUser()` - 備用手動建立公司
- 相關輔助函數

#### 4. 刪除 OAuth 回調路由

```bash
rm -rf src/app/auth/callback
```

**影響功能**：

- OAuth code exchange 處理
- 會話驗證
- 用戶公司建立協調

---

### 階段三：資料庫遷移清理

**目的**：移除 OAuth 相關資料庫結構和觸發器

#### 5. 刪除 OAuth 專屬遷移檔案

**刪除清單**：

```bash
rm supabase/migrations/20251110203624_create_oauth_metrics_table.sql
rm supabase/migrations/20251110203552_update_oauth_trigger.sql
rm supabase/migrations/20251106000001_update_oauth_free_plan.sql
rm supabase/migrations/20251105000001_oauth_auto_company_setup.sql
```

**各檔案用途**：

- `20251110203624_create_oauth_metrics_table.sql`：建立 `oauth_login_metrics` 表格
- `20251110203552_update_oauth_trigger.sql`：更新 OAuth 觸發器
- `20251106000001_update_oauth_free_plan.sql`：OAuth 用戶免費方案設定
- `20251105000001_oauth_auto_company_setup.sql`：OAuth 自動公司建立

#### 6. 修改混合遷移檔案

**檔案**：一次性 token 遷移檔

**需要移除的內容**：

- `handle_new_oauth_user()` 函數定義
- 相關的 trigger 設定
- OAuth 用戶自動處理邏輯

**需要保留的內容**：

- One-time tokens 功能
- 其他非 OAuth 相關邏輯

---

### 階段四：文檔清理（可選）

**目的**：移除過時的 OAuth 相關文檔

#### 7. 刪除 OpenSpec OAuth 文檔

```bash
rm -rf openspec/changes/fix-oauth-authentication-flow
rm docs/OAUTH_FIX_PLAN.md
```

**刪除的文檔**：

- `openspec/changes/fix-oauth-authentication-flow/` - 整個 OpenSpec 變更記錄
  - `IMPLEMENTATION_SUMMARY.md`
  - `DEPLOYMENT.md`
  - `tasks.md`
  - `design.md`
  - `proposal.md`
  - `specs/` - 規格文檔
- `docs/OAUTH_FIX_PLAN.md` - OAuth 修復計劃

**保留選項**：
如果想保留歷史記錄，可以將這些文檔移到 `docs/archived/` 目錄

---

### 階段五：驗證和測試

#### 8. 執行建置測試

```bash
npm run build
npm run typecheck
```

**檢查項目**：

- ✅ TypeScript 編譯無錯誤
- ✅ 沒有未使用的 import
- ✅ 沒有缺失的依賴
- ✅ Build 成功完成

#### 9. 功能驗證清單

**手動測試**：

- [ ] ✅ Email/Password 登入功能正常
- [ ] ✅ Email/Password 註冊功能正常
- [ ] ✅ 忘記密碼功能正常
- [ ] ✅ 重設密碼功能正常
- [ ] ✅ Email 驗證流程正常
- [ ] ✅ 登入頁面沒有 Google 按鈕
- [ ] ✅ 沒有 OAuth 相關的 console 錯誤
- [ ] ✅ 沒有 OAuth 相關的 404 錯誤

**測試帳號**：

- 建立新測試帳號驗證註冊流程
- 使用現有帳號驗證登入流程
- 測試密碼重設流程

---

### 階段六：部署準備

#### 10. 提交更改

**Git 提交格式**：

```bash
git add -A
git commit -m "移除: 移除 Google OAuth 登入功能

為了快速推進 MVP 上線，移除有問題的 Google OAuth 登入功能。
現在只支援 Email/Password 登入方式。

變更內容：
- 移除前端 OAuth 按鈕和分隔線
- 移除 OAuth 回調路由和設置邏輯
- 清理 5 個 OAuth 相關資料庫遷移
- 移除 OAuth 相關文檔

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## ⚠️ 重要提醒

### 資料庫注意事項

#### 已執行的遷移

- **問題**：如果已經在生產環境執行了 OAuth 遷移，刪除檔案不會自動 rollback
- **解決**：需要手動建立 rollback migration 或直接在資料庫中執行清理

#### 需要手動處理的資料庫物件

**表格**：

```sql
-- 如果存在，需要手動刪除
DROP TABLE IF EXISTS oauth_login_metrics;
```

**觸發器**：

```sql
-- 移除 OAuth 觸發器
DROP TRIGGER IF EXISTS on_auth_user_created_oauth ON auth.users;
```

**函數**：

```sql
-- 移除 OAuth 處理函數
DROP FUNCTION IF EXISTS handle_new_oauth_user();
```

**檢查腳本**：

```sql
-- 檢查是否有 OAuth 相關物件
SELECT * FROM information_schema.tables WHERE table_name = 'oauth_login_metrics';
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%oauth%';
SELECT * FROM information_schema.routines WHERE routine_name LIKE '%oauth%';
```

---

### Supabase Dashboard 設定

#### 關閉 Google Provider

1. 登入 Supabase Dashboard
2. 前往 **Authentication** → **Providers**
3. 找到 **Google** provider
4. 點擊 **Disable** 或移除設定
5. 儲存變更

#### 清理 OAuth URLs

確認以下 URL 設定已移除或更新：

- Redirect URLs
- Site URL
- Additional Redirect URLs

---

### 現有用戶處理

#### 情境 A：已有 OAuth 用戶

**問題**：這些用戶無法再透過 Google 登入

**解決方案**：

1. **方案 A - 密碼重設**：
   - 通知用戶使用「忘記密碼」功能
   - 系統會發送密碼重設信
   - 用戶設定新密碼後即可登入

2. **方案 B - 重新註冊**（如果用戶數很少）：
   - 通知用戶重新註冊
   - 手動遷移用戶資料（如果需要）

#### 情境 B：還沒有 OAuth 用戶

**動作**：無需特別處理，直接移除即可

#### 檢查現有 OAuth 用戶

```sql
-- 檢查是否有透過 OAuth 註冊的用戶
SELECT
  id,
  email,
  raw_user_meta_data->>'provider' as provider,
  created_at
FROM auth.users
WHERE raw_user_meta_data->>'provider' IN ('google', 'oauth');
```

---

## 📊 預期結果

### 成功指標

#### 建置階段

- ✅ `npm run build` 成功無錯誤
- ✅ `npm run typecheck` 通過
- ✅ 沒有 TypeScript 類型錯誤
- ✅ 沒有未使用的 import 警告

#### 功能階段

- ✅ 登入頁面只顯示 Email/Password 表單
- ✅ 所有認證流程測試通過
- ✅ 沒有 OAuth 相關的 console 錯誤
- ✅ 沒有 404 錯誤（OAuth callback 路由）

#### 部署階段

- ✅ 部署到 Vercel 成功
- ✅ 生產環境登入功能正常
- ✅ 沒有用戶回報登入問題

---

### 後續行動

#### 短期（1-2 天）

1. 監控部署後的錯誤日誌
2. 檢查 Vercel Analytics 是否有異常
3. 確認沒有用戶回報登入問題
4. 驗證所有認證流程正常運作

#### 中期（1-2 週）

1. 收集用戶對登入體驗的反饋
2. 評估是否需要其他登入方式
3. 優化 Email/Password 登入流程

#### 長期（未來）

1. 在 MVP 穩定後，評估是否重新實作 OAuth
2. 如果重新實作，確保充分測試和文檔記錄
3. 考慮其他 OAuth providers（如 GitHub、Microsoft）

---

## 🔧 故障排除

### 常見問題

#### 問題 1：Build 失敗 - 找不到 oauth-buttons

**錯誤訊息**：

```
Module not found: Can't resolve '@/components/auth/oauth-buttons'
```

**解決方案**：
確認 `login-form.tsx` 中的 import 已完全移除

#### 問題 2：Runtime 錯誤 - OAuth callback 404

**錯誤訊息**：

```
404 | /auth/callback
```

**解決方案**：

1. 檢查 Supabase Dashboard 的 Redirect URLs
2. 確認已關閉 Google Provider
3. 清除瀏覽器快取

#### 問題 3：資料庫錯誤 - 觸發器仍存在

**錯誤訊息**：

```
ERROR: function handle_new_oauth_user() does not exist
```

**解決方案**：
手動執行清理 SQL：

```sql
DROP TRIGGER IF EXISTS on_auth_user_created_oauth ON auth.users;
DROP FUNCTION IF EXISTS handle_new_oauth_user();
```

#### 問題 4：現有用戶無法登入

**問題描述**：
之前用 Google 登入的用戶無法登入

**解決方案**：

1. 提供清楚的錯誤訊息：「請使用忘記密碼功能設定新密碼」
2. 在登入頁面加上公告
3. 發送 Email 通知受影響用戶

---

## 📈 執行時間表

| 階段                   | 預計時間    | 負責人      | 狀態      |
| ---------------------- | ----------- | ----------- | --------- |
| 階段一：前端組件移除   | 5 分鐘      | Claude Code | ⏳ 待執行 |
| 階段二：後端邏輯移除   | 5 分鐘      | Claude Code | ⏳ 待執行 |
| 階段三：資料庫遷移清理 | 10 分鐘     | Claude Code | ⏳ 待執行 |
| 階段四：文檔清理       | 5 分鐘      | Claude Code | ⏳ 待執行 |
| 階段五：驗證和測試     | 10 分鐘     | 開發者      | ⏳ 待執行 |
| 階段六：部署準備       | 5 分鐘      | Claude Code | ⏳ 待執行 |
| **總計**               | **40 分鐘** | -           | -         |

---

## 🔄 回滾策略

### 如果需要緊急回滾

#### Git 回滾

```bash
# 查看最近的 commit
git log --oneline -5

# 回滾到移除 OAuth 之前的 commit
git revert <commit-hash>

# 或者直接 reset（小心使用）
git reset --hard <commit-hash>
git push origin main --force
```

#### 資料庫回滾

如果已經清理了資料庫物件，需要重新執行被刪除的遷移檔案：

```bash
# 恢復遷移檔案
git checkout <commit-hash> -- supabase/migrations/

# 重新執行遷移
supabase db push
```

---

## 📝 變更記錄

| 日期       | 版本 | 變更內容         | 執行者      |
| ---------- | ---- | ---------------- | ----------- |
| 2025-11-10 | 1.0  | 建立初始移除計劃 | Claude Code |
| -          | -    | -                | -           |

---

## 附錄

### A. 被刪除的檔案清單

**前端**：

- `src/components/auth/oauth-buttons.tsx`

**後端**：

- `src/lib/auth/oauth-setup.ts`
- `src/app/auth/callback/route.ts`

**資料庫遷移**：

- `supabase/migrations/20251110203624_create_oauth_metrics_table.sql`
- `supabase/migrations/20251110203552_update_oauth_trigger.sql`
- `supabase/migrations/20251106000001_update_oauth_free_plan.sql`
- `supabase/migrations/20251105000001_oauth_auto_company_setup.sql`

**文檔**：

- `openspec/changes/fix-oauth-authentication-flow/` (整個目錄)
- `docs/OAUTH_FIX_PLAN.md`

---

### B. 被修改的檔案清單

**前端**：

- `src/app/(auth)/login/login-form.tsx`
  - 移除 OAuthButtons import
  - 移除 OAuth 組件使用

**資料庫遷移**：

- 一次性 token 遷移檔
  - 移除 `handle_new_oauth_user()` 函數
  - 保留其他功能

---

### C. 相關資源連結

- [Supabase 認證文檔](https://supabase.com/docs/guides/auth)
- [Next.js 認證最佳實踐](https://nextjs.org/docs/authentication)
- [Email/Password 認證指南](https://supabase.com/docs/guides/auth/auth-email)

---

**文件狀態**：✅ 已核准
**風險等級**：🟢 低風險
**影響範圍**：🔵 認證系統
**預計執行日期**：2025-11-10
