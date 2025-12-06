# 開發日誌 (DevLog)

---

## 2025-12-06: 修復文章列表與網站管理數據不一致問題

### 問題描述

- 文章列表顯示 10 篇（從 `article_jobs` 查詢）
- 網站管理顯示 15 篇（從 `generated_articles` 查詢）
- 兩個頁面使用不同的數據源，導致數量不一致

### 根本原因

1. **數據源不一致**：文章列表用 `article_jobs`，網站管理用 `generated_articles`
2. **重複生成問題**：6 個 job 各生成了 2 篇 `generated_articles`
   - 原因：代碼使用 `INSERT` 而非 `UPSERT`，且無唯一約束
   - 當任務處理超過 3 分鐘，會被 GitHub Actions 重新處理

### 修復方案

#### 1. 清理重複數據

```sql
DELETE FROM generated_articles
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY article_job_id ORDER BY created_at DESC) as rn
    FROM generated_articles
    WHERE article_job_id IS NOT NULL
  ) t WHERE rn > 1
);
```

刪除 6 篇重複文章。

#### 2. 添加唯一約束

```sql
CREATE UNIQUE INDEX idx_generated_articles_job_id_unique
ON generated_articles (article_job_id)
WHERE article_job_id IS NOT NULL;
```

#### 3. 修改網站管理頁面查詢邏輯

- **修改檔案**: `src/app/(dashboard)/dashboard/websites/[id]/page.tsx`
- **變更**: 統一從 `article_jobs` 查詢，JOIN `generated_articles`

#### 4. 修改 article-storage.ts 使用 UPSERT

- **修改檔案**: `src/lib/services/article-storage.ts`
- **變更**: 將 `insert()` 改為 `upsert()`，以 `article_job_id` 為衝突鍵

### 修復結果

| 修復前                                  | 修復後                             |
| --------------------------------------- | ---------------------------------- |
| `article_jobs`: 10 篇                   | `article_jobs`: 10 篇              |
| `generated_articles`: 15 篇（6 篇重複） | `generated_articles`: 9 篇（正確） |
| 無唯一約束                              | 有唯一約束                         |

現在兩個頁面使用同一個數據源（`article_jobs`），數據一致。

---

## 2025-12-05: 產業欄位功能修復

### 問題描述

文章生成時「產業」欄位未正確傳遞，導致 AI 無法根據產業特性調整內容。

### 根本原因

1. **網站編輯頁面**沒有產業、地區、語言欄位，無法在網站層級設定
2. **ArticleFormTabs** 只從 localStorage 讀取設定，未從網站配置自動帶入

### 修復方案

#### 1. 網站設定表單

- **新建檔案**: `src/app/(dashboard)/dashboard/websites/[id]/edit/WebsiteSettingsForm.tsx`
- **功能**: 讓用戶在網站編輯頁設定產業、目標地區、撰寫語言

#### 2. 更新網站設定 Action

- **修改檔案**: `src/app/(dashboard)/dashboard/websites/actions.ts`
- **新增函數**: `updateWebsiteSettings()` 儲存產業/地區/語言設定

#### 3. 網站設定 API

- **新建檔案**: `src/app/api/websites/[id]/settings/route.ts`
- **功能**: 提供 API 端點讓前端取得網站的產業/地區/語言設定

#### 4. ArticleFormTabs 自動載入

- **修改檔案**: `src/app/(dashboard)/dashboard/articles/components/ArticleFormTabs.tsx`
- **新增邏輯**: 當選擇網站時自動呼叫 API 載入網站設定，覆蓋表單欄位

### 行為說明

- 用戶可在「網站管理」→「編輯」頁面設定預設的產業、地區、語言
- 寫文章時選擇該網站，表單會自動帶入網站的設定
- 如果網站沒有設定，則使用用戶上次的選擇（localStorage）
- 用戶仍可在寫文章頁面手動修改

---

## 2025-12-04: 安全性與性能優化

### 安全性修復

#### 1. Debug 端點生產環境禁用

- **檔案**: `src/middleware.ts`
- **修改**: 在生產環境對 `/api/debug/*` 返回 404，開發環境仍可訪問

#### 2. Dashboard 認證恢復

