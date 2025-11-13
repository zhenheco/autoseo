# 文章任務批次刪除規範

## 範圍

定義文章管理介面中批次刪除功能的正確行為，確保能夠正確清除所有非完成狀態的任務。

## MODIFIED Requirements

### Requirement: 批次刪除 API 正確性驗證

API **MUST** 在刪除前後進行驗證，確保操作的正確性。

#### Scenario: 刪除前查詢並記錄任務

**Given** 使用者已通過認證且屬於某個公司
**When** 呼叫 `/api/articles/jobs/clear` 端點
**Then** 系統應：
1. 先查詢所有符合條件的任務（`status != 'completed'`）
2. 記錄查詢到的任務數量和狀態到 console
3. 執行刪除操作
4. 記錄實際刪除的任務數量
5. 比較兩者是否一致，不一致時記錄警告

#### Scenario: 刪除數量為 0 時的診斷訊息

**Given** 使用者觸發批次刪除
**When** 資料庫中沒有符合條件的任務（`deletedCount === 0`）
**Then** API 應回傳：
```json
{
  "success": true,
  "deletedCount": 0,
  "message": "沒有找到需要清除的任務",
  "diagnostic": {
    "totalJobs": 0,
    "queryConditions": "status != 'completed' AND company_id = 'xxx'"
  }
}
```

#### Scenario: 刪除成功時的詳細回應

**Given** 資料庫中有 3 個 pending 任務
**When** 執行批次刪除
**Then** API 應回傳：
```json
{
  "success": true,
  "deletedCount": 3,
  "message": "已清除 3 個任務",
  "deletedJobs": [
    {"id": "xxx-1", "status": "pending"},
    {"id": "xxx-2", "status": "pending"},
    {"id": "xxx-3", "status": "processing"}
  ]
}
```

### Requirement: 前端批次刪除確認訊息準確性

前端 **MUST** 顯示準確的待刪除任務數量。

#### Scenario: 確認對話框顯示正確數量

**Given** 介面上顯示 5 個 pending 任務
**When** 使用者點擊「清除進行中的任務」按鈕
**Then** 確認對話框應顯示：「確定要清除 5 個進行中的任務嗎？」

#### Scenario: 刪除成功後的訊息

**Given** 批次刪除成功清除 5 個任務
**When** API 回傳成功
**Then** 應顯示 alert：「已清除 5 個任務」

#### Scenario: 刪除數量為 0 時的訊息

**Given** 批次刪除執行但沒有任務被清除
**When** API 回傳 `deletedCount: 0`
**Then** 應顯示 alert：「沒有找到需要清除的任務」

### Requirement: 資料重新載入時機

刪除操作後 **MUST** 立即重新載入資料，確保介面更新。

#### Scenario: 刪除成功後自動重新整理

**Given** 批次刪除成功
**When** 收到 API 成功回應
**Then** 系統應：
1. 呼叫 `fetchData()` 重新載入任務和文章列表
2. 更新 `jobs` 和 `articles` state
3. 移除介面上所有已刪除的任務項目

#### Scenario: 刪除失敗時不重新整理

**Given** 批次刪除失敗（API 回傳錯誤）
**When** 收到錯誤回應
**Then** 系統應：
1. 顯示錯誤訊息
2. 不重新載入資料
3. 保持目前介面狀態

### Requirement: 錯誤處理增強

**MUST** 提供詳細的錯誤訊息幫助診斷問題。

#### Scenario: 認證失敗

**Given** 使用者未登入
**When** 呼叫批次刪除 API
**Then** 應回傳：
```json
{
  "error": "未授權：請先登入",
  "code": "UNAUTHORIZED"
}
```

#### Scenario: 無公司成員資格

**Given** 使用者沒有任何公司的 active 成員資格
**When** 呼叫批次刪除 API
**Then** 應回傳：
```json
{
  "error": "沒有有效的公司成員資格",
  "code": "NO_MEMBERSHIP"
}
```

#### Scenario: 資料庫操作失敗

**Given** 資料庫連線失敗或查詢錯誤
**When** 執行刪除操作
**Then** 應回傳：
```json
{
  "error": "刪除任務失敗",
  "code": "DELETE_FAILED",
  "details": "資料庫錯誤訊息"
}
```

### Requirement: Console 日誌記錄

所有關鍵操作 **MUST** 記錄到 console，方便除錯。

#### Scenario: 記錄刪除操作的完整流程

**Given** 使用者觸發批次刪除
**When** API 執行刪除流程
**Then** 應記錄以下訊息：
```
[Clear Jobs] User: {user_id}
[Clear Jobs] Company ID: {company_id}
[Clear Jobs] Found jobs to delete: {count}
[Clear Jobs] Job statuses: [{id, status}, ...]
[Clear Jobs] Successfully deleted: {deletedCount}
```

#### Scenario: 記錄前端操作

**Given** 使用者在前端執行批次刪除
**When** 各步驟執行
**Then** 應記錄：
```
[ArticlesPage] Clearing jobs, current count: {jobs.length}
[ArticlesPage] Clear response status: {status}
[ArticlesPage] Clear response: {data}
[ArticlesPage] After refresh, jobs count: {newJobsLength}
```
