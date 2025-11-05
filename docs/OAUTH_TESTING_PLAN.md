# OAuth 登入測試計劃

本文件提供完整的 Google 和 LINE OAuth 登入功能測試計劃。

## 📋 測試前準備

### 1. Supabase 設定檢查清單

- [ ] Google Provider 已在 Supabase Dashboard 啟用
- [ ] LINE Provider 已在 Supabase Dashboard 設定（或使用 Custom OAuth Provider）
- [ ] Google OAuth Client ID 和 Secret 已正確填入
- [ ] LINE Channel ID 和 Secret 已正確填入
- [ ] Callback URL 已正確設定：`https://<project-ref>.supabase.co/auth/v1/callback`
- [ ] 「Link accounts with same email」已啟用（在 Authentication → Settings）
- [ ] Site URL 已正確設定

### 2. 資料庫 Migration 檢查

執行以下 SQL 確認 Migration 已套用：

```sql
-- 檢查 Function 是否存在
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_oauth_user';

-- 檢查 Trigger 是否存在
SELECT tgname, tgtype
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

### 3. 本地環境設定

確認 `.env.local` 包含：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 或正式環境 URL
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

確認服務運行在 `http://localhost:3000`

---

## 🧪 測試案例

### 測試組 A：Google OAuth 登入

#### A1. 首次 Google 登入（新使用者）

**目標**：驗證新使用者透過 Google 登入時，系統會自動建立公司和訂閱

**步驟**：
1. 前往 `http://localhost:3000/login`
2. 點選「使用 Google 登入」按鈕
3. 選擇一個從未在系統註冊過的 Google 帳號
4. 授權應用程式存取
5. 等待重定向

**預期結果**：
- ✅ 成功登入並重定向到 `/dashboard`
- ✅ 資料庫中建立了新的 `auth.users` 記錄
- ✅ 自動建立了公司（`companies` 表）
- ✅ 建立了 `company_members` 記錄（role = 'owner', status = 'active'）
- ✅ 建立了免費訂閱（`subscriptions` 表，plan_name = 'free', monthly_article_limit = 5）

**驗證 SQL**：
```sql
-- 檢查使用者
SELECT id, email, raw_app_meta_data->>'provider' as provider
FROM auth.users
WHERE email = 'your-google-email@gmail.com';

-- 檢查公司和成員
SELECT
  u.email,
  c.name as company_name,
  c.subscription_tier,
  cm.role,
  cm.status
FROM auth.users u
JOIN company_members cm ON cm.user_id = u.id
JOIN companies c ON c.id = cm.company_id
WHERE u.email = 'your-google-email@gmail.com';

-- 檢查訂閱
SELECT
  c.name as company_name,
  s.plan_name,
  s.status,
  s.monthly_article_limit,
  s.articles_used_this_month
FROM auth.users u
JOIN company_members cm ON cm.user_id = u.id
JOIN companies c ON c.id = cm.company_id
JOIN subscriptions s ON s.company_id = c.id
WHERE u.email = 'your-google-email@gmail.com';
```

---

#### A2. 已註冊使用者的 Google 登入

**目標**：驗證已註冊的 Google 使用者可以正常登入，不會重複建立公司

**步驟**：
1. 使用 A1 測試過的 Google 帳號
2. 登出系統
3. 前往 `http://localhost:3000/login`
4. 再次點選「使用 Google 登入」
5. 授權並登入

**預期結果**：
- ✅ 成功登入
- ✅ 重定向到 `/dashboard`
- ✅ 不會建立新的公司（公司數量不變）
- ✅ 可以看到之前的資料

**驗證 SQL**：
```sql
-- 檢查公司數量沒有增加
SELECT COUNT(*) as company_count
FROM companies
WHERE owner_id = (
  SELECT id FROM auth.users WHERE email = 'your-google-email@gmail.com'
);
-- 應該還是 1
```

---

#### A3. Email 帳號連結（Email/Password → Google）

**目標**：驗證相同 email 的 Email/Password 帳號可以與 Google 帳號連結

**步驟**：
1. 用 Email/Password 註冊 `test@gmail.com`
2. 登出
3. 前往 `http://localhost:3000/login`
4. 點選「使用 Google 登入」
5. 使用 `test@gmail.com` 的 Google 帳號登入

**預期結果**：
- ✅ 成功登入
- ✅ 不會提示「Email 已被使用」錯誤
- ✅ 帳號已連結（可以用 Email/Password 或 Google 登入）
- ✅ 不會建立重複的使用者或公司

**驗證 SQL**：
```sql
-- 檢查使用者數量（應該只有 1 個）
SELECT COUNT(*) as user_count
FROM auth.users
WHERE email = 'test@gmail.com';
-- 應該 = 1

-- 檢查 provider（應該包含 email 和 google）
SELECT
  email,
  raw_app_meta_data->>'provider' as current_provider,
  raw_app_meta_data->>'providers' as all_providers
FROM auth.users
WHERE email = 'test@gmail.com';
```

