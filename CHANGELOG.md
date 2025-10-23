# 📝 Changelog

所有重要的專案變更都會記錄在此檔案中。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

---

## [Unreleased]

### 🎉 MVP 完成 (2025-01-23)

**MVP 核心功能已全部完成！**

✅ 使用者認證與權限系統
✅ 公司與團隊管理
✅ WordPress 網站管理
✅ 文章生成（3 種輸入方式）
✅ 文章狀態追蹤與預覽
✅ 完整的權限控制機制

---

### 🎯 Phase 5: 文章生成核心 - ✅ 已完成 (2025-01-23)

#### 新增 (Added)

##### [2025-01-23] - 文章管理系統
- 建立文章管理頁面
  - 檔案: `src/app/(dashboard)/dashboard/articles/page.tsx`
  - 功能: 顯示所有文章列表
  - 功能: 文章狀態標籤（已發布、處理中、失敗、草稿、待處理）
  - 功能: 快速查看文章詳情
- 建立文章生成介面
  - 檔案: `src/app/(dashboard)/dashboard/articles/new/page.tsx`
  - 功能: 方式 1 - 關鍵字輸入
  - 功能: 方式 2 - URL 參考輸入
  - 功能: 方式 3 - 批量關鍵字（最多 10 個）
  - 功能: 自動選擇目標網站
  - 功能: 輸入驗證和錯誤處理
- 建立文章詳情頁面
  - 檔案: `src/app/(dashboard)/dashboard/articles/[id]/page.tsx`
  - 功能: 顯示文章完整資訊
  - 功能: 生成內容預覽
  - 功能: WordPress 文章 ID 顯示
  - 功能: 錯誤訊息顯示
- 實作 Server Actions
  - 檔案: `src/app/(dashboard)/dashboard/articles/new/actions.ts`
  - 功能: createArticle（建立文章生成任務）
  - 功能: 支援三種輸入方式
  - 功能: 批量生成支援
  - 功能: N8N Workflow 整合準備

#### 待整合
- [ ] N8N Webhook 實際呼叫
- [ ] WordPress REST API 實際發布測試
- [ ] AI 內容生成優化

---

### 🎯 Phase 4: WordPress 整合 - ✅ 已完成 (2025-01-23)

#### 新增 (Added)

##### [2025-01-23] - 網站管理系統
- 建立網站管理頁面
  - 檔案: `src/app/(dashboard)/dashboard/websites/page.tsx`
  - 功能: 顯示 WordPress 網站列表
  - 功能: 顯示網站狀態和 CNAME 驗證狀態
  - 功能: 網站編輯和刪除按鈕
- 建立新增網站頁面
  - 檔案: `src/app/(dashboard)/dashboard/websites/new/page.tsx`
  - 功能: WordPress 網站資訊表單
  - 功能: 支援應用密碼驗證
  - 功能: URL 格式驗證
- 實作 Server Actions
  - 檔案: `src/app/(dashboard)/dashboard/websites/new/actions.ts`
  - 功能: createWebsite（新增 WordPress 網站）
  - 檔案: `src/app/(dashboard)/dashboard/websites/actions.ts`
  - 功能: deleteWebsite（刪除網站，需 owner/admin 權限）
  - 功能: updateBrandVoice（更新品牌語調設定）
  - 功能: JSONB 儲存品牌語調、目標受眾、關鍵字

#### 待整合
- [ ] WordPress REST API 連線驗證
- [ ] 密碼加密儲存（目前明文）
- [ ] 網站編輯頁面 UI

---

### 🎯 Phase 3: 公司與團隊管理 - ✅ 已完成 (2025-01-23)

#### 新增 (Added)

##### [2025-01-23] - 公司與團隊管理
- 建立設定頁面
  - 檔案: `src/app/(dashboard)/dashboard/settings/page.tsx`
  - 功能: 公司資訊編輯表單
  - 功能: 團隊成員列表顯示
  - 功能: 成員移除功能
