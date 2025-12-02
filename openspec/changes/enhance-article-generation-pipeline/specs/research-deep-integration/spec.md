# Spec: research-deep-integration

## Overview

增強 ResearchAgent 使用 Perplexity 進行三種深度研究查詢，獲取最新趨勢、用戶問題、權威數據。

## ADDED Requirements

### Requirement: RESEARCH-DEEP-001 - Perplexity 趨勢查詢

ResearchAgent MUST use Perplexity to query the latest trends and expert insights for the target keyword.

#### Scenario: 成功獲取趨勢資料

**Given** 用戶輸入關鍵字 "畢業典禮錄影" 和地區 "Taiwan"
**When** ResearchAgent 執行 performDeepResearch 方法
**Then** 系統向 Perplexity 發送查詢 "畢業典禮錄影 Taiwan 2024 2025 最新趨勢 專家見解"
**And** 結果儲存在 deepResearch.trends 中
**And** trends.content 包含 Perplexity 回應內容
**And** trends.citations 包含引用來源 URL 陣列

#### Scenario: Perplexity 查詢失敗

**Given** Perplexity API 無法連接或返回錯誤
**When** ResearchAgent 執行趨勢查詢
**Then** 系統記錄警告日誌
**And** deepResearch 設為 null
**And** 文章生成流程繼續執行（不中斷）

### Requirement: RESEARCH-DEEP-002 - Perplexity 用戶問題查詢

ResearchAgent MUST use Perplexity to query common user questions and solutions.

#### Scenario: 成功獲取用戶問題資料

**Given** 用戶輸入關鍵字 "畢業典禮錄影"
**When** ResearchAgent 執行 performDeepResearch 方法
**Then** 系統向 Perplexity 發送查詢 "畢業典禮錄影 常見問題 解決方案 FAQ 用戶體驗"
**And** 結果儲存在 deepResearch.userQuestions 中

### Requirement: RESEARCH-DEEP-003 - Perplexity 權威數據查詢

ResearchAgent MUST use Perplexity to query official sources and authoritative statistics.

#### Scenario: 成功獲取權威數據

**Given** 用戶輸入關鍵字 "畢業典禮錄影" 和地區 "Taiwan"
**When** ResearchAgent 執行 performDeepResearch 方法
**Then** 系統向 Perplexity 發送查詢 "畢業典禮錄影 Taiwan 官方來源 權威數據 統計資料"
**And** 結果儲存在 deepResearch.authorityData 中

### Requirement: RESEARCH-DEEP-004 - 並行執行 Perplexity 查詢

The three Perplexity queries MUST be executed in parallel to optimize performance.

#### Scenario: 並行執行三個查詢

**Given** ResearchAgent 需要執行三種深度研究查詢
**When** performDeepResearch 方法被調用
**Then** 系統使用 Promise.all 並行執行三個查詢
**And** 總執行時間約等於最慢查詢的時間（而非三個查詢時間之和）

## MODIFIED Requirements

### Requirement: RESEARCH-OUTPUT-001 - 擴展 ResearchOutput 類型

ResearchOutput MUST include an optional deepResearch field.

#### Scenario: 包含 deepResearch 的輸出

**Given** Perplexity 深度研究成功完成
**When** ResearchAgent.process() 返回結果
**Then** ResearchOutput 包含 deepResearch 欄位
**And** deepResearch 包含 trends、userQuestions、authorityData 三個子物件

#### Scenario: 不包含 deepResearch 的輸出

**Given** Perplexity 深度研究失敗或被跳過
**When** ResearchAgent.process() 返回結果
**Then** ResearchOutput.deepResearch 為 undefined
**And** 其他現有欄位正常返回

## Related Capabilities

- `content-plan-agent`: ContentPlanAgent 使用 deepResearch 資料生成寫作計劃
