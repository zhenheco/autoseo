# 📝 Changelog

所有重要的專案變更都會記錄在此檔案中。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

---

## [Unreleased]

### 🐛 修正 (Fixed) - 2025-11-15

#### 文章生成功能完整修復

修復了文章批次生成功能的四個關鍵問題：

1. **頁面閃退問題** (Commit: 8025d6f)
   - **問題**：點擊文章生成按鈕時頁面崩潰
   - **原因**：缺少 `sonner` 的 Toaster 組件，導致 toast 通知失敗
   - **解決**：在 `src/app/layout.tsx` 添加 `<Toaster richColors position="top-right" />`

2. **對話框提前關閉** (Commit: 1283809)
   - **問題**：生成流程只執行 2 步就關閉對話框，文章未實際生成
   - **原因**：API 調用未等待完成就關閉對話框
   - **解決**：
     - 將 `onBatchGenerate` 改為返回 `Promise<boolean>`
     - 使用 `async/await` 等待 API 完成
     - 添加 `isStartingGeneration` 狀態顯示「提交中...」
     - 只在成功時關閉對話框

3. **Vercel ES Module 錯誤** (Commit: 4a7b052)
   - **問題**：Vercel 日誌顯示 `ERR_REQUIRE_ESM` 錯誤
   - **原因**：`isomorphic-dompurify` → `jsdom` → `parse5` 依賴鏈中，`parse5` 是純 ES Module 但被 `require()` 加載
   - **解決**：
     - 移除 `isomorphic-dompurify` 套件
     - 改用瀏覽器專用的 `dompurify`
     - 更新 `src/lib/security/html-sanitizer.ts` 和 `src/app/(dashboard)/dashboard/articles/page.tsx` 的 import
     - 驗證所有使用 DOMPurify 的組件都是客戶端組件（`'use client'`）

4. **資料庫 slug 重複衝突** (Commit: 80dd5df)
   - **問題**：批次生成時出現 `duplicate key value violates unique constraint "unique_website_slug"` 錯誤
   - **原因**：所有 article_jobs 使用相同的預設空 slug `''`，違反 `(website_id, slug)` 唯一約束
   - **解決**：
     - 使用 `slugify` 將標題轉換為 URL 友好的 slug
     - 加入時間戳確保唯一性：`${baseSlug}-${timestamp}`
     - 範例：`seo-you-hua-1705234567890`

**測試結果**：✅ 文章生成功能完全正常運作

**相關檔案**：

- `src/app/layout.tsx`
- `src/components/articles/ArticleGenerationButtons.tsx`
- `src/components/articles/ArticleGenerationButtonsWrapper.tsx`
- `src/lib/security/html-sanitizer.ts`
- `src/app/(dashboard)/dashboard/articles/page.tsx`
- `src/app/api/articles/generate-batch/route.ts`

---

### 🚀 Phase 9: WordPress REST API 整合 - ✅ 已完成 (2025-01-28)

#### 新增 (Added)

##### [2025-01-28] - WordPress REST API 完整整合

**WordPress 客戶端**

- 建立 `/src/lib/wordpress/client.ts`
  - 支援 JWT、OAuth 2.0、Application Password 三種認證方式
  - `createPost()`: 創建 WordPress 文章
  - `updatePost()`: 更新現有文章
  - `getCategories()` / `getTags()`: 獲取分類和標籤
  - `createCategory()` / `createTag()`: 創建新分類和標籤
  - `uploadMedia()`: 上傳圖片到 WordPress Media Library
  - `uploadMediaFromUrl()`: 從 URL 上傳圖片
  - `ensureTaxonomies()`: 批量創建或獲取分類和標籤
  - `publishArticle()`: 完整的文章發布流程（包含圖片、分類、標籤、SEO）
  - 支援 Yoast SEO 外掛的 meta 欄位設定

**PublishAgent**

- 建立 `/src/lib/agents/publish-agent.ts`
  - 繼承 BaseAgent，統一執行介面
  - 自動處理 WordPress 認證
  - 支援草稿和發布兩種模式
  - 完整的錯誤處理和執行追蹤

**Orchestrator 整合**

- 更新 `/src/lib/agents/orchestrator.ts`
  - 在 Phase 6 後新增 Phase 7: WordPress 發布
  - 自動從 `website_configs` 讀取 WordPress 配置
  - 先獲取 WordPress 現有分類和標籤，傳給 CategoryAgent
  - 根據 `auto_publish` 設定決定發布狀態（draft/publish）
  - 發布失敗不中斷整體流程
  - 將 WordPress 發布結果記錄到 `article_jobs` 表

**測試腳本**