- **檔案**: `src/lib/supabase/middleware.ts`
- **修改**: 恢復被註解的認證檢查，未登入用戶訪問 `/dashboard` 會重定向到 `/login`

#### 3. 日誌脫敏工具

- **檔案**: `src/lib/utils/log-sanitizer.ts`（新建）
- **功能**: 自動過濾 API keys、tokens、密碼等敏感資訊

### 性能優化

#### 1. Dashboard 查詢並行化

- **檔案**: `src/app/(dashboard)/dashboard/page.tsx`
- **修改**: 將 4 個連續 Supabase 查詢改為 `Promise.all()` 並行執行
- **效果**: 預估減少 300-400ms 頁面載入時間

#### 2. 移除不必要的輪詢

- **檔案**: `src/app/(dashboard)/dashboard/websites/[id]/components/WebsiteArticleManager.tsx`
- **修改**: 移除 60 秒輪詢，保留 Realtime 訂閱機制
- **效果**: 減少不必要的伺服器請求和重新渲染

### UI 改進

#### 聯絡方式

- **檔案**: `src/components/dashboard/sidebar.tsx`
- **修改**: 在側邊欄底部添加「客服信箱」連結（mailto:service@1wayseo.com）

#### AI 模型頁面認證

- **檔案**: `src/app/(dashboard)/dashboard/settings/ai-models/page.tsx`
- **修改**: 添加用戶認證檢查，未登入重定向到登入頁

### Cloudflare Rate Limiting

- **規則 ID**: `6070e61623a146899f4f9a3010e2f957`
- **匹配**: 所有 `/api/` 開頭的請求
- **限制**: 每 IP 每 10 秒 10 次請求（約 60 次/分鐘）
- **超過後**: 封鎖 10 秒
- **注意**: Free 方案限制只能 1 條規則、10 秒週期、不支援 regex

### 金流環境切換（沙盒 → 生產）

- **Vercel 環境變數**: 已更新
  - `NEWEBPAY_MERCHANT_ID`: NPP83446730
  - `NEWEBPAY_HASH_KEY`: (已設定)
  - `NEWEBPAY_HASH_IV`: (已設定)
  - `NEWEBPAY_API_URL`: https://core.newebpay.com
- **GitHub Secrets**: 已同步更新
- **藍新後台 Webhook**:
  - Notify URL: https://1wayseo.com/api/payment/notify
  - Return URL: https://1wayseo.com/api/payment/callback

### 完成項目

- [x] Phase 1.1: Debug 端點禁用
- [x] Phase 1.2: Dashboard 認證恢復
- [x] Phase 1.3: API 路由認證（AI 模型頁面）
- [x] Phase 1.4: 日誌脫敏工具
- [x] Phase 2.1: Dashboard 查詢並行化
- [x] Phase 2.3: 移除不必要的輪詢
- [x] Phase 2.5: 側邊欄客服信箱
- [x] Phase 3: Cloudflare Rate Limiting
- [x] Phase 4: 金流環境切換

---

## 2025-12-04: 修復訂閱配額疊加 bug（嚴重）

### 問題描述

用戶購買 PRO 方案後升級到 BUSINESS 方案，累積的配額被清零：

- 預期配額：STARTER (50K) + PRO x2 (500K) + BUSINESS x2 (1500K) = **2,050K**
- 實際配額：只有 **1,500K**（2 次 BUSINESS）

### 根因分析

`payment-service.ts` 第 599-608 行的邏輯只檢查**相同 plan_id** 的疊加：

```typescript
// ❌ BUG：只檢查相同 plan_id
.eq("plan_id", planData.id)
```

當升級到**不同方案**時（PRO → BUSINESS）：

1. 舊訂閱被刪除
2. 新訂閱只有新方案的 base_tokens
3. **累積配額全部丟失**

### 解決方案

修改跨方案升級邏輯，保留並累加所有配額：

```typescript
// ✅ 修復：保留並累加配額
const previousMonthlyQuota = oldSubscription?.monthly_token_quota || 0;
const previousQuotaBalance = oldSubscription?.monthly_quota_balance || 0;
const newMonthlyQuota = previousMonthlyQuota + planData.base_tokens;
const newQuotaBalance = previousQuotaBalance + planData.base_tokens;
```

