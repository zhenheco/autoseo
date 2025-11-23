# Proposal: Remove Google OAuth Login

**Change ID**: `remove-google-oauth-login`
**Status**: Proposed
**Created**: 2025-11-10
**Author**: Claude Code

## Problem Statement

Google OAuth 登入功能持續出現問題，影響 MVP 的穩定性和上線進度。為了確保產品能快速、穩定地推出市場，需要暫時移除 Google OAuth 登入功能，僅保留已驗證運作正常的 Email/Password 認證方式。

### 當前問題

1. **OAuth 認證流程不穩定**：使用者透過 Google 登入時經常遇到錯誤
2. **維護成本高**：需要維護複雜的三層防護機制（觸發器、輪詢、fallback RPC）
3. **影響 MVP 上線時程**：問題排查和修復延遲了產品發布
4. **現有 Email/Password 認證已足夠**：註冊流程已經是純 Email/Password 且運作正常

### 影響範圍

- ✅ **註冊流程**：已經是純 Email/Password，無需修改
- ⚠️ **登入流程**：需移除 Google OAuth 按鈕和相關邏輯
- ⚠️ **資料庫**：需清理 5 個 OAuth 相關遷移和觸發器
- ⚠️ **文檔**：需移除或歸檔 OAuth 相關文檔

## Proposed Solution

### 整體策略

採用漸進式移除策略，從前端到後端，最後清理資料庫和文檔：

1. **階段一：前端移除** - 移除使用者可見的 OAuth 按鈕
2. **階段二：後端移除** - 移除 OAuth 認證處理邏輯
3. **階段三：資料庫清理** - 移除 OAuth 相關資料庫結構
4. **階段四：文檔清理** - 清理或歸檔相關文檔
5. **階段五：驗證測試** - 確保所有認證流程正常運作

### 技術細節

#### 前端變更

- 刪除 `src/components/auth/oauth-buttons.tsx` 組件
- 修改 `src/app/(auth)/login/login-form.tsx` 移除 OAuth 相關 import 和使用

#### 後端變更

- 刪除 `src/lib/auth/oauth-setup.ts` OAuth 設置模組
- 刪除 `src/app/auth/callback/route.ts` OAuth 回調路由

#### 資料庫變更

- 刪除 4 個 OAuth 專屬遷移檔案
- 修改 `20251106000002_one_time_tokens_and_referral.sql` 移除 OAuth 處理函數
- 在生產環境手動清理 OAuth 相關資料庫物件（觸發器、函數、表格）

#### 文檔變更

- 移除 `openspec/changes/fix-oauth-authentication-flow/` 整個目錄
- 移除 `docs/OAUTH_FIX_PLAN.md`
- 可選：歸檔至 `docs/archived/` 保留歷史記錄

### 移除後的系統狀態

- ✅ 使用者只能透過 Email/Password 註冊和登入
- ✅ 移除所有 OAuth 相關代碼和資料庫邏輯
- ✅ 簡化認證流程，減少維護成本
- ✅ 加快 MVP 上線速度
- ⚠️ 現有 OAuth 使用者需要透過「忘記密碼」功能設定新密碼

## Risks and Mitigation

### 風險 1：現有 OAuth 使用者無法登入

**嚴重性**: 中
**機率**: 高（如果已有 OAuth 使用者）
**緩解措施**:

- 提供清楚的錯誤訊息指引使用者使用「忘記密碼」功能
- 在登入頁面加上公告說明變更
- 發送 Email 通知受影響使用者
- 提供客服支援協助使用者重設密碼

### 風險 2：資料庫遷移回滾困難

**嚴重性**: 低
**機率**: 低
**緩解措施**:

- 保留 Git 歷史記錄以便回滾
- 在刪除遷移檔案前備份
- 提供完整的回滾 SQL 腳本
- 在測試環境先驗證清理步驟

### 風險 3：未來需要重新實作 OAuth

**嚴重性**: 低
**機率**: 中
**緩解措施**:

- 保留 OAuth 相關文檔於 `docs/archived/`
- 記錄移除原因和過程
- 在 MVP 穩定後再評估是否重新實作
- 考慮使用更成熟的 OAuth 解決方案（如 NextAuth.js）

## Implementation Phases

### Phase 1: Frontend Removal (5 分鐘)

- 刪除 `oauth-buttons.tsx` 組件
- 修改登入表單移除 OAuth 相關內容

### Phase 2: Backend Removal (5 分鐘)

- 刪除 OAuth 設置模組
- 刪除 OAuth 回調路由

### Phase 3: Database Cleanup (10 分鐘)

- 刪除 OAuth 專屬遷移檔案
- 修改混合遷移檔案
- 準備生產環境清理 SQL

### Phase 4: Documentation Cleanup (5 分鐘)

- 移除或歸檔 OAuth 相關文檔

### Phase 5: Verification (10 分鐘)

- 執行建置測試（`npm run build`, `npm run typecheck`）
- 手動功能驗證（登入、註冊、密碼重設等）
- 檢查 console 和網路請求確認無 OAuth 相關錯誤

## Success Criteria

### Technical Success

- ✅ `npm run build` 成功完成無錯誤
- ✅ `npm run typecheck` 通過
- ✅ 沒有 TypeScript 類型錯誤
- ✅ 沒有未使用的 import 警告
- ✅ 部署到 Vercel 成功

### Functional Success

- ✅ 登入頁面只顯示 Email/Password 表單
- ✅ Email/Password 登入功能正常
- ✅ Email/Password 註冊功能正常
- ✅ 忘記密碼功能正常
- ✅ 重設密碼功能正常
- ✅ Email 驗證流程正常
- ✅ 沒有 OAuth 相關的 console 錯誤
- ✅ 沒有 404 錯誤（OAuth callback 路由）

### Business Success

- ✅ MVP 可以快速上線
- ✅ 沒有使用者回報認證相關問題
- ✅ 認證流程簡化，降低維護成本

## Related Changes

- Depends on: None
- Blocks: None
- Related: `fix-oauth-authentication-flow` (將被移除)

## Affected Specs

- **Modified**: `user-registration` - OAuth 登入選項移除
- **New**: `authentication-simplification` - 簡化認證規格

## Notes

### Rollback Strategy

如果需要緊急回滾：

1. 使用 `git revert` 或 `git reset` 回到移除前的 commit
2. 恢復遷移檔案：`git checkout <commit-hash> -- supabase/migrations/`
3. 重新執行遷移：`supabase db push`

### Future Considerations

- 在 MVP 穩定後，評估是否需要重新實作 OAuth
- 如果重新實作，考慮使用 NextAuth.js 或其他成熟方案
- 考慮支援其他 OAuth providers（GitHub、Microsoft 等）

### Production Database Cleanup

生產環境需要手動執行以下 SQL 清理：

```sql
-- 移除觸發器
DROP TRIGGER IF EXISTS on_auth_user_created_oauth ON auth.users;

-- 移除函數
DROP FUNCTION IF EXISTS handle_new_oauth_user();
DROP FUNCTION IF EXISTS create_company_for_oauth_user(UUID, TEXT, TEXT);

-- 移除表格（如果存在）
DROP TABLE IF EXISTS oauth_login_metrics;
```