- 建立 `/scripts/test-wordpress-publish.ts`
  - 測試 WordPress REST API 基本功能
  - 驗證 HTML 內容是否正確發布
  - 測試分類和標籤創建
  - 包含完整的錯誤處理和除錯資訊
- 建立 `/scripts/test-full-workflow-with-wordpress.ts`
  - 完整的端對端測試腳本
  - 涵蓋 8 個階段：Research → Strategy → Writing → Image → Meta → HTML → Quality → Category → WordPress
  - 自動準備測試資料（公司、網站、文章任務）
  - 詳細的執行時間統計
  - 品質檢查結果展示
  - WordPress 發布驗證指南

**環境變數**

- 更新 `.env.example`
  - 新增 `WORDPRESS_URL`: WordPress 網站 URL
  - 新增 `WORDPRESS_USERNAME`: WordPress 使用者名稱
  - 新增 `WORDPRESS_APP_PASSWORD`: WordPress 應用密碼

#### 修改 (Changed)

##### [2025-01-28] - HTML 優化適配 WordPress

**HTMLAgent 優化**

- 確保所有 heading 都有 ID（用於錨點連結）
- 圖片自動添加 `loading="lazy"` 和 `wp-image` class
- 圖片響應式設定（max-width: 100%, height: auto）
- 表格自動包裝 `table-responsive` div
- 移除 WordPress 不支援的 HTML 屬性

**內部連結插入**

- 從之前發布的文章中自動插入內部連結
- 使用 `rel="internal"` 標記內部連結
- 避免重複連結同一個關鍵字

**外部參考連結**

- 智能插入相關的外部連結
- 使用 `target="_blank"` 和 `rel="noopener noreferrer external"`
- 基於內容相關性選擇插入位置

#### 優勢說明

**1. 自動化發布流程**

- 一鍵生成並發布文章到 WordPress
- 無需手動複製貼上
- 自動處理圖片上傳和嵌入
- 自動設定分類、標籤、SEO 元數據

**2. 靈活的認證方式**

- 支援三種安全認證方式
- 推薦使用 JWT 或 Application Password
- 不再支援不安全的純密碼認證

**3. SEO 優化整合**

- 支援 Yoast SEO 外掛
- 自動設定 Focus Keyword、Meta Title、Meta Description
- 完整的 OpenGraph 和 Twitter Card 支援

**4. 錯誤處理**

- WordPress 發布失敗不影響文章生成
- 詳細的錯誤日誌和除錯資訊
- 支援重試機制

**5. 品質控制**

- 發布前經過完整的品質檢查
- 可設定為草稿模式先預覽
- 支援手動審核後再發布

---

### 🚀 Phase 7-8: AI 模型動態管理與測試框架 - ✅ 已完成 (2025-01-27)

#### 新增 (Added)

##### [2025-01-27] - OpenRouter 統一 AI 模型管理

**資料庫架構**

- 重建 `ai_models` 表
  - 支援 OpenRouter 格式的模型資料
  - 包含 context_length、pricing、capabilities
  - 新增 is_featured、sort_order、openrouter_data 欄位
  - 預設載入 12 個模型（OpenAI, Anthropic, Google, Meta）
- 重建 `agent_executions` 表
  - 追蹤每個 Agent 的執行記錄
  - 記錄 token 使用、執行時間、成本
  - 支援 retry 機制
- 擴充 `companies` 表
  - 新增 `ai_model_preferences` JSONB 欄位
  - 支援每個公司選擇不同的模型組合
  - 包含 fallback 模型設定

**OpenRouter 整合**

- 建立 `/src/lib/openrouter.ts`
  - `fetchOpenRouterModels()`: 從 OpenRouter 取得所有可用模型
  - `normalizeOpenRouterModel()`: 模型資料標準化
  - `callOpenRouter()`: 統一的 API 呼叫介面
- 簡化 `/src/lib/ai/ai-client.ts`
  - 從 304 行減少到 78 行（減少 74%）
  - 移除多個 Provider 的複雜邏輯
  - 統一使用 OpenRouter API
- 更新 `/src/lib/agents/orchestrator.ts`
  - 自動從公司設定載入模型偏好
  - 移除硬編碼的模型配置
  - 支援動態模型切換

**API 端點**

- `GET /api/ai-models`: 查詢可用模型列表
  - 支援按 type、provider 篩選
  - 按 sort_order 排序
- `POST /api/ai-models/sync`: 從 OpenRouter 同步模型
  - 自動更新模型列表
  - 保留本地配置（is_featured, sort_order）
- `GET /api/ai-models/company-preferences`: 取得公司模型偏好
  - 回傳完整的模型資訊
  - 使用 `get_company_ai_models()` 函數
- `POST /api/ai-models/company-preferences`: 更新公司模型偏好
  - 驗證模型 ID 是否存在
  - 支援 fallback 模型設定
