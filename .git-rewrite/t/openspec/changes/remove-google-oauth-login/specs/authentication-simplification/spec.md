# Spec: Authentication Simplification

**Capability**: `authentication-simplification`
**Status**: Proposed
**Related Change**: `remove-google-oauth-login`

## Purpose
簡化使用者認證流程，只保留 Email/Password 認證方式，移除所有 Google OAuth 相關功能。此變更旨在提高系統穩定性、降低維護成本，並加快 MVP 上線速度。

## Context
- 目前系統同時支援 Email/Password 和 Google OAuth 兩種登入方式
- Google OAuth 功能持續出現問題，影響使用者體驗
- 註冊流程已經是純 Email/Password 且運作正常
- 需要快速推進 MVP 上線，不應被 OAuth 問題阻擋

---

## REMOVED Requirements

### Requirement: OAuth 登入支援
**Rationale**: Google OAuth 登入功能不穩定且維護成本高，暫時移除以加快 MVP 上線

#### Scenario: 使用者透過 Google 登入
**Given**: 使用者在登入頁面
**When**: 使用者點擊「使用 Google 登入」按鈕
**Then**: 系統導向 Google OAuth 授權頁面
**And**: 授權成功後返回系統並建立會話
**And**: 如果是新使用者，自動建立公司和訂閱

**Outcome**: ❌ 此功能已移除，使用者無法透過 Google 登入

---

### Requirement: OAuth 回調處理
**Rationale**: 移除 OAuth 功能後，不再需要處理 OAuth 授權回調

#### Scenario: 處理 Google OAuth 授權回調
**Given**: 使用者完成 Google 授權
**When**: Google 重定向回 `/auth/callback?code=xxx`
**Then**: 系統交換授權碼取得 session
**And**: 驗證使用者身份
**And**: 如果是 OAuth 使用者，確保其擁有公司
**And**: 重定向到指定頁面

**Outcome**: ❌ 此路由已移除，不再處理 OAuth 回調

---

### Requirement: OAuth 使用者公司自動建立
**Rationale**: 移除 OAuth 功能後，不再需要為 OAuth 使用者自動建立公司

#### Scenario: 新 OAuth 使用者登入時建立公司
**Given**: 使用者首次透過 Google 登入
**When**: OAuth 認證成功
**Then**: 資料庫觸發器自動為使用者建立公司
**Or**: 如果觸發器超時，fallback RPC 函數建立公司
**And**: 記錄建立路徑和延遲時間到 metrics 表格

**Outcome**: ❌ 此功能已移除，包括觸發器、RPC 函數和 metrics 表格

---

### Requirement: OAuth 登入指標追蹤
**Rationale**: 移除 OAuth 功能後，不再需要追蹤 OAuth 登入指標

#### Scenario: 記錄 OAuth 登入性能指標
**Given**: 使用者透過 OAuth 登入
**When**: 公司建立流程完成
**Then**: 系統記錄以下指標到 `oauth_login_metrics` 表格：
- 使用者 ID
- Provider (google)
- 建立路徑 (existing/trigger_success/fallback_success/failed)
- 觸發器延遲時間（毫秒）

**Outcome**: ❌ 此功能已移除，`oauth_login_metrics` 表格已刪除

---

## MODIFIED Requirements

### Requirement: 登入頁面顯示
登入頁面 SHALL 只顯示 Email/Password 認證表單，不得包含任何 OAuth 相關的使用者介面元素。

**Rationale**: 移除 Google OAuth 按鈕，簡化登入介面

**Previous Behavior**:
登入頁面顯示：
1. Google 登入按鈕
2. "或" 分隔線
3. Email/Password 表單

**New Behavior**:
登入頁面只顯示：
1. Email/Password 表單

#### Scenario: 使用者訪問登入頁面
**Given**: 使用者前往 `/login` 頁面
**When**: 頁面載入完成
**Then**: 使用者看到 Email/Password 登入表單
**And**: 沒有 Google 登入按鈕
**And**: 沒有 OAuth 分隔線
**And**: 表單包含 email 輸入框、密碼輸入框和登入按鈕

