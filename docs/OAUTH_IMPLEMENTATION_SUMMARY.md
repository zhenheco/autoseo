# Google & LINE OAuth 登入實作總結

## 📦 實作內容

本次實作為 Auto Pilot SEO 平台新增了 Google 和 LINE OAuth 社交登入功能，讓使用者可以使用現有的社交帳號快速註冊和登入。

---

## 📂 新增/修改的檔案

### 1. 文件 (Documentation)
- `docs/OAUTH_SETUP.md` - 詳細的 OAuth 設定指南（Google + LINE）
- `docs/OAUTH_TESTING_PLAN.md` - 完整的測試計劃和測試案例
- `docs/OAUTH_IMPLEMENTATION_SUMMARY.md` - 本實作總結文件

### 2. 資料庫 (Database)
- `supabase/migrations/20251105000001_oauth_auto_company_setup.sql` - 新增
  - 建立 `handle_new_oauth_user()` Function
  - 建立 `on_auth_user_created` Trigger
  - 自動為 OAuth 使用者建立公司、成員記錄和免費訂閱

### 3. 前端組件 (Frontend Components)
- `src/components/auth/oauth-buttons.tsx` - 新增
  - `<OAuthButtons>` 組件（Google + LINE 登入按鈕）
  - `<OAuthDivider>` 組件（分隔線）
  - 包含載入狀態、錯誤處理和響應式設計

### 4. 頁面 (Pages)
- `src/app/(auth)/login/page.tsx` - 修改
  - 加入 OAuth 登入按鈕
  - 加入分隔線

- `src/app/(auth)/register/page.tsx` - 修改
  - 加入 OAuth 註冊按鈕（僅在非邀請註冊時顯示）
  - 加入邀請註冊提示

### 5. API 路由 (API Routes)
- `src/app/auth/callback/route.ts` - 修改
  - 支援 `next` 參數（自訂重定向 URL）
  - 加入 OAuth provider 檢測和日誌

---

## 🔧 核心功能

### 1. 自動化使用者設定
當使用者透過 Google 或 LINE 首次登入時，系統會自動：

```
1. 建立 Supabase Auth 使用者
   ↓
2. 觸發 Database Trigger
   ↓
3. 建立公司 (companies 表)
   - 公司名稱：「{email 前綴} 的公司」
   - 訂閱方案：free
   - Owner：該使用者
   ↓
4. 建立成員記錄 (company_members 表)
   - 角色：owner
   - 狀態：active
   ↓
5. 建立免費訂閱 (subscriptions 表)
   - 方案：free
   - 每月文章額度：5 篇
   - 有效期：30 天
   ↓
6. 重定向到 Dashboard
```

### 2. 帳號連結 (Account Linking)
- 相同 email 的帳號會自動連結
- 例如：使用者先用 Email/Password 註冊 `test@gmail.com`，之後可以用 Google `test@gmail.com` 登入
- 需在 Supabase Dashboard 啟用「Link accounts with same email」

### 3. 使用者體驗優化
- 載入狀態動畫（點擊按鈕後顯示 Spinner）
- 按鈕 disabled 防止重複點擊
- 錯誤訊息提示（透過 alert，可改為 Toast）
- 響應式設計（支援手機、平板、桌面）
- 深色模式支援

---

## 🎨 UI/UX 設計

### OAuth 按鈕設計

**Google 按鈕**：
- 顏色：白色背景 + Google 官方圖示
- Hover：淺灰色
- 文字：「使用 Google 登入/註冊」