---

### 測試組 B：LINE OAuth 登入

#### B1. 首次 LINE 登入（新使用者）

**目標**：驗證新使用者透過 LINE 登入時，系統會自動建立公司和訂閱

**步驟**：
1. 前往 `http://localhost:3000/login`
2. 點選「使用 LINE 登入」按鈕
3. 使用從未在系統註冊過的 LINE 帳號登入
4. 授權應用程式
5. 等待重定向

**預期結果**：
- ✅ 成功登入並重定向到 `/dashboard`
- ✅ 建立了新使用者（provider = 'line'）
- ✅ 自動建立了公司
- ✅ 建立了 company_members 記錄（role = 'owner'）
- ✅ 建立了免費訂閱

**驗證 SQL**：
```sql
-- 檢查 LINE 使用者
SELECT id, email, raw_app_meta_data->>'provider' as provider
FROM auth.users
WHERE raw_app_meta_data->>'provider' = 'line'
ORDER BY created_at DESC
LIMIT 1;
```

**⚠️ 注意**：LINE 登入需要使用者在 LINE 設定中開放 email，否則可能無法取得 email

---

#### B2. 已註冊使用者的 LINE 登入

**目標**：驗證已註冊的 LINE 使用者可以正常登入

**步驟**：
1. 使用 B1 測試過的 LINE 帳號
2. 登出系統
3. 再次使用 LINE 登入

**預期結果**：
- ✅ 成功登入
- ✅ 不會重複建立公司
- ✅ 可以看到之前的資料

---

### 測試組 C：註冊頁面 OAuth

#### C1. Google 註冊（從註冊頁面）

**步驟**：
1. 前往 `http://localhost:3000/register`
2. 點選「使用 Google 註冊」按鈕
3. 使用新的 Google 帳號
4. 授權並完成註冊

**預期結果**：
- ✅ 與登入頁面的 Google 登入行為一致
- ✅ 自動建立公司和訂閱
- ✅ 重定向到 `/dashboard`

---

#### C2. LINE 註冊（從註冊頁面）

**步驟**：
1. 前往 `http://localhost:3000/register`
2. 點選「使用 LINE 註冊」按鈕
3. 使用新的 LINE 帳號
4. 授權並完成註冊

**預期結果**：
- ✅ 與登入頁面的 LINE 登入行為一致
- ✅ 自動建立公司和訂閱
- ✅ 重定向到 `/dashboard`

---

### 測試組 D：UI/UX 測試

#### D1. 按鈕樣式和載入狀態

**步驟**：
1. 前往登入頁面
2. 檢查 OAuth 按鈕樣式
3. 點選 Google 登入
4. 觀察載入狀態

**預期結果**：
- ✅ Google 按鈕有 Google 圖示和正確顏色
- ✅ LINE 按鈕有 LINE 圖示和 LINE 綠色（#06C755）
- ✅ 點選後顯示載入中動畫
- ✅ 載入時按鈕 disabled
- ✅ 分隔線「或」正確顯示

---

#### D2. 響應式設計

**步驟**：
1. 在不同裝置寬度下測試（手機、平板、桌面）
2. 檢查按鈕和佈局

**預期結果**：
- ✅ 按鈕在所有裝置上正確顯示
- ✅ 文字不會溢出
- ✅ 圖示大小適當

---

#### D3. 深色模式

**步驟**：
1. 切換到深色模式
2. 檢查 OAuth 按鈕顏色

**預期結果**：
- ✅ Google 按鈕在深色模式下可讀
- ✅ LINE 按鈕顏色不變（保持 LINE 綠）
- ✅ 分隔線在深色模式下可見

---

### 測試組 E：錯誤處理

#### E1. 使用者取消授權

**步驟**：
1. 點選 Google 登入
2. 在 Google 授權頁面點選「取消」

**預期結果**：
- ✅ 重定向回登入頁面
- ✅ 顯示錯誤訊息（可選）
- ✅ 不會建立使用者

---

#### E2. 網路錯誤

**步驟**：
1. 斷開網路
2. 點選 Google 登入

**預期結果**：
- ✅ 顯示網路錯誤訊息
- ✅ 不會卡住或當機

---

#### E3. Supabase Provider 未設定

**步驟**：
1. 暫時停用 Supabase 的 Google Provider
2. 嘗試 Google 登入

**預期結果**：
- ✅ 顯示錯誤訊息
- ✅ 不會當機

---

### 測試組 F：安全性測試

#### F1. CSRF 保護