**Validation**:
- 頁面不包含 `<OAuthButtons>` 組件
- 頁面不包含 `<OAuthDivider>` 組件
- Console 沒有 OAuth 相關錯誤
- Network 沒有 OAuth 相關請求

---

### Requirement: 使用者認證方式
系統 SHALL 只支援 Email/Password 認證方式，不得提供任何 OAuth 認證選項。

**Rationale**: 統一使用 Email/Password 認證，簡化系統複雜度

**Previous Behavior**:
系統支援兩種認證方式：
1. Email/Password
2. Google OAuth

**New Behavior**:
系統只支援一種認證方式：
1. Email/Password

#### Scenario: 新使用者註冊
**Given**: 新使用者想要註冊帳號
**When**: 使用者前往註冊頁面
**Then**: 使用者只能透過 Email/Password 註冊
**And**: 填寫 email、密碼和公司名稱
**And**: 提交註冊表單
**And**: 收到 email 驗證信
**And**: 點擊驗證連結完成註冊

**Validation**:
- 註冊頁面沒有 OAuth 選項
- 註冊流程只使用 Email/Password
- 使用者可以成功完成註冊

---

#### Scenario: 現有使用者登入
**Given**: 使用者已經註冊過帳號
**When**: 使用者前往登入頁面
**Then**: 使用者只能透過 Email/Password 登入
**And**: 輸入 email 和密碼
**And**: 點擊登入按鈕
**And**: 系統驗證憑證
**And**: 成功後建立會話並重定向到 dashboard

**Validation**:
- 登入頁面沒有 OAuth 選項
- 登入流程只使用 Email/Password
- 使用者可以成功登入

---

### Requirement: 忘記密碼功能
系統 MUST 為所有使用者（包括之前透過 OAuth 登入的使用者）提供密碼重設功能，並在登入頁面清楚指引之前的 OAuth 使用者使用此功能設定新密碼。

**Rationale**: 為之前透過 OAuth 登入的使用者提供設定密碼的方式

**Previous Behavior**:
- Email/Password 使用者可以使用忘記密碼功能
- OAuth 使用者通常不需要此功能（使用 OAuth 登入）

**New Behavior**:
- 所有使用者（包括之前的 OAuth 使用者）都可以使用忘記密碼功能
- 之前的 OAuth 使用者可以透過此功能設定密碼

#### Scenario: 之前的 OAuth 使用者設定密碼
**Given**: 使用者之前透過 Google OAuth 登入
**And**: OAuth 功能已移除
**When**: 使用者嘗試登入但無法使用 Google
**Then**: 登入頁面顯示提示：「OAuth 登入已停用，請使用忘記密碼功能設定新密碼」
**And**: 使用者點擊「忘記密碼」連結
**And**: 輸入 email 地址
**And**: 系統發送密碼重設信
**And**: 使用者點擊信中的連結
**And**: 設定新密碼
**And**: 之後可以使用 Email/Password 登入

**Validation**:
- 之前的 OAuth 使用者可以收到密碼重設信
- 可以成功設定新密碼
- 設定密碼後可以正常登入

---

## ADDED Requirements

### Requirement: OAuth 移除後的錯誤處理
系統 MUST 提供清楚的錯誤處理機制，確保使用者不會因 OAuth 功能移除而遇到混淆或錯誤。

**Rationale**: 確保使用者不會因 OAuth 功能移除而遇到混淆或錯誤

#### Scenario: 處理遺留的 OAuth callback URL
**Given**: 使用者收藏或記憶了舊的 OAuth callback URL
**When**: 使用者訪問 `/auth/callback`
**Then**: 系統返回 404 錯誤（路由已移除）
**And**: Next.js 顯示標準的 404 頁面