- `GET /api/ai-models/stats`: Agent 執行統計
  - 使用 `get_agent_execution_stats()` 函數
  - 支援時間範圍篩選
  - 顯示成功率、平均執行時間、總成本

**資料庫函數**

- `get_company_ai_models(company_id)`: 取得公司的 AI 模型設定
- `get_agent_execution_stats(company_id, start_date, end_date)`: Agent 執行統計
- `update_ai_models_updated_at()`: 自動更新 updated_at 欄位

**環境變數**

- 簡化為單一 `OPENROUTER_API_KEY`
- 移除 `PLATFORM_OPENAI_API_KEY`、`PLATFORM_DEEPSEEK_API_KEY`、`PLATFORM_PERPLEXITY_API_KEY`
- 保留 `SERPAPI_API_KEY`（用於 SERP 分析）

##### [2025-01-27] - 端到端測試框架

**測試腳本**

- 建立 `/scripts/test-article-generation.ts`
  - 環境變數完整性檢查
  - 資料庫連線驗證
  - AI 模型配置檢查
  - 測試資料自動準備（公司、使用者、網站）
  - Orchestrator 完整執行流程
  - 詳細的執行統計和結果驗證
  - 錯誤處理和除錯資訊
- 建立 `/scripts/run-test.sh`: 快速執行測試的 Shell 腳本

**測試文檔**

- 建立 `/docs/testing-guide.md`
  - 前置準備說明（環境變數、資料庫、測試資料）
  - 執行步驟和方法
  - 預期結果範例（含完整輸出格式）
  - 常見問題排除（API Key、測試資料、品質檢查）
  - 手動測試步驟（各個 Agent 單獨測試）
  - 效能基準（各階段平均時間、並行加速比）
  - CI/CD 整合範例

#### 修改 (Changed)

##### [2025-01-27] - 型別定義更新

- 簡化 `AIClientConfig` 介面
  - 從 4 個 API Key 改為 1 個 `openrouterApiKey`
- 簡化 `AgentConfig` 介面
  - 移除不必要的欄位
  - 保留核心的模型和參數設定

##### [2025-01-27] - Migration 腳本更新

- 更新 `/scripts/run-migrations.js`
  - 加入 `20250127000001_update_ai_models_for_openrouter.sql`

#### 技術債務處理 (Technical Debt)

##### [2025-01-27] - 程式碼簡化

- ✅ 移除多個 AI Provider 的重複邏輯
- ✅ 統一 API 呼叫介面
- ✅ 減少 70%+ 的 AI Client 程式碼

#### 優勢說明

**1. 統一管理**

- 所有 AI 模型透過 OpenRouter 統一存取
- 一個 API Key 管理所有 Provider
- 自動處理 rate limiting 和 fallback

**2. 自動更新**

- 模型列表可自動同步，無需手動維護
- 新模型自動可用
- 定價資訊自動更新

**3. 成本追蹤**

- 完整的 Token 使用記錄
- 每個 Agent 的成本追蹤
- 支援成本分析和優化

**4. 靈活配置**

- 每個公司可選擇不同的模型
- 支援 fallback 機制
- 動態切換模型無需重啟

**5. 簡化維護**

- 減少 70%+ 的程式碼
- 更易於測試和除錯
- 更少的 API Key 管理負擔

---

### 🎉 MVP 完成 (2025-01-23)

**MVP 核心功能已全部完成！**

✅ 使用者認證與權限系統
✅ 公司與團隊管理
✅ WordPress 網站管理
✅ 文章生成（3 種輸入方式）
✅ 文章狀態追蹤與預覽
✅ 完整的權限控制機制

---

### 🔗 Phase 6: N8N Workflow 整合文檔 - ✅ 已完成 (2025-01-23)

#### 新增 (Added)

##### [2025-01-23] - N8N 整合完整文檔

- 建立 N8N 整合指南
  - 檔案: `N8N-INTEGRATION-GUIDE.md`
  - 內容: 完整的 Workflow 架構分析（20+ 節點）
  - 內容: 平台整合方案（資料庫調整、API 端點設計）
  - 內容: N8N Workflow 設定詳細步驟
  - 內容: 環境變數配置說明
  - 內容: 測試流程和故障排除指南
  - 涵蓋階段: SERP 分析、競爭對手分析、內容策略、文章撰寫、品質檢查、WordPress 發布

- 建立 N8N Workflow 配置範例
  - 檔案: `docs/n8n-workflow-example.json`
  - 內容: 完整的 N8N Workflow JSON 範例
  - 功能: Webhook Trigger（取代 Schedule Trigger）
  - 功能: Callback 節點（6 個處理階段回調）
  - 功能: 取得舊文章節點（供內部連結使用）
  - 功能: 錯誤處理機制
  - 功能: 品質檢查條件判斷

