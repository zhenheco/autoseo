# Tasks: Remove Google OAuth Login

## Overview

移除 Google OAuth 登入功能的具體執行任務清單。這些任務已根據 `docs/REMOVE_OAUTH_PLAN.md` 的執行步驟轉換為可追蹤的工作項目。

---

## Phase 1: Frontend Component Removal

### Task 1.1: 刪除 OAuth 按鈕組件

**Description**: 刪除 OAuth 按鈕和分隔線組件檔案

**Actions**:

```bash
rm src/components/auth/oauth-buttons.tsx
```

**Validation**:

- [x] 檔案已刪除
- [x] Git status 顯示檔案已移除

**Dependencies**: None
**Parallel**: Can run independently

---

### Task 1.2: 修改登入表單移除 OAuth 組件

**Description**: 從登入表單中移除 OAuth 相關的 import 和使用

**File**: `src/app/(auth)/login/login-form.tsx`

**Changes**:

- 移除第 9 行：`import { OAuthButtons, OAuthDivider } from '@/components/auth/oauth-buttons'`
- 移除第 101 行：`<OAuthButtons redirectTo="/dashboard" actionText="繼續" />`
- 移除第 103 行：`<OAuthDivider />`

**Validation**:

- [x] Import 語句已移除
- [x] OAuth 組件使用已移除
- [x] 檔案可以正常編譯
- [x] 沒有 TypeScript 錯誤

**Dependencies**: Task 1.1
**Parallel**: No（需要等待 Task 1.1）

---

## Phase 2: Backend Logic Removal

### Task 2.1: 刪除 OAuth 設置模組

**Description**: 刪除 OAuth 使用者公司建立和設置邏輯

**Actions**:

```bash
rm src/lib/auth/oauth-setup.ts
```

**Affected Functions**:

- `ensureUserHasCompany()`
- `waitForCompanySetup()`
- `createCompanyForUser()`
- `recordMetrics()`
- `getProviderFromUser()`
- `isOAuthProvider()`
- `getDefaultCompanyName()`

**Validation**:

- [x] 檔案已刪除
- [x] 沒有其他檔案引用此模組

**Dependencies**: None
**Parallel**: Yes（可與 Phase 1 平行執行）

---

### Task 2.2: 刪除 OAuth 回調路由

**Description**: 刪除 OAuth code exchange 和會話處理路由

**Actions**:

```bash
rm -rf src/app/auth/callback
```

**Affected Features**:

- OAuth authorization code exchange
- 會話驗證
- 使用者公司建立協調

**Validation**:

- [x] 目錄已刪除
- [x] 沒有其他檔案引用此路由

**Dependencies**: Task 2.1
**Parallel**: No（需要等待 Task 2.1）

---

## Phase 3: Database Migration Cleanup

### Task 3.1: 刪除 OAuth 專屬遷移檔案

**Description**: 移除 4 個純 OAuth 相關的資料庫遷移檔案

**Actions**:

```bash
rm supabase/migrations/20251110203624_create_oauth_metrics_table.sql
rm supabase/migrations/20251110203552_update_oauth_trigger.sql
rm supabase/migrations/20251106000001_update_oauth_free_plan.sql
rm supabase/migrations/20251105000001_oauth_auto_company_setup.sql
```

**Files Removed**:

- `20251110203624_create_oauth_metrics_table.sql` - OAuth 登入指標表格
- `20251110203552_update_oauth_trigger.sql` - OAuth 觸發器更新
- `20251106000001_update_oauth_free_plan.sql` - OAuth 免費方案設定
- `20251105000001_oauth_auto_company_setup.sql` - OAuth 自動公司建立

**Validation**:

- [x] 4 個檔案已刪除
- [x] 遷移目錄中不再有這些檔案

**Dependencies**: None
**Parallel**: Yes（可與其他 Phase 平行執行）

---

### Task 3.2: 修改混合遷移檔案

**Description**: 從 one_time_tokens_and_referral 遷移中移除 OAuth 處理函數

**File**: `supabase/migrations/20251106000002_one_time_tokens_and_referral.sql`

**Changes**:

- 移除第 6-253 行：`CREATE OR REPLACE FUNCTION handle_new_oauth_user()` 函數定義
- 移除相關的 GRANT 語句
- **保留**：One-time tokens 功能
- **保留**：邀請系統 (Referral) 功能

**Validation**:

- [x] `handle_new_oauth_user()` 函數定義已移除
- [x] One-time tokens 功能完整保留
- [x] Referral 功能完整保留
- [x] SQL 語法正確無誤

**Dependencies**: Task 3.1
**Parallel**: No（建議在 Task 3.1 後執行以避免混淆）

---

### Task 3.3: 準備生產環境清理 SQL

**Description**: 建立用於清理生產環境 OAuth 物件的 SQL 腳本

**Create File**: `supabase/migrations/cleanup_oauth_production.sql`

**Content**:

```sql
-- 生產環境 OAuth 清理腳本
-- 警告：執行前請確認已備份資料庫

-- 檢查是否有 OAuth 物件
SELECT * FROM information_schema.tables WHERE table_name = 'oauth_login_metrics';
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%oauth%';
SELECT * FROM information_schema.routines WHERE routine_name LIKE '%oauth%';

-- 移除觸發器
DROP TRIGGER IF EXISTS on_auth_user_created_oauth ON auth.users;

-- 移除函數
DROP FUNCTION IF EXISTS handle_new_oauth_user();
DROP FUNCTION IF EXISTS create_company_for_oauth_user(UUID, TEXT, TEXT);

-- 移除表格
DROP TABLE IF EXISTS oauth_login_metrics;

-- 驗證清理
SELECT * FROM information_schema.tables WHERE table_name = 'oauth_login_metrics';
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%oauth%';
SELECT * FROM information_schema.routines WHERE routine_name LIKE '%oauth%';
```

**Validation**:

- [x] 清理腳本已建立
- [x] 包含檢查 SQL
- [x] 包含清理 SQL
- [x] 包含驗證 SQL

**Dependencies**: Task 3.2
**Parallel**: No

---

## Phase 4: Documentation Cleanup

### Task 4.1: 移除 OpenSpec OAuth 文檔

**Description**: 刪除 fix-oauth-authentication-flow 變更記錄

**Actions**:

```bash
rm -rf openspec/changes/fix-oauth-authentication-flow
```

**Files Removed**:

- `IMPLEMENTATION_SUMMARY.md`
- `DEPLOYMENT.md`
- `tasks.md`
- `design.md`
- `proposal.md`
- `specs/` - 整個規格目錄

**Validation**:

- [x] 目錄已刪除
- [x] `openspec list` 不再顯示 `fix-oauth-authentication-flow`

**Dependencies**: None
**Parallel**: Yes

---

### Task 4.2: 移除 OAuth 修復計劃文檔

**Description**: 刪除 OAuth 修復計劃文檔

**Actions**:

```bash
rm docs/OAUTH_FIX_PLAN.md
```

**Validation**:

- [x] 檔案已刪除
- [x] docs 目錄中不再有此檔案

**Dependencies**: Task 4.1
**Parallel**: Yes（可與 Task 4.1 平行執行）

---

### Task 4.3: （可選）歸檔文檔保留歷史

**Description**: 如果需要保留歷史記錄，將文檔移至 archived 目錄

**Actions** (如果選擇歸檔):

```bash
mkdir -p docs/archived/oauth-2025-11-10
mv openspec/changes/fix-oauth-authentication-flow docs/archived/oauth-2025-11-10/
mv docs/OAUTH_FIX_PLAN.md docs/archived/oauth-2025-11-10/
```

**Validation**:

- [ ] 歸檔目錄已建立
- [ ] 文檔已移至歸檔目錄
- [ ] 在原位置已刪除

**Dependencies**: Task 4.1, Task 4.2
**Parallel**: No（替代 Task 4.1 和 4.2）

---

## Phase 5: Verification and Testing

### Task 5.1: 執行 TypeScript 類型檢查

**Description**: 確保沒有類型錯誤

**Actions**:

```bash
npm run typecheck
# 或
npx tsc --noEmit
```

**Expected Results**:

- 沒有類型錯誤
- 沒有缺失的 import
- 沒有未使用的變數警告

**Validation**:

- [x] `npm run typecheck` 通過
- [x] 沒有錯誤訊息
- [x] 沒有警告訊息

**Dependencies**: All Phase 1-4 tasks
**Parallel**: No

---

### Task 5.2: 執行建置測試

**Description**: 確保專案可以成功建置

**Actions**:

```bash
npm run build
```

**Expected Results**:

- 建置成功完成
- 沒有 TypeScript 編譯錯誤
- 沒有 Next.js 建置錯誤

**Validation**:

- [x] `npm run build` 成功完成
- [x] `.next` 目錄已建立
- [x] 沒有錯誤訊息

**Dependencies**: Task 5.1
**Parallel**: No

---

### Task 5.3: 手動功能驗證

**Description**: 測試所有認證相關功能

**Test Checklist**:

- [ ] **登入頁面**：只顯示 Email/Password 表單，沒有 Google 按鈕
- [ ] **Email/Password 登入**：可以成功登入
- [ ] **Email/Password 註冊**：可以成功註冊新帳號
- [ ] **Email 驗證**：註冊後收到驗證信
- [ ] **忘記密碼**：可以請求密碼重設信
- [ ] **重設密碼**：可以成功重設密碼並登入
- [ ] **Dashboard 訪問**：登入後可以正常訪問 dashboard
- [ ] **Console 檢查**：沒有 OAuth 相關錯誤
- [ ] **Network 檢查**：沒有 404 錯誤（OAuth callback）

**Test Account**:

- 使用新的測試 email 註冊
- 測試完整的註冊到登入流程
- 測試密碼重設流程

**Validation**:

- [ ] 所有功能測試通過
- [ ] 沒有 console 錯誤
- [ ] 沒有網路請求錯誤

**Dependencies**: Task 5.2
**Parallel**: No

---

### Task 5.4: Chrome DevTools 前端驗證

**Description**: 使用 Chrome DevTools 檢查前端錯誤

**Actions**:

1. 開啟 Chrome DevTools (F12)
2. 前往 Console 標籤
3. 前往 Network 標籤
4. 執行登入流程
5. 執行註冊流程

**Expected Results**:

- Console 中沒有錯誤
- Console 中沒有 OAuth 相關警告
- Network 中沒有失敗的請求
- Network 中沒有 `/auth/callback` 相關請求

**Validation**:

- [ ] Console 無錯誤
- [ ] Console 無 OAuth 警告
- [ ] Network 無失敗請求
- [ ] 沒有 OAuth callback 請求

**Dependencies**: Task 5.3
**Parallel**: No

---

## Phase 6: Deployment

### Task 6.1: 提交變更

**Description**: 將所有變更提交到 Git

**Actions**:

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

**Validation**:

- [ ] 所有變更已 staged
- [ ] Commit message 清楚描述變更
- [ ] Commit 成功建立

**Dependencies**: All Phase 5 tasks
**Parallel**: No

---

### Task 6.2: 推送到遠端

**Description**: 將變更推送到遠端倉庫

**Actions**:

```bash
git push origin main
```

**Validation**:

- [ ] 推送成功
- [ ] GitHub 顯示最新 commit

**Dependencies**: Task 6.1
**Parallel**: No

---

### Task 6.3: 等待 Vercel 部署

**Description**: 等待 Vercel 自動部署完成

**Actions**:

```bash
# 等待 90 秒
sleep 90
vercel ls --scope acejou27s-projects | head -8
```

**Expected Results**:

- 最新部署狀態為 "● Ready"
- 沒有建置錯誤

**Validation**:

- [ ] Vercel 部署成功
- [ ] 部署狀態為 Ready
- [ ] 沒有錯誤訊息

**Dependencies**: Task 6.2
**Parallel**: No

---

### Task 6.4: 生產環境驗證

**Description**: 在生產環境測試功能

**Test Checklist**:

- [ ] 訪問生產網站正常
- [ ] 登入頁面沒有 Google 按鈕
- [ ] Email/Password 登入正常
- [ ] 註冊流程正常
- [ ] 密碼重設正常
- [ ] 沒有 console 錯誤
- [ ] 沒有 404 錯誤

**Validation**:

- [ ] 所有生產環境測試通過
- [ ] 功能與本地測試結果一致

**Dependencies**: Task 6.3
**Parallel**: No

---

## Phase 7: Production Database Cleanup (Optional)

### Task 7.1: 檢查生產環境 OAuth 物件

**Description**: 檢查生產資料庫是否有 OAuth 相關物件

**SQL**:

```sql
SELECT * FROM information_schema.tables WHERE table_name = 'oauth_login_metrics';
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%oauth%';
SELECT * FROM information_schema.routines WHERE routine_name LIKE '%oauth%';
```

**Validation**:

- [ ] 確認是否有 OAuth 表格
- [ ] 確認是否有 OAuth 觸發器
- [ ] 確認是否有 OAuth 函數

**Dependencies**: Task 6.4
**Parallel**: No

---

### Task 7.2: 執行生產環境清理（如果需要）

**Description**: 如果 Task 7.1 發現有 OAuth 物件，執行清理

**SQL**: 使用 Task 3.3 建立的清理腳本

**Warning**: ⚠️ 執行前請確認已備份資料庫

**Validation**:

- [ ] 備份已建立
- [ ] 清理 SQL 已執行
- [ ] 驗證 SQL 確認物件已移除

**Dependencies**: Task 7.1
**Parallel**: No

---

## Summary

### Total Tasks: 23

### Estimated Time: 40 分鐘

### Critical Path:

1. Task 1.1 → Task 1.2 (Frontend)
2. Task 2.1 → Task 2.2 (Backend)
3. Task 3.1 → Task 3.2 → Task 3.3 (Database)
4. Task 5.1 → Task 5.2 → Task 5.3 → Task 5.4 (Verification)
5. Task 6.1 → Task 6.2 → Task 6.3 → Task 6.4 (Deployment)

### Parallel Opportunities:

- Phase 1, 2, 3, 4 可以部分平行執行
- Task 4.1 和 4.2 可以平行執行
- Phase 1 和 Phase 2 可以平行執行

### Dependencies Map:

```
Phase 1 (Frontend) ──┐
Phase 2 (Backend) ───┼──→ Phase 5 (Verification) → Phase 6 (Deployment)
Phase 3 (Database) ──┤
Phase 4 (Docs) ──────┘
```