**Validation**:
- `/auth/callback` 路由已刪除
- 訪問該路由返回 404
- 沒有伺服器端錯誤

---

#### Scenario: 檢測到 OAuth 相關錯誤參數
**Given**: URL 包含 OAuth 相關錯誤參數（如 `?error=oauth_cancelled`）
**When**: 登入頁面載入
**Then**: 系統顯示友善的錯誤訊息：「OAuth 登入功能已停用，請使用 Email/Password 登入」
**And**: 提供「忘記密碼」連結協助之前的 OAuth 使用者

**Validation**:
- 錯誤訊息清楚易懂
- 提供解決方案（忘記密碼）
- 不會造成使用者困惑

---

### Requirement: 資料庫清理
系統 MUST 完整移除所有 OAuth 相關的資料庫物件，包括觸發器、函數和表格，以減少維護負擔。

**Rationale**: 移除未使用的 OAuth 相關資料庫物件，減少維護負擔

#### Scenario: 清理生產環境 OAuth 資料庫物件
**Given**: 生產資料庫可能包含 OAuth 觸發器、函數和表格
**When**: 執行清理 SQL 腳本
**Then**: 系統移除以下物件：
- 觸發器：`on_auth_user_created_oauth`
- 函數：`handle_new_oauth_user()`
- 函數：`create_company_for_oauth_user()`
- 表格：`oauth_login_metrics`

**Validation**:
- 執行清理 SQL 無錯誤
- 驗證 SQL 確認物件已移除
- 系統正常運作不受影響

---

## UNAFFECTED Requirements

### Requirement: Email/Password 註冊流程
**Status**: 保持不變

**Behavior**:
- 使用者填寫註冊表單（email、密碼、公司名稱）
- 系統建立使用者帳號
- 系統發送 email 驗證信
- 使用者點擊驗證連結完成註冊
- 系統自動建立公司和免費方案訂閱

---

### Requirement: Email/Password 登入流程
**Status**: 保持不變

**Behavior**:
- 使用者輸入 email 和密碼
- 系統驗證憑證
- 驗證成功後建立會話
- 重定向到 dashboard 或指定頁面

---

### Requirement: Email 驗證流程
**Status**: 保持不變

**Behavior**:
- 註冊後系統發送驗證信
- 使用者點擊信中的連結
- 系統驗證 token 並標記 email 為已驗證
- 使用者可以正常使用系統

---

### Requirement: 密碼重設流程
**Status**: 保持不變（並且對之前的 OAuth 使用者更重要）

**Behavior**:
- 使用者點擊「忘記密碼」
- 輸入 email 地址
- 系統發送密碼重設信
- 使用者點擊信中的連結
- 設定新密碼
- 可以使用新密碼登入

---

## Migration Path

### For Existing OAuth Users

#### Option 1: Password Reset (Recommended)
**Steps**:
1. 使用者嘗試登入但發現無法使用 Google
2. 系統顯示提示訊息
3. 使用者點擊「忘記密碼」
4. 輸入 email 並請求密碼重設
5. 收到密碼重設信並設定新密碼
6. 之後使用 Email/Password 登入

**Communication**:
- 在登入頁面加上明顯的公告
- 提供清楚的指引步驟
- 考慮發送 Email 通知受影響使用者

---

#### Option 2: Re-registration (如果使用者很少)
**Steps**:
1. 使用者使用相同的 email 重新註冊
2. 系統提示「此 email 已註冊」
3. 使用者使用忘記密碼功能（回到 Option 1）

---

## Rollback Strategy

如果需要緊急回滾 OAuth 功能：

### Code Rollback
```bash
# 查看 commit 歷史
git log --oneline -5

# 回滾到移除 OAuth 之前
git revert <commit-hash>

# 或強制 reset（謹慎使用）
git reset --hard <commit-hash>
git push origin main --force
```

### Database Rollback
```bash
# 恢復遷移檔案
git checkout <commit-hash> -- supabase/migrations/

# 重新執行遷移
supabase db push
```

