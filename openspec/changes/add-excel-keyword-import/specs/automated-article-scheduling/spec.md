# 自動化文章生成與排程發佈

**Capability**: `automated-article-scheduling`
**Version**: 1.0.0
**Status**: 提案中

## 概述

為批次匯入的發佈計畫自動生成文章標題、判斷文章類型、設定排程，並追蹤發佈狀態和網址。

---

## ADDED Requirements

### Requirement: 自動標題生成

系統 MUST 為每個關鍵字自動生成一個高品質的文章標題，無需使用者選擇。

#### Scenario: 自動生成單個最佳標題

**Given** 使用者匯入關鍵字「Next.js 教學」
**When** 系統處理該關鍵字
**Then** 系統使用 AI 生成一個帶數字的吸引人標題
**And** 標題符合格式要求（例如：「5個 Next.js 教學技巧讓你快速上手」）
**And** 系統自動儲存該標題，無需使用者確認

#### Scenario: 根據文章類型生成標題

**Given** 使用者匯入關鍵字「手機推薦」
**And** 文章類型為「排行榜」
**When** 系統生成標題
**Then** 系統生成符合排行榜格式的標題（例如：「2025年10款最佳手機推薦排行榜」）
**And** 標題自動包含年份和排行榜關鍵字

#### Scenario: 標題生成失敗重試

**Given** 系統首次生成標題失敗（API 錯誤）
**When** 系統偵測到失敗
**Then** 系統等待 3 秒後自動重試
**And** 最多重試 3 次
**And** 若仍失敗則使用關鍵字作為標題
**And** 系統記錄錯誤日誌

---

### Requirement: 智慧文章類型判斷

系統 MUST 能夠智慧判斷文章類型（混合模式：Excel 優先，未填則 AI 判斷）。

**支援的文章類型**:

- 教學（How-to / Tutorial）
- 排行榜（Listicle / Ranking）
- 比較（Comparison / VS）
- 資訊型（Informational）

#### Scenario: 使用 Excel 指定的文章類型

**Given** Excel 中文章類型欄位填寫「教學」
**When** 系統處理該計畫
**Then** 系統直接使用「教學」類型
**And** 系統跳過 AI 判斷步驟

#### Scenario: AI 自動判斷文章類型

**Given** Excel 中文章類型欄位為空白
**And** 關鍵字為「如何學習 React」
**When** 系統處理該計畫
**Then** 系統使用 AI 分析關鍵字
**And** AI 判斷為「教學」類型
**And** 系統儲存判斷結果到 `article_type` 欄位

#### Scenario: AI 判斷排行榜類型

**Given** 關鍵字為「最好的 VSCode 插件」
**When** AI 分析關鍵字
**Then** AI 判斷為「排行榜」類型
**And** 系統調整寫作策略以符合排行榜格式

#### Scenario: AI 判斷比較類型

**Given** 關鍵字為「React vs Vue」
**When** AI 分析關鍵字
**Then** AI 判斷為「比較」類型
**And** 系統調整寫作策略以符合比較格式

---

### Requirement: 排程設定與管理

系統 MUST 支援兩種排程模式：指定時間發佈和固定間隔發佈。

#### Scenario: 使用 Excel 指定的發佈時間

**Given** Excel 中發佈時間為「2025-11-15 10:00」
**When** 系統處理該計畫
**Then** 系統將 `scheduled_publish_at` 設為該時間
**And** 系統在該時間觸發文章生成和發佈

#### Scenario: 設定固定間隔發佈（全域設定）

**Given** 使用者設定「每 2 小時發佈一篇」
**And** Excel 中有 10 個計畫未指定發佈時間
**When** 系統處理這些計畫
**Then** 系統計算發佈時間：

- 第 1 篇：當前時間
- 第 2 篇：當前時間 + 2 小時
- 第 3 篇：當前時間 + 4 小時
- ...
  **And** 系統為每個計畫設定 `scheduled_publish_at`

#### Scenario: 混合排程模式

**Given** Excel 中有 5 個計畫指定時間，5 個未指定
**And** 使用者設定「每 3 小時發佈一篇」
**When** 系統處理所有計畫
**Then** 系統保留已指定時間的計畫不變
**And** 系統為未指定時間的計畫按間隔排程
**And** 系統確保不會有時間衝突（同一時間發佈多篇）

#### Scenario: 排程時間衝突處理

**Given** 兩個計畫的發佈時間都是「2025-11-15 10:00」
**When** 系統偵測到衝突
**Then** 系統將第二個計畫延後 30 分鐘
**And** 系統顯示警告訊息給使用者

---

### Requirement: 發佈狀態追蹤

系統 MUST 提供即時的發佈狀態追蹤，並在發佈後更新 WordPress 網址。

**狀態流程**:

1. `pending`: 待處理（排程中）
2. `generating`: 生成中（AI 正在寫文章）
3. `completed`: 已完成（文章生成完畢）
4. `publishing`: 發佈中（正在發佈到 WordPress）
5. `published`: 已發佈（發佈成功）
6. `failed`: 失敗

