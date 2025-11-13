# OAuth 認證流程修復提案

## 變更 ID
`fix-oauth-authentication-flow`

## 問題陳述

### 核心問題
使用 Google OAuth 登入的用戶在成功完成 Google 授權後，被系統重定向回登入頁面（`/login`），而非預期的 dashboard 頁面。這導致用戶無法正常登入系統。

### 根本原因分析

經過深入調查，發現三個互相關聯的問題：

1. **Session 驗證不完整**
   - 當前 OAuth callback (`src/app/auth/callback/route.ts`) 僅檢查 session 是否存在
   - 未驗證用戶是否擁有必要的關聯資料（公司、訂閱、tokens 等）
   - 即使用戶資料不完整，也會重定向到 dashboard，導致後續頁面載入失敗

2. **Database Trigger 執行不可靠**
   - 現有的 `handle_new_oauth_user` trigger 只在 `INSERT` 時觸發
   - 如果用戶已存在（例如之前用 Email 註冊過），trigger 不會執行
   - Trigger 執行是異步的，可能比 callback 處理慢
   - Trigger 失敗時沒有重試機制

3. **時序競爭（Race Condition）**
   - OAuth callback 立即查詢用戶公司資料
   - Database Trigger 可能尚未完成公司建立
   - 導致查詢失敗，用戶被誤判為「沒有公司」並重定向到登入頁

### 資料不一致問題

**新發現的嚴重問題**：OAuth 和 Email 註冊流程建立的資料不一致

| 資料項目 | Email 註冊 | OAuth 註冊（Trigger） | 影響 |
|---------|-----------|-------------------|------|
| `companies` | ✅ | ✅ | - |
| `company_members` | ✅ | ✅ | - |
| `subscriptions` | ✅ | ✅ | - |
| `company_subscriptions` | ✅ | ✅ | - |
| `one_time_tokens` | ✅ (50 tokens) | ❌ | OAuth 用戶無法使用 AI 功能 |
| `referral_codes` | ✅ | ❌ | OAuth 用戶無法分享推薦碼 |
| `activity_logs` | ✅ | ❌ | 無法追蹤 OAuth 用戶活動 |

### 影響範圍

- **用戶體驗**：所有使用 Google OAuth 登入的新用戶無法正常進入系統
- **資料完整性**：成功登入的 OAuth 用戶缺少關鍵功能（tokens、推薦碼）
- **業務影響**：降低註冊轉換率，影響用戶獲取

---

## 解決方案

### 核心策略：三層防護機制 + 流程統一

#### 1. 三層防護機制

實作漸進式的資料驗證和建立流程：

**第一層：快速檢查現有資料**
- 立即查詢用戶是否已有公司
- 如果有，直接返回成功（最快路徑，< 100ms）

**第二層：輪詢等待 Database Trigger**
- 使用指數退避演算法輪詢（100ms → 200ms → 400ms → 800ms → 1600ms）
- 總等待時間：3.1 秒
- 如果 Trigger 在此期間完成，返回成功

**第三層：Fallback 手動建立**
- 如果輪詢超時仍未找到公司，觸發手動建立
- 使用 PostgreSQL RPC function 確保原子性
- 包含 advisory lock 防止並發衝突

#### 2. 流程統一

提取公司建立邏輯為共用函數，確保 Email 和 OAuth 註冊建立相同的資料：

```
共用函數：createCompanyForUser()
├── companies
├── subscriptions
├── company_subscriptions
├── company_members
├── one_time_tokens (50 tokens)
├── referral_codes
└── activity_logs
```

---

## 技術實作概述

### 新增元件

1. **RPC Function**: `create_company_for_oauth_user()`
   - 使用 PostgreSQL 事務確保原子性
   - 包含 advisory lock 防止並發
   - 建立所有必要資料（包含 tokens 和 referral_code）

2. **模組**: `src/lib/auth/oauth-setup.ts`
   - `ensureUserHasCompany()` - 主要協調函數（三層邏輯）
   - `getUserCompany()` - 檢查用戶公司
   - `waitForCompanySetup()` - 輪詢等待（指數退避）
   - `createCompanyForUser()` - 調用 RPC function
   - 監控和日誌函數

