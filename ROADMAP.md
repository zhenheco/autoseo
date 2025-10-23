# 🗺️ Auto Pilot SEO - 開發路線圖

## 📌 專案目標

建立一個**多租戶 SEO 自動寫文 SaaS 平台**，核心功能包括：
- 企業可管理多個 WordPress 網站
- 自動生成 SEO 優化文章（OpenAI、DeepSeek、Perplexity）
- 團隊協作（5種角色權限）
- 藍新金流訂閱計費
- White Label 品牌白標
- Affiliate 分潤系統

## 🏗️ 技術架構

### 前端
- **框架**: Next.js 14+ (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **狀態管理**: React Context + Zustand
- **表單**: React Hook Form + Zod

### 後端
- **BaaS**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **API**: Next.js API Routes
- **工作流**: N8N (Webhook 觸發)
- **支付**: 藍新金流 (NewebPay)

### 部署
- **前端**: Vercel
- **資料庫**: Supabase Cloud
- **N8N**: 自架或 N8N Cloud

---

## 📅 開發階段

### ✅ Phase 1: 基礎架構 (Week 1-2)

**目標**: 建立專案基礎並完成開發環境設定

#### 任務清單
- [x] Next.js 14+ 專案初始化
- [x] TypeScript 配置
- [x] Tailwind CSS + PostCSS 設定
- [x] ESLint 配置
- [x] Supabase 客戶端整合
- [x] 資料庫 Schema 設計（15張表）
- [x] Row Level Security (RLS) 政策
- [x] 加密函數（pgsodium）
- [ ] 執行 Supabase Migration
- [ ] 型別定義生成
- [ ] 環境變數設定

#### 交付成果
- ✅ 完整的 Next.js 專案架構
- ✅ 資料庫 Schema SQL 檔案
- ⏳ 可運行的開發環境

---

### 🔄 Phase 2: 認證與權限 (Week 2-3)

**目標**: 實作完整的認證系統和 RBAC 權限控制

#### 任務清單
- [ ] Supabase Auth 整合
  - [ ] Email/Password 註冊登入
  - [ ] Google OAuth（選用）
  - [ ] 密碼重置流程
- [ ] 使用者註冊流程
  - [ ] 自動建立個人公司
  - [ ] 設定為 Owner 角色
  - [ ] 建立免費訂閱
- [ ] 角色權限系統
  - [ ] 權限檢查 Hook
  - [ ] 權限守衛組件
  - [ ] 權限檢查 Middleware
- [ ] 登入/註冊頁面
  - [ ] UI 設計
  - [ ] 表單驗證
  - [ ] 錯誤處理

#### 交付成果
- 完整的認證流程
- 5種角色權限系統
- 使用者可註冊並登入

---

### 🏢 Phase 3: 公司與團隊管理 (Week 3-4)

**目標**: 實作多租戶架構和團隊協作功能

#### 任務清單
- [ ] 公司管理功能
  - [ ] 建立/編輯公司資料
  - [ ] 公司設定頁面
  - [ ] Slug 自動生成
- [ ] 成員管理
  - [ ] 邀請成員（Email）
  - [ ] 角色分配
  - [ ] 移除成員
  - [ ] 成員列表
- [ ] 多公司切換
  - [ ] 公司選擇器
  - [ ] Context 狀態管理
- [ ] Dashboard 佈局
  - [ ] Sidebar 導航
  - [ ] Header
  - [ ] 響應式設計

#### 交付成果
- 完整的公司管理介面
- 團隊成員邀請系統
- Dashboard 基礎佈局

---

### 🌐 Phase 4: WordPress 整合 (Week 4-5)

**目標**: 實作 WordPress OAuth 2.0 和網站配置管理

#### 任務清單
- [ ] WordPress OAuth 流程
  - [ ] 授權 API Route
  - [ ] Callback 處理
  - [ ] Token 儲存（加密）
  - [ ] 自動 Token 刷新
- [ ] 網站配置管理
  - [ ] 新增 WordPress 網站
  - [ ] 網站列表
  - [ ] 網站編輯/刪除
- [ ] Brand Voice 配置
  - [ ] 品牌語調表單
  - [ ] JSONB 儲存
  - [ ] 預覽功能
- [ ] API Keys 配置
  - [ ] 自有 API Keys 設定
  - [ ] 加密儲存

#### 交付成果
- WordPress OAuth 完整流程
- 網站配置管理介面
- Brand Voice 設定功能

---

### ✍️ Phase 5: 文章生成核心 (Week 5-7)

**目標**: 實作文章生成的三種輸入方式和 N8N 整合

#### 任務清單
- [ ] 關鍵字輸入方式
  - [ ] 單一關鍵字生成
  - [ ] 批量文字輸入
  - [ ] Excel 批量上傳
- [ ] N8N Webhook 整合
  - [ ] Webhook Trigger API
  - [ ] Job 建立與追蹤
  - [ ] 進度即時更新
- [ ] 文章列表與詳情
  - [ ] 文章列表頁面
  - [ ] 狀態篩選
  - [ ] 文章詳情頁面
  - [ ] 進度顯示
- [ ] 排程發布功能
  - [ ] 時間選擇器
  - [ ] 排程日曆視圖
  - [ ] Cron Job 處理
- [ ] 圖片生成整合
  - [ ] Google Imagen 整合
  - [ ] 圖片上傳到 WordPress

#### 交付成果
- 三種關鍵字輸入介面
- N8N Workflow 整合
- 文章生成完整流程

---

### 💳 Phase 6: 訂閱與計費 (Week 7-8)

**目標**: 整合藍新金流並實作訂閱管理

#### 任務清單
- [ ] 藍新金流整合
  - [ ] NewebPay Service 類別
  - [ ] 加密/簽章函數
  - [ ] 付款表單生成
  - [ ] 回調處理
  - [ ] Webhook 接收
- [ ] 訂閱管理
  - [ ] 方案展示頁面
  - [ ] 訂閱流程
  - [ ] 升級/降級
  - [ ] 取消訂閱
- [ ] 額度管理
  - [ ] 額度檢查
  - [ ] 使用量統計
  - [ ] 超額提示
- [ ] 訂單管理
  - [ ] 訂單列表
  - [ ] 發票資訊

#### 交付成果
- 藍新金流完整流程
- 訂閱方案購買
- 額度控制系統

---

### 🎨 Phase 7: White Label 系統 (Week 8-9)

**目標**: 實作品牌白標功能

#### 任務清單
- [ ] White Label 配置
  - [ ] Logo 上傳
  - [ ] 顏色自訂
  - [ ] Meta 資訊設定
- [ ] 自訂網域
  - [ ] CNAME 設定說明
  - [ ] 網域驗證
  - [ ] DNS 檢查
- [ ] Email 客製化
  - [ ] 發件人設定
  - [ ] Email 模板
- [ ] 動態主題
  - [ ] CSS 變數注入
  - [ ] Logo 動態載入

#### 交付成果
- White Label 完整配置介面
- 自訂網域支援
- 品牌化 Email

---

### 💰 Phase 8: Affiliate 系統 (Week 9-10)

**目標**: 實作推薦分潤系統

#### 任務清單
- [ ] Affiliate 註冊
  - [ ] 申請表單
  - [ ] 審核流程
  - [ ] Affiliate Code 生成
- [ ] 推薦追蹤
  - [ ] UTM 參數追蹤
  - [ ] Cookie 追蹤
  - [ ] 推薦記錄
- [ ] 佣金計算
  - [ ] 自動計算（月租費 20-40%）
  - [ ] 佣金記錄
  - [ ] 狀態管理
- [ ] Affiliate Dashboard
  - [ ] 統計資訊
  - [ ] 推薦連結
  - [ ] 佣金報表
  - [ ] 提領申請

#### 交付成果
- Affiliate 註冊流程
- 推薦追蹤系統
- 佣金管理介面

---

### 🧪 Phase 9: 測試與優化 (Week 10-11)

**目標**: 完整測試和效能優化

#### 任務清單
- [ ] 單元測試
  - [ ] 工具函數測試
  - [ ] Hook 測試
- [ ] 整合測試
  - [ ] API Route 測試
  - [ ] 資料庫操作測試
- [ ] E2E 測試
  - [ ] 使用者流程測試
  - [ ] 關鍵路徑測試
- [ ] 效能優化
  - [ ] 圖片優化
  - [ ] 程式碼分割
  - [ ] 快取策略
- [ ] 安全測試
  - [ ] SQL 注入測試
  - [ ] XSS 測試
  - [ ] CSRF 測試
  - [ ] RLS 政策驗證

#### 交付成果
- 測試覆蓋率 >70%
- 效能優化完成
- 安全漏洞修復

---

### 🚀 Phase 10: 部署與上線 (Week 11-12)

**目標**: 部署到生產環境

#### 任務清單
- [ ] Vercel 部署
  - [ ] 環境變數設定
  - [ ] 網域設定
  - [ ] SSL 憑證
- [ ] Supabase Production
  - [ ] Migration 執行
  - [ ] 備份策略
  - [ ] 監控設定
- [ ] N8N 部署
  - [ ] Workflow 匯入
  - [ ] 環境變數
  - [ ] Webhook URL 更新
- [ ] 監控與日誌
  - [ ] Sentry 錯誤追蹤
  - [ ] Analytics 整合
  - [ ] 日誌系統
- [ ] 文檔撰寫
  - [ ] 使用者手冊
  - [ ] API 文檔
  - [ ] 部署文檔

#### 交付成果
- 生產環境部署完成
- 監控系統運作
- 完整使用文檔

---

## 🎯 未來規劃 (Post-MVP)

### 進階功能
- [ ] AI 圖片生成（Stable Diffusion）
- [ ] 多語言支援（i18n）
- [ ] SEO 分析報告
- [ ] 競品監控
- [ ] 自動內部連結建議
- [ ] A/B Testing 功能

### 整合
- [ ] Google Analytics 整合
- [ ] Search Console 整合
- [ ] 更多 CMS 支援（Webflow, Ghost）
- [ ] Zapier/Make 整合

### 優化
- [ ] AI Model Fine-tuning
- [ ] 更精準的 Brand Voice
- [ ] 圖片 SEO 優化
- [ ] 行動版 App

---

## 📊 成功指標

### Phase 1-3 (基礎)
- ✅ 專案可本地運行
- ✅ 使用者可註冊登入
- ✅ 可建立公司和邀請成員

### Phase 4-5 (核心)
- 可連接 WordPress 網站
- 可成功生成並發布文章
- N8N Workflow 穩定運作

### Phase 6-8 (商業化)
- 可完成訂閱購買流程
- White Label 正常運作
- Affiliate 可追蹤推薦

### Phase 9-10 (上線)
- 生產環境穩定運行
- 錯誤率 <1%
- 回應時間 <2s

---

## 👥 團隊協作

### 開發流程
1. 每個 Phase 開始前進行規劃會議
2. 採用 Git Flow 分支策略
3. Code Review 必須
4. 測試通過才能合併

### 溝通工具
- GitHub Issues: 追蹤 Bug 和 Feature
- GitHub Projects: 專案管理
- 每日站立會議（如有團隊）

---

## 📝 變更記錄

詳見 [CHANGELOG.md](./CHANGELOG.md)