#### Scenario: 即時狀態更新

**Given** 使用者在發佈計畫列表頁面
**And** 某個計畫正在生成中
**When** 系統更新狀態為「generating」
**Then** 列表中該計畫的狀態欄位即時更新
**And** 系統顯示進度指示器

#### Scenario: 發佈成功後更新網址

**Given** 文章成功發佈到 WordPress
**And** WordPress 回傳文章網址 `https://blog.example.com/article-123`
**When** 系統接收到回應
**Then** 系統更新 `published_url` 欄位為該網址
**And** 系統更新狀態為「published」
**And** 列表中顯示可點擊的網址連結

#### Scenario: 發佈失敗處理

**Given** 文章生成完成
**When** 發佈到 WordPress 時發生錯誤（例如：API 錯誤、認證失敗）
**Then** 系統更新狀態為「failed」
**And** 系統記錄失敗原因到 `metadata.error`
**And** 系統在列表中顯示錯誤圖示和訊息
**And** 使用者可點擊「重試」按鈕

#### Scenario: 手動重試發佈

**Given** 某個計畫狀態為「failed」
**When** 使用者點擊「重試」按鈕
**Then** 系統重新執行發佈流程
**And** 系統更新狀態為「publishing」
**And** 若成功則更新為「published」並顯示網址

---

### Requirement: 批次任務建立與執行

系統 MUST 將發佈計畫批次建立為 article_jobs，並按排程自動執行。

#### Scenario: 批次建立任務成功

**Given** 使用者確認 20 個發佈計畫
**When** 使用者點擊「開始執行」
**Then** 系統在 `article_jobs` 表中建立 20 筆記錄
**And** 每筆記錄包含：

- `keywords`: 關鍵字
- `website_id`: 對應的網站 ID
- `status`: 'pending'
- `scheduled_publish_at`: 計算的發佈時間
- `metadata`: { `article_type`, `title`, `importSource`: 'excel' }
  **And** 系統顯示成功訊息

#### Scenario: 到達排程時間自動執行

**Given** 某個任務的 `scheduled_publish_at` 為「2025-11-15 10:00」
**And** 當前時間為「2025-11-15 10:00」
**When** Cron Job 執行
**Then** 系統取出該任務
**And** 系統呼叫現有的文章生成 API
**And** 系統傳遞 `article_type` 和預生成的 `title`
**And** 文章生成完成後自動發佈到 WordPress

#### Scenario: 處理大量任務時的並發控制

**Given** 有 100 個任務需要處理
**When** Cron Job 執行
**Then** 系統一次最多處理 5 個任務
**And** 系統使用佇列機制確保順序
**And** 避免超過 API rate limit

---

## MODIFIED Requirements

### 資料庫擴充

本功能需要擴充 `article_jobs` 表：

**新增欄位**:

```sql
ALTER TABLE article_jobs
ADD COLUMN article_type TEXT CHECK (article_type IN ('教學', '排行榜', '比較', '資訊型')),
ADD COLUMN scheduled_publish_at TIMESTAMPTZ,
ADD COLUMN published_url TEXT;
```

**metadata 欄位新增內容**:

```json
{
  "importSource": "excel",
  "title": "預生成的標題",
  "original_keyword": "原始關鍵字",
  "scheduled_interval": "2h",
  "retry_count": 0
}
```

---

## 技術規格

### API 實作

**新增 API 端點**:

- `POST /api/articles/import-batch`: 批次建立任務
- `POST /api/articles/determine-type`: AI 判斷文章類型
- `GET /api/articles/scheduled`: 取得排程列表

### Cron Job 排程

使用現有的 GitHub Actions 或 Vercel Cron：

```yaml
# .github/workflows/process-scheduled-articles.yml
schedule:
  - cron: "*/10 * * * *" # 每 10 分鐘執行一次
```

### 文章類型 Prompt 調整

根據 `article_type` 調整生成策略：

```typescript
const strategyPrompts = {
  教學: "撰寫詳細的步驟教學...",
  排行榜: "撰寫排行榜格式，包含評分和比較...",
  比較: "撰寫深入的功能比較...",
  資訊型: "提供全面的資訊概覽...",
};
```

---

## 相依性

- **複用**: `/api/articles/generate` - 文章生成邏輯
- **複用**: `TokenBillingService` - Token 計費
- **複用**: `orchestrator.ts` - Multi-agent 工作流程
- **新增**: 排程執行器（Cron Job）
- **整合**: WordPress 發佈 API

---

## 測試考量

- 測試標題生成品質（不同類型的關鍵字）
- 測試 AI 文章類型判斷準確率
- 測試排程系統準確性（時間計算）
- 測試發佈狀態追蹤和即時更新
- 測試失敗重試機制
- 整合測試：Excel 上傳 → 排程 → 生成 → 發佈 → 網址顯示