3. **監控表**: `oauth_login_metrics`
   - 記錄每次 OAuth 登入的路徑（existing/trigger_success/fallback_success/failed）
   - Trigger 延遲時間
   - 用於分析和警報

### 修改元件

1. **`src/app/auth/callback/route.ts`**
   - 整合 `ensureUserHasCompany()`
   - 改進錯誤處理和用戶提示
   - 詳細的結構化日誌

2. **`src/lib/auth.ts`**
   - 重構 `signUp()` 函數
   - 提取 `createCompanyData()` 共用邏輯
   - Email 註冊使用相同的資料建立流程

3. **Database Trigger**: `handle_new_oauth_user`
   - 更新以建立 `one_time_tokens` 和 `referral_codes`
   - 確保與 RPC function 一致

---

## 設計決策

### 1. 為何選擇三層防護而非單一方案？

**考量**：
- **只依賴 Trigger**：不可靠，已證明有延遲和失敗情況
- **只依賴 Fallback**：增加資料庫負載，忽略 Trigger 優化
- **三層防護**：結合速度、可靠性和容錯性

**優點**：
- 大多數情況走第一層（快速）
- Trigger 正常時走第二層（不增加額外負載）
- Trigger 失敗時走第三層（保證成功）
- 可觀測性強（知道哪條路徑觸發）

### 2. 為何使用指數退避而非固定間隔？

- **效能優化**：前期快速檢查（100ms），後期降低頻率（1600ms）
- **減少負載**：避免固定間隔造成的持續高頻查詢
- **符合預期**：大多數 Trigger 在 500ms 內完成，指數退避能更快檢測到

### 3. 為何使用 RPC Function 而非應用層事務？

- **原子性保證**：PostgreSQL 事務確保全有或全無
- **效能更好**：減少網路往返（一次調用 vs 多次查詢）
- **並發安全**：advisory lock 在資料庫層級實現
- **一致性**：與現有的 `get_user_by_email` RPC 模式保持一致

### 4. 為何統一 Email 和 OAuth 流程？

- **資料一致性**：確保所有用戶擁有相同的功能
- **維護性**：單一真相來源，減少重複代碼
- **測試性**：只需測試一套邏輯
- **未來擴展**：易於加入新的註冊方式（GitHub、Facebook 等）

---

## 多 Provider 擴展性

### 設計原則

雖然當前專注於 Google OAuth，但架構設計支援未來擴展到其他 providers：

```typescript
interface OAuthProvider {
  name: 'google' | 'github' | 'facebook';
  displayName: string;
  defaultCompanyNameStrategy: (user: User) => string;
}
```

### 擴展步驟

加入新 provider 只需：
1. 在 `OAUTH_PROVIDERS` 配置中新增
2. 如有特殊邏輯，在相應函數加入 switch case
3. 核心三層防護邏輯無需修改

---

## 監控和可觀測性

### 關鍵指標

1. **路徑分佈**
   - `existing`: 第一層成功率（目標：> 90%，成熟產品）
   - `trigger_success`: 第二層成功率
   - `fallback_success`: 第三層成功率（目標：< 5%）
   - `failed`: 失敗率（目標：0%）

2. **效能指標**
   - P50, P95, P99 登入延遲時間（目標：P95 < 1 秒）
   - Trigger 平均延遲（目標：< 500ms）

3. **警報條件**
   - Fallback 觸發率 > 5% → 檢查 Database Trigger
   - 任何 `failed` 事件 → 立即警報
   - Trigger 延遲 > 3 秒 → 效能警報

### 日誌策略

- **結構化日誌**：JSON 格式，便於查詢和分析
- **敏感資料脫敏**：email 顯示為 `user@***.com`
- **完整追蹤**：每次 OAuth 登入從頭到尾的完整日誌鏈

---

## 安全性考量

### 1. SQL Injection 防護
- 使用 RPC function + 參數化查詢
- Supabase client 內建防護

### 2. 權限控制
```sql
CREATE FUNCTION create_company_for_oauth_user(...)
SECURITY DEFINER -- 以函數擁有者身份執行
AS $$
BEGIN
  -- 驗證調用者權限
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  -- 處理邏輯...
END;
$$;
```