### 修改檔案

| 檔案                                                         | 修改內容                                         |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `src/lib/payment/payment-service.ts`                         | 終身方案升級邏輯（lines 646-697）- 保留累積配額  |
| `src/lib/payment/payment-service.ts`                         | 定期定額訂閱邏輯（lines 961-1007）- 保留累積配額 |
| `supabase/migrations/20251204000001_fix_deduction_order.sql` | 修正扣款順序                                     |

### 扣款順序修正

同時修正 `deduct_tokens_atomic` 函式的扣款順序：

- **修改前**：先扣月配額 (`monthly_quota_balance`)，再扣購買的 (`purchased_token_balance`)
- **修改後**：先扣購買的 credits (`purchased_token_balance`)，再扣月配額 (`monthly_quota_balance`)

用戶需求：「扣款的時候要先用單次的扣款」

### 影響範圍

- 所有未來的跨方案升級都會正確累加配額
- 已受影響的用戶需要手動修正配額（如 ace@stima.io 已手動修正為 2,050K）

---

## 2025-12-04: 修復文章內外部連結未插入問題

### 問題描述

文章生成後，HTML 編輯器中看不到任何內外部連結。經調查發現：

- 10 篇文章中只有 1 篇有連結
- 連結存在於 `external_references` 但未被插入到 `html_content`

### 根因分析

`ResearchAgent` 生成的 `externalReferences` 品質不穩定：

| 文章            | external_references.title  | 連結插入結果 |
| --------------- | -------------------------- | ------------ |
| ✅ 1440精選圖片 | `"測試1440精選圖片重複"`   | 3 個連結     |
| ❌ 測試1811     | `"Head116"`, `"114%E5..."` | 0 個連結     |

**問題**：當 `title` 只是 URL 路徑片段（如 `Head116`）時，`LinkProcessorAgent` 無法在文章內容中找到匹配的關鍵字來插入連結。

### 解決方案

在 `LinkProcessorAgent` 中加入 **主關鍵字 fallback 機制**：

```typescript
// link-processor-agent.ts
interface LinkProcessorInput {
  // ...
  primaryKeyword?: string; // 新增：文章主關鍵字
}

// extractKeywordsFromReference() 優先使用主關鍵字
if (primaryKeyword && primaryKeyword.length >= 2) {
  keywords.push(primaryKeyword);
}
```

### 修改檔案

| 檔案                                     | 修改內容                                   |
| ---------------------------------------- | ------------------------------------------ |
| `src/lib/agents/link-processor-agent.ts` | 新增 `primaryKeyword` 參數和 fallback 邏輯 |
| `src/lib/agents/orchestrator.ts`         | 傳入 `primaryKeyword: input.title`         |

### 預期效果

即使 `external_references.title` 是無意義的 URL 片段，也能使用文章的主關鍵字（如「測試1811」）作為錨點文字插入連結。

---

## 2025-12-04: 文章生成系統穩定運行確認

### 狀態

經測試確認，文章生成系統各項功能均正常運行：

- ✅ **HTML 輸出**：無殘留 Markdown 語法
- ✅ **Markdown 轉換**：正確轉為 HTML
- ✅ **JSON 解析**：AI 輸出正確解析，無截斷問題
- ✅ **段落生成**：Section agents 正常輸出完整內容
- ✅ **圖片生成**：精選圖片與內文圖片正常產出
- ✅ **FAQ 生成**：數量控制在 3-5 個，token 限制適當

### 最近修正

| Commit    | 修改內容                                                      |
| --------- | ------------------------------------------------------------- |
| `be19f7b` | FAQ token 限制與數量控制（移除 maxTokens: 1000，統一 3-5 個） |
| `8cd6064` | HTML 中殘留 Markdown 語法問題                                 |
| `7239ec4` | website_configs UUID 驗證                                     |

---

## 2025-12-04: 修復 HTML 中殘留 Markdown 語法問題

### 問題描述

文章生成後的 HTML 中仍然殘留 Markdown 語法（如 `**粗體**`、`## 標題`），導致前端顯示異常。

### 根因分析

**兩個獨立問題**：

