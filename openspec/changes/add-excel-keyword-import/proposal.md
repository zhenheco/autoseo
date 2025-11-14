# Excel 自動化文章批次匯入系統

**Change ID**: `add-excel-keyword-import`
**Status**: 提案中（已更新）
**Created**: 2025-11-14
**Updated**: 2025-11-14
**Owner**: User Request

## 概述

實作 Excel 檔案批次匯入功能，允許使用者上傳包含關鍵字、網站、文章類型和發佈時間的 Excel 檔案，系統自動生成文章並按排程發佈到指定網站。

## 目標

1. 提供 Excel 檔案上傳介面（支援多欄位格式）
2. 解析 Excel 檔案中的完整發佈計畫（關鍵字、網站、類型、時間）
3. 自動生成文章標題（無需使用者選擇）
4. 智慧判斷文章類型（教學、排行榜、比較、資訊型等）
5. 支援排程發佈（固定間隔或指定時間）
6. 整合現有的 multi-agent 文章生成工作流程

## 範圍

### 納入範圍

- Excel 檔案上傳與多欄位解析（關鍵字、網站、類型、時間）
- 自動標題生成（AI 生成最佳標題）
- 文章類型智慧判斷（混合模式：Excel 優先，未填則 AI 判斷）
- 排程發佈系統（固定間隔或指定時間）
- 發佈狀態追蹤與網址顯示
- 與現有 article_jobs 表整合

### 不納入範圍

- Excel 範本匯出功能（第二階段）
- 歷史匯入記錄查詢（第二階段）
- 進階關鍵字分析和 SEO 建議（第二階段）
- 取消已排程文章（第二階段）

## 技術架構

### Excel 檔案格式

| 欄位 | 必填 | 說明 | 範例 |
|------|------|------|------|
| 關鍵字 | ✓ | 文章主題關鍵字 | `Next.js 教學` |
| 網站名稱 | ✓ | 發佈目標網站 | `技術部落格` |
| 文章類型 | ✗ | 教學/排行榜/比較/資訊型 | `教學` |
| 發佈時間 | ✗ | ISO 8601 格式 | `2025-11-15 10:00` |

### 前端
- 新增 `/dashboard/articles/import` 頁面
- 使用 `xlsx` 套件解析多欄位 Excel
- 使用 Tanstack Table 顯示發佈計畫列表
- 實作排程設定介面（固定間隔）

### 後端
- 新增 `/api/articles/import-batch` endpoint（整合所有邏輯）
- 新增 `/api/articles/determine-type` endpoint（AI 判斷文章類型）
- 複用現有的 `/api/articles/generate` endpoint（處理單個文章）
- 實作排程邏輯（Cron Job 或 Scheduled Jobs）

### 資料庫
- 複用 `article_jobs` 表
- 新增欄位：
  - `article_type`: 文章類型（教學、排行榜等）
  - `scheduled_publish_at`: 預定發佈時間
  - `published_url`: WordPress 發佈網址
- 使用 `metadata` 欄位儲存匯入來源和排程資訊

## 相依性

- 現有的文章生成工作流程（`refactor-multi-agent-article-generation`）
- 現有的 Token 計費系統（`implement-idempotent-token-billing`）
- 現有的批次處理邏輯（`/api/articles/generate-batch`）

## 風險與考量

1. **檔案大小限制**: Excel 檔案過大可能導致記憶體問題
   - 緩解：限制最大 500 個關鍵字（考慮排程發佈）
2. **標題生成成本**: 批次生成標題會消耗大量 AI tokens
   - 緩解：每個關鍵字僅生成 1 個最佳標題，減少成本
3. **排程系統複雜度**: 需要處理時區、延遲發佈、失敗重試
   - 緩解：使用現有的 GitHub Actions Cron Job 架構
4. **網站名稱對應**: Excel 中的網站名稱需對應到實際的 website_id
   - 緩解：提供網站名稱驗證和對應邏輯，顯示無效網站警告
5. **發佈失敗處理**: WordPress 發佈可能失敗
   - 緩解：實作重試機制，記錄失敗原因

## 成功指標

- 使用者可以成功上傳多欄位 Excel 檔案
- 系統能正確解析至少 95% 的有效行（關鍵字+網站）
- 網站名稱能正確對應到 website_id（90% 準確率）
- 每個關鍵字能自動生成 1 個高品質標題
- AI 能正確判斷文章類型（80% 準確率）
- 排程系統能按時發佈文章（95% 準確率）
- 發佈成功後能正確顯示 WordPress 網址
- 整合現有工作流程無縫運作