- 建立實作檢查清單
  - 檔案: `N8N-IMPLEMENTATION-CHECKLIST.md`
  - 內容: 10 個 Phase 的完整實作步驟
  - 內容: 資料庫 migration 指令
  - 內容: 環境變數配置步驟
  - 內容: API 端點建立指南
  - 內容: N8N Workflow 設定步驟
  - 內容: Cloudflare Tunnel 設定（本地測試）
  - 內容: 端到端測試案例（3 個 Test Cases）
  - 內容: 常見問題排除指南
  - 內容: 測試結果記錄表

- 建立 API 端點規格文檔
  - 檔案: `docs/api-endpoints.md`
  - 內容: N8N Callback API 完整規格
  - 內容: 取得舊文章 API 規格
  - 內容: 6 個處理階段的資料格式定義
  - 內容: 錯誤處理和重試策略
  - 內容: cURL 測試範例
  - 內容: JavaScript/TypeScript 整合範例

#### 資料庫設計

##### 擴充 article_jobs 表

- 新增欄位: `workflow_data` (JSONB) - 儲存所有 workflow 中間資料
- 新增欄位: `serp_analysis` (JSONB) - SERP 分析結果快取
- 新增欄位: `competitor_analysis` (JSONB) - 競爭對手分析
- 新增欄位: `content_plan` (JSONB) - 內容大綱
- 新增欄位: `quality_score` (INTEGER) - 品質分數 (0-100)
- 新增欄位: `quality_report` (JSONB) - 詳細品質報告
- 新增欄位: `processing_stages` (JSONB) - 各階段狀態追蹤

##### 擴充 website_configs 表

- 新增欄位: `n8n_webhook_url` (TEXT) - 每個網站可設定不同 workflow
- 新增欄位: `workflow_settings` (JSONB) - Workflow 自訂設定

#### API 端點設計

##### `/api/n8n/callback` (POST)

- 功能: 接收 N8N workflow 各階段回調
- 認證: X-API-Key header
- 支援階段: serp_analysis, competitor_analysis, content_plan, content_generation, quality_check, wordpress_publish
- 自動更新: article_jobs 相關欄位和 processing_stages

##### `/api/articles/previous` (GET)

- 功能: 提供舊文章列表供 N8N 內部連結使用
- 認證: X-API-Key header
- 參數: websiteId (必填), limit (預設 20), keyword (選填)
- 回傳: 已發布文章的 title, url, excerpt, keyword

#### Workflow 處理流程

**完整管線** (預估 2 分鐘):

1. Webhook Trigger（平台觸發）
2. SERP 數據分析（Perplexity API，30秒）
3. 競爭對手分析（Web scraping + AI，30秒）
4. 內容策略規劃（GPT-4，20秒）
5. 文章撰寫（GPT-4，60秒）
6. 內部連結添加（查詢舊文章 + AI，10秒）
7. HTML 格式化（10秒）
8. SEO 元數據生成（Slug, Title, Meta，10秒）
9. 品質檢查（10秒）
10. WordPress 發布（條件式，10秒）
11. 狀態回調（持續更新）

#### 品質控制機制

**檢查項目**:

- 字數: 1500-2500 字
- 關鍵字密度: 1.5-2.5%
- 文章結構: H1=1, H2≥3, H3≥5
- 內部連結: ≥3 個
- 外部連結: ≥2 個

**評分標準**:

- 總分 0-100
- 通過門檻: 80 分
- 未通過: 標記為 failed，不發布

#### 測試計劃

**Test Case 1**: 單一關鍵字文章生成

- 輸入: "Next.js 教學"
- 預期: 完整流程執行，品質檢查通過，WordPress 發布成功

**Test Case 2**: 批量關鍵字生成

- 輸入: 3 個關鍵字
- 預期: 3 篇文章依序處理，狀態正確更新

**Test Case 3**: 品質檢查失敗

- 輸入: 冷門關鍵字
- 預期: 品質分數 < 80，標記為 failed，不發布

#### 文檔交付物

- ✅ N8N 整合指南（40+ 頁完整文檔）
- ✅ Workflow 配置 JSON 範例
- ✅ 實作檢查清單（10 個 Phase，詳細步驟）
- ✅ API 端點規格（完整的請求/回應範例）

#### 下一步行動

**明天測試前準備**:

1. 執行資料庫 migration
2. 建立 API 端點檔案
3. 修改 createArticle Server Action
4. 配置 N8N Workflow
5. 啟動 Cloudflare Tunnel
6. 執行端到端測試

**後續優化**:

1. 密碼加密（pgsodium）
2. 圖片生成整合（Google Imagen）
3. 監控儀表板
4. 自動重試機制
5. A/B 測試功能

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