---

## Performance Impact

### Before (With OAuth)
- 登入頁面載入 OAuth buttons 組件
- OAuth callback 處理路由
- 資料庫觸發器監聽 auth.users 插入
- 資料庫包含 oauth_login_metrics 表格
- 複雜的三層公司建立機制

### After (Without OAuth)
- ✅ 登入頁面更輕量（移除 OAuth 組件）
- ✅ 沒有 OAuth callback 路由處理開銷
- ✅ 沒有 OAuth 觸發器執行開銷
- ✅ 資料庫更簡潔（移除 oauth_login_metrics）
- ✅ 認證流程更簡單直接

**Expected Improvements**:
- 登入頁面載入速度略微提升
- 減少資料庫觸發器執行次數
- 降低系統複雜度
- 降低維護成本

---

## Security Considerations

### Before
- 需要管理 Google OAuth credentials
- 需要保護 OAuth callback 路由
- 需要驗證 OAuth provider 回傳的資料
- OAuth token 管理

### After
- ✅ 只需管理一種認證方式（Email/Password）
- ✅ 減少攻擊面（移除 OAuth 路由）
- ✅ 簡化安全稽核
- ⚠️ 需要確保密碼重設功能安全可靠（之前 OAuth 使用者依賴此功能）

**Security Checklist**:
- [ ] 密碼重設 token 有效期限檢查
- [ ] 密碼重設次數限制（防止濫用）
- [ ] Email 驗證流程完整
- [ ] 密碼強度要求
- [ ] 帳號鎖定機制（登入失敗次數）

---

## Testing Strategy

### Unit Tests
- ✅ 移除 `oauth-buttons.tsx` 相關測試
- ✅ 移除 `oauth-setup.ts` 相關測試
- ✅ 移除 OAuth callback 路由測試
- ✅ 保留並加強 Email/Password 認證測試

### Integration Tests
- [ ] 測試完整的註冊流程
- [ ] 測試完整的登入流程
- [ ] 測試 email 驗證流程
- [ ] 測試密碼重設流程
- [ ] 測試之前 OAuth 使用者的遷移路徑

### Manual Tests
- [ ] 在 Chrome 中測試登入頁面（確認沒有 OAuth 按鈕）
- [ ] 在 Chrome DevTools 檢查 console（確認無錯誤）
- [ ] 在 Chrome DevTools 檢查 network（確認無 OAuth 請求）
- [ ] 測試新使用者完整註冊流程
- [ ] 測試現有使用者登入流程
- [ ] 測試密碼重設流程

---

## Monitoring

### Metrics to Track (Post-Deployment)
- 登入成功率（應保持穩定或提升）
- 註冊轉換率（應保持穩定）
- 密碼重設請求次數（可能短期內增加）
- 使用者回報的登入問題（應減少）
- 頁面載入時間（應略微改善）

### Alerts to Set Up
- 登入失敗率突然增加
- 密碼重設失敗率增加
- 註冊失敗率增加
- 出現大量 404 錯誤（可能有使用者嘗試訪問舊的 OAuth callback）

---

## Documentation Updates

### User-Facing Documentation
- [ ] 更新登入說明（移除 OAuth 相關內容）
- [ ] 更新註冊說明（確認只提及 Email/Password）
- [ ] 新增「如果之前使用 Google 登入」FAQ
- [ ] 更新密碼重設說明

### Developer Documentation
- [ ] 更新認證流程架構圖
- [ ] 更新 API 文檔（移除 OAuth endpoints）
- [ ] 更新資料庫 schema 文檔
- [ ] 記錄移除 OAuth 的決策和原因

### Internal Documentation
- [ ] 建立 OAuth 移除的完整記錄
- [ ] 歸檔 OAuth 相關文檔至 `docs/archived/`
- [ ] 更新技術債務清單
- [ ] 記錄未來如果要重新實作 OAuth 的注意事項