**LINE 按鈕**：
- 顏色：LINE 官方綠色 (#06C755)
- Hover：深綠色 (#05B44D)
- 文字：白色「使用 LINE 登入/註冊」
- LINE Logo：白色圖示

**分隔線**：
- 灰色橫線 + 中間「或」字
- 與表單風格一致

### 佈局
```
┌─────────────────────────┐
│  [Google 登入按鈕]      │
│  [LINE 登入按鈕]        │
│  ────── 或 ──────      │
│  [Email 登入表單]       │
│  ...                    │
└─────────────────────────┘
```

---

## 🔐 安全性

### 1. CSRF 保護
- Supabase 自動處理 CSRF Token（透過 `state` 參數）
- 不需額外實作

### 2. Redirect URI 驗證
- 只允許白名單內的 Redirect URI
- 在 Google/LINE OAuth Console 和 Supabase 都需設定

### 3. 環境變數隔離
- OAuth Secrets 儲存在 Supabase（不暴露給前端）
- 前端只需要 Supabase Public Key

### 4. 帳號連結安全性
- 只有相同 email 才會連結
- 需使用者授權（透過 OAuth 授權流程）

---

## 📋 下一步（部署前必做）

### 1. Supabase 設定

請按照 `docs/OAUTH_SETUP.md` 完成以下設定：

#### Google OAuth
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立 OAuth 2.0 Client ID
3. 設定 Callback URL：`https://<project-ref>.supabase.co/auth/v1/callback`
4. 在 Supabase Dashboard 啟用 Google Provider
5. 填入 Client ID 和 Client Secret

#### LINE OAuth
1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 建立 LINE Login Channel
3. 設定 Callback URL：`https://<project-ref>.supabase.co/auth/v1/callback`
4. 在 Supabase Dashboard 設定 LINE Provider（或 Custom OAuth）
5. 填入 Channel ID 和 Channel Secret
6. 啟用 `email` scope

#### Supabase 其他設定
- 啟用「Link accounts with same email」
- 設定 Site URL
- 設定允許的 Redirect URLs

### 2. 執行 Database Migration

在 Supabase SQL Editor 執行：

```sql
-- 執行 Migration
-- 複製 supabase/migrations/20251105000001_oauth_auto_company_setup.sql 的內容並執行

-- 驗證 Function 存在
SELECT proname FROM pg_proc WHERE proname = 'handle_new_oauth_user';

-- 驗證 Trigger 存在
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

### 3. 測試

請按照 `docs/OAUTH_TESTING_PLAN.md` 執行完整測試，至少包含：

- ✅ 首次 Google 登入（確認自動建立公司）
- ✅ 首次 LINE 登入（確認自動建立公司）
- ✅ 帳號連結測試（Email → Google）
- ✅ UI 測試（響應式、深色模式）
- ✅ 錯誤處理（取消授權、網路錯誤）

### 4. 環境變數

確認以下環境變數已設定（Vercel Dashboard → Settings → Environment Variables）：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-domain.com  # 正式環境 URL
```

---

## 🐛 已知限制和注意事項

### 1. LINE Email 限制
- LINE 使用者必須在個人設定中開放 email 權限
- 如果使用者沒有開放 email，登入會失敗
- 建議：在錯誤訊息中提示使用者開放 email

### 2. 邀請註冊限制
- 透過邀請連結註冊時，不顯示 OAuth 按鈕
- 原因：邀請需要使用特定的 email
- 如需支援 OAuth 邀請，需額外開發邀請 token 驗證邏輯

### 3. Migration 執行順序
- 必須先執行 Migration 再測試 OAuth 登入
- 否則首次 OAuth 登入不會自動建立公司

### 4. LINE Provider 支援
- Supabase 可能沒有內建 LINE Provider
- 需要使用 Custom OAuth Provider 設定
- 詳見 `docs/OAUTH_SETUP.md`

---

## 📊 影響範圍

### 新增檔案
- 3 個文件檔案
- 1 個 Migration 檔案
- 1 個 React 組件

### 修改檔案
- 2 個頁面（登入、註冊）
- 1 個 API 路由（callback）

### 資料庫變更
- 1 個新 Function
- 1 個新 Trigger
- 0 個新 Table（使用現有 tables）

### 相容性
- ✅ 不影響現有 Email/Password 登入
- ✅ 不影響現有使用者
- ✅ 向後相容
- ✅ 可以單獨啟用 Google 或 LINE（不需要兩者都開啟）

---

## 🎯 預期效果

### 使用者體驗提升
- 降低註冊門檻（不需記憶密碼）
- 加快註冊流程（一鍵註冊）
- 提高轉換率

### 安全性提升
- 使用 OAuth 2.0 標準協議
- 減少密碼外洩風險
- Google/LINE 負責身份驗證

### 開發維護
- 程式碼模組化（OAuth 按鈕可重用）
- 完整的文件和測試計劃
- 易於擴展其他 OAuth Provider（如 GitHub, Facebook）

---

## 🚀 未來擴展建議

### 1. 新增其他 OAuth Providers
- GitHub（開發者友好）
- Facebook（台灣使用者多）
- Apple（iOS 使用者）
- Microsoft（企業使用者）

### 2. UI 改進
- 將 `alert` 改為 Toast 通知
- 加入更詳細的錯誤訊息
- 加入「首次登入」引導流程

### 3. 功能強化
- 支援 OAuth 邀請註冊
- 允許使用者連結/解除連結社交帳號
- 在個人設定頁面顯示已連結的帳號

### 4. 分析追蹤
- 追蹤不同登入方式的轉換率
- 分析使用者偏好的登入方式
- 優化登入流程

---

## 📞 支援和文件

### 相關文件
- [OAUTH_SETUP.md](./OAUTH_SETUP.md) - OAuth 設定指南
- [OAUTH_TESTING_PLAN.md](./OAUTH_TESTING_PLAN.md) - 測試計劃
- [Supabase Auth 文件](https://supabase.com/docs/guides/auth)
- [Google OAuth 文件](https://developers.google.com/identity/protocols/oauth2)
- [LINE Login API 文件](https://developers.line.biz/en/docs/line-login/)

### 問題排除
如遇到問題，請參考：
1. `docs/OAUTH_TESTING_PLAN.md` 的「常見問題排除」章節
2. Supabase Dashboard → Logs → Auth Logs
3. 瀏覽器開發者工具 Console

---

## ✅ 檢查清單

在提交 PR 或部署前，請確認：

- [ ] 閱讀並理解 `docs/OAUTH_SETUP.md`
- [ ] 在 Supabase Dashboard 完成 Google OAuth 設定
- [ ] 在 Supabase Dashboard 完成 LINE OAuth 設定
- [ ] 執行 Database Migration
- [ ] 在本地測試 Google 登入
- [ ] 在本地測試 LINE 登入
- [ ] 測試帳號連結功能
- [ ] 測試 UI（響應式、深色模式）
- [ ] 執行 `npm run build` 確認無錯誤
- [ ] 在 Vercel 設定環境變數
- [ ] 在正式環境測試 OAuth 登入
- [ ] 更新使用者文件（如果有的話）

---

## 👥 相關人員

**實作者**: Claude (Auto Pilot SEO Team)
**實作日期**: 2025-11-05
**審核者**: [待填寫]
**測試者**: [待填寫]

---

## 📝 變更歷史

| 版本 | 日期 | 變更內容 | 負責人 |
|------|------|---------|--------|
| 1.0 | 2025-11-05 | 初始實作（Google + LINE OAuth） | Claude |

---

**祝您部署順利！🎉**

如有任何問題，請參考相關文件或聯絡開發團隊。