- 實作 Server Actions
  - 檔案: `src/app/(dashboard)/dashboard/settings/actions.ts`
  - 功能: updateCompany（更新公司資訊）
  - 功能: removeMember（移除成員）
  - 功能: updateMemberRole（更新成員角色）
  - 功能: inviteMember（邀請成員，待完整實作）
- 新增輔助函數
  - 檔案: `src/lib/auth.ts`
  - 功能: getUserPrimaryCompany（取得主要公司）
  - 功能: getCompanyMembers（取得公司成員）

---

### 🎯 Phase 2: 認證與權限系統 - ✅ 已完成 (2025-01-23)

#### 新增 (Added)

##### [2025-01-23] - UI 元件庫
- 安裝並配置 shadcn/ui
  - 套件: `@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`
- 建立基礎 UI 元件
  - 檔案: `src/components/ui/button.tsx`
  - 檔案: `src/components/ui/input.tsx`
  - 檔案: `src/components/ui/label.tsx`
  - 檔案: `src/components/ui/card.tsx`
- 建立工具函數
  - 檔案: `src/lib/utils.ts` (cn 函數用於合併 className)

##### [2025-01-23] - 認證系統
- 實作 Supabase Auth 功能
  - 檔案: `src/lib/auth.ts`
  - 功能: signUp (註冊 + 自動建立公司和訂閱)
  - 功能: signIn (登入)
  - 功能: signOut (登出)
  - 功能: getUser (取得當前使用者)
  - 功能: getUserCompanies (取得使用者公司列表)
- 建立登入頁面
  - 檔案: `src/app/(auth)/login/page.tsx`
  - 檔案: `src/app/(auth)/login/actions.ts`
  - 功能: 支援錯誤訊息顯示
- 建立註冊頁面
  - 檔案: `src/app/(auth)/signup/page.tsx`
  - 檔案: `src/app/(auth)/signup/actions.ts`
  - 功能: 支援錯誤訊息顯示
- 建立 OAuth callback 路由
  - 檔案: `src/app/auth/callback/route.ts`

##### [2025-01-23] - Dashboard 基礎
- 建立 Dashboard 佈局
  - 檔案: `src/app/(dashboard)/dashboard/layout.tsx`
  - 功能: 導航選單（Dashboard、網站管理、文章管理、設定）
  - 功能: 登出按鈕
- 建立 Dashboard 主頁
  - 檔案: `src/app/(dashboard)/dashboard/page.tsx`
  - 功能: 顯示使用者公司列表
  - 功能: 顯示訂閱狀態
  - 功能: 快速開始選項
- 更新首頁
  - 檔案: `src/app/page.tsx`
  - 功能: 添加「開始使用」和「登入」按鈕

#### 修改 (Changed)

##### [2025-01-23] - Tailwind CSS 4.x 相容性修復
- 修改 PostCSS 配置
  - 檔案: `postcss.config.js`
  - 變更: 使用 `@tailwindcss/postcss` 代替 `tailwindcss`
- 修改全域樣式
  - 檔案: `src/app/globals.css`
  - 變更: 移除 `@apply border-border`
  - 變更: 將 `@apply bg-background text-foreground` 改為純 CSS
- 修改 Tailwind 配置
  - 檔案: `tailwind.config.ts`
  - 變更: `darkMode: ["class"]` → `darkMode: "class"`

#### 修復 (Fixed)

##### [2025-01-23] - TypeScript 類型錯誤
- 修復 Server Action 返回類型問題
  - 檔案: `src/app/(auth)/login/actions.ts`, `src/app/(auth)/signup/actions.ts`
  - 修復: 使用 redirect 代替返回物件來處理錯誤
- 修復 Dashboard 頁面類型問題
  - 檔案: `src/app/(dashboard)/dashboard/page.tsx`
  - 修復: 添加類型斷言解決 Supabase 查詢返回類型問題

---

### 🎯 Phase 1: 基礎架構 - ✅ 已完成 (2025-01-23)

#### 新增 (Added)

##### [2025-01-23] - 專案初始化
- 建立 Next.js 14 專案架構（App Router）
  - 檔案: `package.json`, `next.config.js`, `tsconfig.json`