**步驟**：
1. 檢查 OAuth 流程是否使用 state 參數
2. 嘗試重放 callback URL

**預期結果**：
- ✅ Supabase 自動處理 CSRF 保護
- ✅ 重放攻擊無效

---

#### F2. Redirect URI 驗證

**步驟**：
1. 檢查 Supabase 的 Redirect URI 設定
2. 確認只允許信任的 URI

**預期結果**：
- ✅ 只有白名單內的 URI 可用
- ✅ 不會重定向到惡意網站

---

## 📊 測試結果記錄

| 測試案例 | 測試日期 | 測試者 | 結果 | 備註 |
|---------|---------|-------|------|------|
| A1 - 首次 Google 登入 | | | ⏳ 待測試 | |
| A2 - 已註冊 Google 登入 | | | ⏳ 待測試 | |
| A3 - Email 帳號連結 | | | ⏳ 待測試 | |
| B1 - 首次 LINE 登入 | | | ⏳ 待測試 | |
| B2 - 已註冊 LINE 登入 | | | ⏳ 待測試 | |
| C1 - Google 註冊 | | | ⏳ 待測試 | |
| C2 - LINE 註冊 | | | ⏳ 待測試 | |
| D1 - 按鈕樣式 | | | ⏳ 待測試 | |
| D2 - 響應式設計 | | | ⏳ 待測試 | |
| D3 - 深色模式 | | | ⏳ 待測試 | |
| E1 - 取消授權 | | | ⏳ 待測試 | |
| E2 - 網路錯誤 | | | ⏳ 待測試 | |
| E3 - Provider 未設定 | | | ⏳ 待測試 | |
| F1 - CSRF 保護 | | | ⏳ 待測試 | |
| F2 - Redirect URI | | | ⏳ 待測試 | |

**圖例**：
- ⏳ 待測試
- ✅ 通過
- ❌ 失敗
- ⚠️ 部分通過

---

## 🐛 常見問題排除

### 問題 1: Google 登入後沒有建立公司

**可能原因**：
- Database Trigger 沒有正確執行
- Migration 沒有套用

**解決方案**：
1. 檢查 Migration 是否套用：`npm run supabase:status`（如果有此指令）
2. 手動執行 Migration：在 Supabase SQL Editor 中執行 `20251105000001_oauth_auto_company_setup.sql`
3. 檢查 Trigger 是否存在（使用上面的 SQL）

---

### 問題 2: LINE 登入顯示「Email is required」

**可能原因**：
- LINE 使用者沒有開放 email 權限
- LINE Channel 沒有申請 email scope

**解決方案**：
1. 在 LINE Developers Console 確認 `email` scope 已啟用
2. 提示使用者在 LINE 設定中開放 email
3. 或：修改程式碼，允許沒有 email 的使用者（需使用 LINE user ID）

---

### 問題 3: 帳號沒有自動連結

**可能原因**：
- Supabase 的「Link accounts with same email」沒有啟用

**解決方案**：
1. 前往 Supabase Dashboard → Authentication → Settings
2. 啟用「Link accounts with same email」選項
3. 重新測試

---

### 問題 4: Callback 失敗

**可能原因**：
- Callback URL 設定錯誤
- 環境變數不正確

**解決方案**：
1. 確認 Google/LINE OAuth 設定中的 Callback URL 為：
   `https://<project-ref>.supabase.co/auth/v1/callback`
2. 確認 `.env.local` 的 `NEXT_PUBLIC_APP_URL` 正確
3. 檢查瀏覽器控制台的錯誤訊息

---

## 🚀 正式環境部署前檢查

部署到 Vercel 或其他平台前，請確認：

- [ ] Supabase Production 環境的 OAuth Provider 已設定
- [ ] Production 的 Callback URL 已加入 Google/LINE OAuth 設定
- [ ] 環境變數已在 Vercel Dashboard 設定
- [ ] `NEXT_PUBLIC_APP_URL` 指向正式網址（如 `https://autopilot-seo.com`）
- [ ] Migration 已在 Production Supabase 執行
- [ ] 至少完成一次端到端測試

---

## 📝 測試報告範本

完成測試後，請填寫以下報告：

```
# OAuth 登入功能測試報告

## 測試環境
- 測試日期：YYYY-MM-DD
- 測試者：[姓名]
- 環境：Development / Production
- Supabase Project ID：[Project ID]

## 測試結果摘要
- 總測試案例：15
- 通過：X
- 失敗：Y
- 部分通過：Z

## 失敗案例詳情
1. [測試案例 ID]: [失敗原因和截圖]
2. ...

## 建議改進
- ...

## 審核簽名
測試者：__________
審核者：__________
日期：__________
```

---

**文件版本**：1.0
**最後更新**：2025-11-05
**維護者**：Auto Pilot SEO Team