1. **JSON 截斷**：Section agents 的 `maxTokens` 設定過低（400 字段落只有 800 tokens），導致 AI 輸出被截斷（`finish_reason=length`），JSON 解析失敗，原始 markdown 直接流入後續處理。

2. **Markdown 清理不完整**：`marked.js` 有時會遺漏嵌套在 HTML 區塊內的 markdown（[by design](https://github.com/markedjs/marked/issues/488)），特別是 `<p>## 標題</p>` 這類情況。

### 解決方案（三層防線架構）

```
Layer 1: PREVENTION（預防）
├── 提高 token 限制：maxTokens = max(wordCount * 3, 2000)
└── 自動重試截斷輸出：檢測 finish_reason=length 時增加 50% token 重試

Layer 2: REPAIR（修復）
├── 使用 jsonrepair 修復截斷/格式錯誤的 JSON
└── Fallback regex 提取 content 欄位

Layer 3: CLEANUP（清理）
├── OutputAdapter：先清理再驗證，只對嚴重問題觸發重新轉換
└── ArticleStorage：最終防線，處理 <p> 內的 markdown 標題
```

### 修改檔案

| 檔案                                  | 修改內容                                          |
| ------------------------------------- | ------------------------------------------------- |
| `package.json`                        | 新增 `jsonrepair` 依賴                            |
| `src/lib/agents/orchestrator.ts`      | 提高 Section agent token 限制                     |
| `src/lib/agents/section-agent.ts`     | 使用 jsonrepair 修復 JSON                         |
| `src/lib/agents/output-adapter.ts`    | 新增 `hasSeriousMarkdownIssues()`、增強清理函數   |
| `src/lib/ai/ai-client.ts`             | 新增截斷自動重試機制                              |
| `src/lib/services/article-storage.ts` | 增強 `isValidHTML()` 和 `cleanMarkdownFromHtml()` |

### 參考資料

- [jsonrepair (npm)](https://github.com/josdejong/jsonrepair) - LLM JSON 修復套件
- [DeepSeek JSON Output Docs](https://api-docs.deepseek.com/guides/json_mode) - 官方建議設定足夠的 max_tokens

---

## 2025-12-04: 修復文章重複執行問題

### 問題描述

文章生成完成後，系統又重新執行一次相同的任務。

### 根因分析

`scripts/process-jobs.ts` 的 job 鎖定機制存在 **Race Condition（競態條件）**：

1. GitHub Actions 每 2 分鐘執行一次 workflow
2. 查詢條件：`started_at.is.null` 或 `started_at.lt.${3分鐘前}`
3. 鎖定邏輯：直接 UPDATE，**沒有檢查 `started_at` 是否仍符合條件**

**問題場景**：

```
T=0:  Workflow A 查詢，找到 Job X（started_at = null）
T=1s: Workflow B 啟動，也找到 Job X（started_at 仍為 null）
T=2s: Workflow A 鎖定 Job X（started_at = T+2s）
T=3s: Workflow B 也鎖定 Job X（覆蓋 started_at）← 重複執行！
```

### 解決方案

使用**樂觀鎖定**：UPDATE 時加入與查詢相同的條件，確保只有第一個 workflow 能鎖定成功。

```typescript
// 修復前：直接更新，沒有條件檢查
.update({ status: "processing", started_at: now })
.eq("id", job.id)

// 修復後：加入樂觀鎖定條件
.update({ status: "processing", started_at: now })
.eq("id", job.id)
.in("status", ["pending", "processing"])
.or(`started_at.is.null,started_at.lt.${threeMinutesAgo}`)
```

### 修改檔案

- `scripts/process-jobs.ts`

---

## 2025-12-04: 修復精選圖片重複插入（Introduction/UnifiedWriting）

### 問題描述

精選圖片在 HTML 中出現兩次。

### 根因分析

圖片在多個地方被插入：

1. **IntroductionAgent** - prompt 指令 + 後處理插入
2. **UnifiedWritingAgent** - prompt 指令 + 後處理插入
3. **orchestrator.ts** 的 `insertImagesToHtml` - 再次插入

### 解決方案

與 SectionAgent 相同，移除 IntroductionAgent 和 UnifiedWritingAgent 的圖片插入邏輯，保留 `insertImagesToHtml` 作為唯一插入點。

### 修改檔案

- `src/lib/agents/introduction-agent.ts`
- `src/lib/agents/unified-writing-agent.ts`

---

## 2025-12-04: 修復外部連結關鍵字提取問題

### 問題描述

LinkProcessorAgent 拒絕插入外部連結，因為提取到的關鍵字是 "H3"、"https" 等無效詞彙。

### 根因分析

1. `research-agent.ts` 的 `extractTitleFromUrl()` 從 URL 路徑提取標題
2. URL 如 `/blog/h3-styling` 會提取出 "H3 Styling" 作為標題
3. 這些無效標題被用於關鍵字比對，導致語義相似度過低被拒絕

### 解決方案

1. 新增 `extractTitleFromContent()` 從 Perplexity 內容中提取真實標題
2. 新增 `isInvalidTitle()` 過濾無效標題
3. 在 `link-processor-agent.ts` 新增技術詞彙黑名單

### 修改檔案

- `src/lib/agents/research-agent.ts`
- `src/lib/agents/link-processor-agent.ts`

---

## 2025-12-04: 修復圖片重複插入 Bug

### 問題描述

前端 HTML 中出現 8 張圖片，但實際只生成 4 張。每張圖片都被重複插入了 2 次。

### 根因分析

圖片在兩個地方被插入：

1. **SectionAgent** (section-agent.ts) - 在生成 markdown 時透過 prompt 和後處理插入圖片
2. **orchestrator.ts** 的 `insertImagesToHtml` - 再次將圖片插入到 HTML

### 解決方案

**刪除 SectionAgent 的圖片插入邏輯**，保留 `insertImagesToHtml` 作為唯一的圖片插入點。

理由：

- `insertImagesToHtml` 有更智能的分配邏輯（根據 H2/H3 位置分配）
- 單一責任原則：圖片插入只在一個地方處理
- 更簡單 = 更穩定

### 修改內容

**section-agent.ts**：

- 移除 prompt 中的圖片插入指令
- 移除後處理的圖片插入邏輯

**orchestrator.ts**：

- 移除先前加入的重複檢查邏輯（因為 SectionAgent 不再插入圖片，檢查不需要了）

### 修改檔案

- `src/lib/agents/section-agent.ts`
- `src/lib/agents/orchestrator.ts`

---

## 2025-12-04: 5 層 AI Provider Fallback 機制

### 問題描述

DeepSeek API 在半夜時段不穩定，導致文章生成失敗。

### 解決方案

將 3 層 Fallback 擴展為 5 層，新增 OpenAI 作為最後防線：

```
Step 1: Gateway DeepSeek     ← 主要（成本最低）
Step 2: Gateway OpenRouter   ← DeepSeek v3.2 via OpenRouter
Step 3: 直連 DeepSeek        ← 繞過 Gateway
Step 4: Gateway OpenAI       ← GPT-5/GPT-5-mini（新增）
Step 5: 直連 OpenAI          ← 最後防線（新增）
```

### 模型映射

| DeepSeek 模型       | OpenAI Fallback |
| ------------------- | --------------- |
| `deepseek-chat`     | `gpt-5-mini`    |
| `deepseek-reasoner` | `gpt-5`         |

### 修改內容

- 新增 `callOpenAIAPI()` 方法
- 在 `callDeepSeekAPI()` 新增 Step 4-5

**Commit**: `7d2a1aa`

**修改檔案**：

- `src/lib/ai/ai-client.ts`

---

## 2025-12-04: 修復 DeepSeek JSON 截斷問題

### 問題描述

文章生成失敗，錯誤訊息：

```
Unexpected end of JSON input
```

### 根本原因

1. **maxTokens 預設值過小**：預設 2000 tokens 不足以完成複雜 JSON 輸出（如 ContentPlanAgent）
2. **缺乏截斷偵測**：DeepSeek 在 token 限制時會設 `finish_reason="length"`，但程式未檢查
3. **錯誤處理不完善**：直接使用 `response.json()` 解析，失敗時無法看到原始響應內容

### 修復內容

| 修改                  | 描述                                               |
| --------------------- | -------------------------------------------------- |
| maxTokens 2000 → 8000 | 足夠大部分 JSON 輸出                               |
| 安全 JSON 解析        | 先 `text()` 再 `JSON.parse()`，失敗時輸出前 500 字 |
| finish_reason 檢查    | 如果是 `"length"` 輸出警告                         |
| Prompt 優化           | 4 個 agent 加入「請確保輸出完整的 JSON」提示       |
| 類型補全              | DeepSeekResponse 加入 `finish_reason` 欄位         |

**Commit**: `43c7fb3`

**修改檔案**：

- `src/lib/ai/ai-client.ts`
- `src/lib/agents/category-agent.ts`
- `src/lib/agents/meta-agent.ts`
- `src/lib/agents/content-plan-agent.ts`
- `src/lib/agents/unified-strategy-agent.ts`

### 參考資料

- [DeepSeek JSON 模式文檔](https://api-docs.deepseek.com/zh-cn/guides/json_mode)

---

## 2025-12-04: Cloudflare AI Gateway Error 2005 調查與修復嘗試

### 問題描述

文章生成持續失敗，錯誤訊息：

```
Error 2005: "Failed to get response from provider"
```

### 調查過程

#### 1. 時間線分析

通過資料庫查詢，發現錯誤時間線：

| 時間 (UTC) | 狀態    | 錯誤類型      | Commit  |
| ---------- | ------- | ------------- | ------- |
| 10:00      | ✅ 成功 | -             | 2b88462 |
| 12:00      | ❌ 失敗 | HTML 錯誤頁面 | 2b88462 |
| 14:11+     | ❌ 失敗 | Error 2005    | -       |
| 17:54+     | ❌ 失敗 | Error 2005    | 67d776c |

**關鍵發現**：12:00 UTC 的失敗使用的是同一個 commit `2b88462`（與 10:00 成功的相同），說明問題不完全是程式碼導致。

#### 2. 錯誤類型統計

- **Error 2005**: Gateway 無法從 provider 取得回應
- **Error 2014**: Provider 請求超時
- **HTML 錯誤頁面**: Cloudflare 錯誤頁面（<!DOCTYPE）
- **terminated**: 連接中斷
- **Unexpected end of JSON**: JSON 被截斷

### 修復嘗試

#### 嘗試 1: 回滾 BYOK Header 模式 ❌

**假設**：commit `67d776c` 改為純 BYOK 模式（只傳 `cf-aig-authorization`）導致問題

**修改**：回滾到雙 Header 模式（同時傳 `Authorization` + `cf-aig-authorization`）

**結果**：失敗，錯誤持續

**Commit**: `d4c9fa8`

#### 嘗試 2: 修復 URL 路徑 ❌

**假設**：對比 Cloudflare 官方文檔，發現 URL 路徑問題

|      | 官方文檔                        | 我們的程式碼                       |
| ---- | ------------------------------- | ---------------------------------- |
| URL  | `.../deepseek/chat/completions` | `.../deepseek/v1/chat/completions` |
| 差異 | ✅ 正確                         | ❌ 多了 `/v1`                      |

**修改**：

- ai-client.ts: 根據 Gateway 模式選擇 endpoint
- deepseek/client.ts: 在 makeRequest 中移除多餘的 `/v1`
- category-agent.ts: 根據 Gateway 模式選擇 endpoint

```typescript
const endpoint = isGatewayEnabled()
  ? `${baseUrl}/chat/completions` // Gateway 模式
  : `${baseUrl}/v1/chat/completions`; // 直連模式
```

**結果**：失敗，錯誤持續

**Commit**: `6c5c544`

### 待進一步調查

1. **Cloudflare Dashboard 設定**
   - 確認 Provider Keys 是否正確設定 DeepSeek API Key
   - 確認 Gateway Authentication 設定
   - 檢查 Gateway 日誌

2. **DeepSeek API 穩定性**
   - 同一程式碼有時成功有時失敗，可能是 DeepSeek API 不穩定
   - 考慮加入 Provider Fallback（DeepSeek → Gemini → OpenAI）

3. **繞過 Gateway 測試**
   - 設定 `CF_AI_GATEWAY_ENABLED=false` 直連 DeepSeek
   - 如果直連成功，問題在 Gateway 設定

4. **改用 OpenRouter**
   - OpenRouter 本身是 AI API 聚合器，有內建 fallback
   - 已有 OpenRouter client 可直接使用

### 參考資料

- [Cloudflare DeepSeek Provider 文檔](https://developers.cloudflare.com/ai-gateway/usage/providers/deepseek/)
- [Cloudflare BYOK 文檔](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)
- [Cloudflare Gateway Authentication](https://developers.cloudflare.com/ai-gateway/configuration/authentication/)

### 相關 Commits

| Commit    | 描述                                       | 結果    |
| --------- | ------------------------------------------ | ------- |
| `67d776c` | 修復: BYOK 模式（純 cf-aig-authorization） | ❌ 失敗 |
| `d4c9fa8` | 回滾: 恢復雙 Header 模式                   | ❌ 失敗 |
| `6c5c544` | 修復: Gateway URL 路徑問題                 | ❌ 失敗 |

#### 嘗試 3: Gateway 自動 Fallback 到直連 🔄

**假設**：Error 2005 可能是 Cloudflare AI Gateway 與 DeepSeek 之間的連線問題，而非我們程式碼的問題

**分析**：

- Perplexity API 通過同樣的 Gateway 可以正常運作
- DeepSeek API 通過 Gateway 持續失敗
- 可能是 Gateway 的 DeepSeek Provider 設定問題

**修改**：加入自動 fallback 機制

- 當 Gateway 返回 Error 2005 時，自動切換到直連 DeepSeek API
- 這樣可以：
  1. 確保服務不中斷
  2. 診斷問題是否在 Gateway

**修改檔案**：

- `src/lib/ai/ai-client.ts`: 加入 `callDeepSeekAPIInternal` 支援 Gateway/直連切換
- `src/lib/deepseek/client.ts`: 加入 `makeRequestInternal` 支援 fallback
- `src/lib/agents/category-agent.ts`: 加入 `callDeepSeekAPIInternal` 支援 fallback

**關鍵程式碼**：

```typescript
// 先嘗試 Gateway 模式
if (useGateway) {
  try {
    return await this.callDeepSeekAPIInternal(params, apiKey, true);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    // 如果是 Error 2005，嘗試直連
    if (
      err.message.includes("2005") ||
      err.message.includes("Failed to get response from provider")
    ) {
      console.log(
        "[AIClient] ⚠️ Gateway Error 2005, 自動切換到直連 DeepSeek API...",
      );
      return await this.callDeepSeekAPIInternal(params, apiKey, false);
    }
    throw error;
  }
}
```

**預期結果**：

- 如果日誌顯示「✅ 直連 DeepSeek API 成功」→ 問題在 Gateway 設定
- 如果直連也失敗 → 問題在 DeepSeek API 本身

#### 嘗試 4: 完整多層 Fallback 機制 🔄

**目標**：確保服務穩定性，即使單一 Provider 失敗也能繼續運作

**Fallback 鏈**：

```
Step 1: Gateway DeepSeek (deepseek-reasoner/chat)
   ↓ 失敗
Step 2: Gateway OpenRouter (deepseek/deepseek-v3.2)
   ↓ 失敗
Step 3: 直連 DeepSeek API
   ↓ 失敗
Step 4: OpenAI (gpt-5 或 gpt-5-mini)
```

**修改檔案**：

- `src/lib/ai/ai-client.ts`: 完整重寫 `callDeepSeekAPI`，加入 4 層 fallback

**日誌輸出範例**：

```
[AIClient] 🔄 Step 1: Gateway DeepSeek (deepseek-reasoner)
[AIClient] ⚠️ Step 1 失敗: Error 2005
[AIClient] 🔄 Step 2: Gateway OpenRouter (deepseek/deepseek-v3.2)
[AIClient] ✅ Step 2 成功: Gateway OpenRouter (deepseek/deepseek-v3.2)
```

**環境變數要求**：

- `DEEPSEEK_API_KEY`: DeepSeek API 金鑰
- `OPENROUTER_API_KEY`: OpenRouter API 金鑰
- `OPENAI_API_KEY`: OpenAI API 金鑰（最後備援）

---