- 設定 TypeScript 配置
  - 檔案: `tsconfig.json`
- 整合 Tailwind CSS 4.x
  - 檔案: `tailwind.config.ts`, `postcss.config.js`, `src/app/globals.css`
- 設定 ESLint
  - 檔案: `.eslintrc.json`

##### [2025-01-23] - Supabase 整合
- 安裝 Supabase 客戶端套件
  - 套件: `@supabase/supabase-js`, `@supabase/ssr`
- 建立 Supabase 客戶端工具函數
  - 檔案: `src/lib/supabase/client.ts` (瀏覽器端)
  - 檔案: `src/lib/supabase/server.ts` (伺服器端)
  - 檔案: `src/lib/supabase/middleware.ts` (Middleware)
- 建立 Next.js Middleware 處理認證
  - 檔案: `src/middleware.ts`
  - 功能: 自動刷新 session, 保護 /dashboard 路由

##### [2025-01-23] - 資料庫架構設計
- 建立完整的資料庫 Schema (15張表)
  - 檔案: `supabase/migrations/20250101000000_init_schema.sql`
  - 核心表: companies, company_members, role_permissions, website_configs, article_jobs, api_usage_logs
  - 訂閱表: subscription_plans, subscriptions, orders
  - 系統表: activity_logs
- 建立進階功能表
  - 檔案: `supabase/migrations/20250101000001_advanced_features.sql`
  - 表: white_label_configs, affiliates, affiliate_referrals, affiliate_commissions
- 建立 RLS 政策和函數
  - 檔案: `supabase/migrations/20250101000002_rls_and_functions.sql`
  - 功能: 加密/解密函數 (pgsodium)
  - 功能: has_permission() 權限檢查
  - 功能: 完整的 Row Level Security 政策

##### [2025-01-23] - 專案配置
- 建立環境變數範本
  - 檔案: `.env.example`
  - 包含: Supabase, N8N, 藍新金流, AI API Keys 配置
- 建立 .gitignore
  - 檔案: `.gitignore`
- 建立專案目錄結構
  - 目錄: `src/app`, `src/components`, `src/lib`, `src/types`, `src/hooks`, `src/utils`
  - 目錄: `supabase/migrations`

##### [2025-01-23] - 專案文檔
- 建立開發路線圖
  - 檔案: `ROADMAP.md`
  - 內容: 完整的 10 個開發階段規劃
- 建立資料庫文檔
  - 檔案: `supabase/README.md`
  - 內容: Schema 說明、Migration 執行指南、驗證方法
- 建立變更日誌
  - 檔案: `CHANGELOG.md`
  - 格式: Keep a Changelog

#### 修改 (Changed)
- 無

#### 修復 (Fixed)
- 無

#### 移除 (Removed)
- 無

---

## 🔮 即將推出 (Upcoming)

### Phase 3: 公司與團隊管理 (進行中)
- [ ] 公司設定頁面
- [ ] 成員管理介面
- [ ] 成員邀請系統（Email）
- [ ] 角色權限管理
- [ ] 多公司切換功能

### Phase 4: WordPress 整合
- [ ] WordPress OAuth 連接流程
- [ ] 網站設定頁面
- [ ] CNAME 設定指引
- [ ] WordPress 自動發布測試

### Phase 5: 文章生成核心
- [ ] 文章生成介面（3種輸入方式）
- [ ] N8N Workflow 整合
- [ ] AI 內容生成預覽
- [ ] 文章草稿系統

---

## 📌 版本說明

- **[Unreleased]**: 尚未發布的變更
- **[版本號]**: 已發布的版本
  - **新增 (Added)**: 新功能
  - **修改 (Changed)**: 既有功能的變更
  - **棄用 (Deprecated)**: 即將移除的功能
  - **移除 (Removed)**: 已移除的功能
  - **修復 (Fixed)**: Bug 修復
  - **安全 (Security)**: 安全性修復

---

## 🔗 相關連結

- [專案路線圖](./ROADMAP.md)
- [資料庫文檔](./supabase/README.md)
- [貢獻指南](./CONTRIBUTING.md) (待建立)