### 3. Rate Limiting
- 同一用戶 5 分鐘內只能調用一次 callback
- 防止濫用和重複建立

### 4. CSRF 防護
- OAuth state 參數（Supabase 自動處理）
- `redirectTo` 參數白名單驗證

---

## 測試策略

### 單元測試（Vitest）
- ✅ `oauth-setup.ts` 各個函數
- ✅ 模擬各種情境（成功、失敗、超時）

### 整合測試
- ✅ 完整 OAuth 流程
- ✅ Database Trigger 測試
- ✅ 並發情境測試

### 手動測試場景（8 個）
1. 新用戶首次 Google OAuth 登入
2. 已存在用戶再次 OAuth 登入
3. Database Trigger 延遲執行
4. Database Trigger 完全失敗
5. 並發登入（多個 tab）
6. 網路不穩定情況
7. 用戶取消 Google 授權
8. 已有公司的用戶使用 OAuth 登入

### 驗證工具
- Chrome DevTools（Network、Console、Application）
- Supabase Dashboard（Table Editor、Logs）
- 資料完整性檢查 SQL

---

## 部署策略

### 分階段部署

**Phase 1: 基礎設施**（測試環境）
1. 部署 Database Migrations
2. 驗證 RPC function 和 Trigger

**Phase 2: 應用部署**（灰度發布）
1. 部署到 Vercel Preview
2. 執行完整測試場景
3. 驗證監控指標

**Phase 3: 生產環境**
1. 部署到 Production
2. 24-48 小時密集監控
3. 準備回滾計畫

### 回滾計畫

**代碼回滾**：
```bash
git revert <commit-hash>
vercel deploy
```

**資料庫回滾**：
- 不建議回滾 Migration（可能已有新資料）
- RPC function 保留（不影響現有功能）

### Feature Flag（可選）

```typescript
const ENABLE_OAUTH_TRIPLE_GUARD =
  process.env.ENABLE_OAUTH_TRIPLE_GUARD === 'true';
```

優點：可快速切換，無需重新部署

---

## 成功指標

### 定量指標
- ✅ **登入成功率**: 100%（零失敗）
- ✅ **Fallback 觸發率**: < 5%
- ✅ **P95 登入延遲**: < 1 秒
- ✅ **資料完整性**: 100% OAuth 用戶擁有完整資料

### 定性指標
- ✅ 用戶反饋：無 OAuth 登入失敗回報
- ✅ 資料一致性：Email 和 OAuth 用戶體驗相同
- ✅ 可維護性：代碼清晰，易於擴展

---

## 風險和緩解

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| RPC function 失敗 | 高 | 保留 Database Trigger 作為雙重保障 |
| 並發建立多個公司 | 中 | PostgreSQL advisory lock |
| 部署影響現有用戶 | 中 | 分階段部署 + Feature flag |
| Trigger 延遲增加 | 低 | 指數退避 + 3.1 秒超時足夠 |
| 監控數據過多 | 低 | 設定資料保留期限（30 天） |

---

## 時間估算

- **Phase 1（基礎設施）**: 1-2 天
- **Phase 2（核心邏輯）**: 2-3 天
- **Phase 3（測試）**: 2-3 天
- **Phase 4（部署）**: 1 天

**總計**: 6-9 個工作天

---

## 相關文檔

- 原始問題分析：`docs/OAUTH_FIX_PLAN.md`
- 技術設計：`openspec/changes/fix-oauth-authentication-flow/design.md`
- 實作任務：`openspec/changes/fix-oauth-authentication-flow/tasks.md`
- 規格文檔：
  - `openspec/changes/fix-oauth-authentication-flow/specs/oauth-authentication/spec.md`
  - `openspec/changes/fix-oauth-authentication-flow/specs/user-registration/spec.md`

---

## 審批者

- [ ] 技術負責人
- [ ] 產品負責人
- [ ] 安全負責人

---

**建立日期**: 2025-11-10
**最後更新**: 2025-11-10
**狀態**: 待審批
