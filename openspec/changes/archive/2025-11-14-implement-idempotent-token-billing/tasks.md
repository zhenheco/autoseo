# 任務清單：冪等性 Token 計費系統

## ⚠️ 關鍵注意事項（開始前必讀）

### 現有代碼的已知問題（需修復）

1. **src/lib/billing/token-billing-service.ts:112-126** - 扣款順序錯誤
   - ❌ 現狀：優先扣購買的 Token
   - ✅ 應該：優先扣月配額（會過期），再扣購買的 Token（永久有效）

2. **src/lib/billing/token-billing-service.ts:57-196** - 無冪等性保護
   - ❌ 現狀：每次調用都扣款，網路重試會重複扣款
   - ✅ 應該：使用 idempotency_key 去重

3. **src/lib/billing/token-billing-service.ts:112-175** - 非原子性操作
   - ❌ 現狀：4 個獨立的資料庫操作，可能部分成功
   - ✅ 應該：使用 PostgreSQL 儲存程序，單一事務

4. **src/lib/billing/token-billing-service.ts:93-98** - 無併發控制
   - ❌ 現狀：沒有使用 FOR UPDATE 鎖定
   - ✅ 應該：FOR UPDATE 防止 race condition

### 參考最佳實踐

- **Stripe 模式**：idempotency key + 24 小時結果快取
- **PostgreSQL 最佳實踐**：儲存程序 + FOR UPDATE + EXCEPTION 處理
- **錯誤分類**：區分暫時性錯誤（可重試）vs 永久性錯誤（不重試）

---

## 階段一：資料庫 Schema【優先級：高】

### 1.1 建立 token_deduction_records 表

- [x] 撰寫 migration SQL（`migrations/YYYYMMDD_create_token_deduction_records.sql`）
- [x] 定義所有欄位和類型（id, idempotency_key, company_id, article_id, amount, status, balance_before, balance_after, error_message, retry_count, created_at, completed_at, metadata）
- [x] 加上 status CHECK 約束（'pending', 'completed', 'failed', 'compensated'）
- [x] 設定 idempotency_key UNIQUE 約束
- [x] 測試 migration 在本地環境執行成功
- [x] **驗收**：`\d token_deduction_records` 顯示正確的 schema

### 1.2 建立索引

- [x] `idx_token_deduction_idempotency` ON (idempotency_key)
- [x] `idx_token_deduction_company` ON (company_id)
- [x] `idx_token_deduction_status` ON (status)
- [x] `idx_token_deduction_created` ON (created_at)
- [x] **驗收**：`\di` 顯示所有索引已建立

### 1.3 建立 deduct_tokens_atomic PostgreSQL 函數

- [x] 撰寫 PostgreSQL 函數（`migrations/YYYYMMDD_deduct_tokens_atomic.sql`）
- [x] 實作冪等性檢查邏輯（檢查 idempotency_key 是否已存在）
- [x] 實作 pending 佔位邏輯（防止併發請求）
- [x] 實作 FOR UPDATE 鎖定訂閱記錄
- [x] 實作餘額檢查和扣款邏輯
- [x] 實作優先順序扣款（月配額 > 購買的 Token）
- [x] 實作錯誤處理和回滾邏輯
- [x] 實作返回 JSONB 結果（包含 success, idempotent, balance_before, balance_after 等）
- [ ] **驗收**：手動執行函數測試冪等性和原子性

### 1.4 部署 migration 到測試環境

- [ ] 執行 migration 建立表和索引
- [ ] 執行 migration 建立 PostgreSQL 函數
- [ ] 驗證 schema 正確
- [ ] 測試函數基本功能（插入測試記錄）
- [ ] **驗收**：測試環境資料庫包含 `token_deduction_records` 表和 `deduct_tokens_atomic` 函數

---

## 階段二：冪等性計費服務【優先級：高】

### 2.1 定義 TypeScript 介面和錯誤類型

- [x] 定義 `DeductTokensIdempotentParams` 介面
- [x] 定義 `DeductTokensResult` 介面
- [x] 建立 `InsufficientBalanceError` 類別
- [x] 建立 `DeductionInProgressError` 類別
- [x] 建立 `DatabaseError` 類別
- [x] **驗收**：TypeScript 編譯無錯誤

### 2.2 實作 TokenBillingService.deductTokensIdempotent()

- [x] 建立 `src/lib/billing/token-billing-service.ts`（或修改現有檔案）
- [x] 實作 `deductTokensIdempotent()` 方法
- [x] 使用 Supabase RPC 調用 `deduct_tokens_atomic` 函數
- [x] 解析返回的 JSONB 結果
- [x] 區分不同錯誤類型並拋出對應的錯誤
- [x] 如果不是冪等性重複請求，調用 `logTokenUsage()` 記錄使用日誌
- [ ] **驗收**：單元測試通過

### 2.3 實作 logTokenUsage() 方法

- [x] 插入 `token_usage_logs` 記錄
- [x] 包含 company_id, article_id, token_amount, deduction_record_id, usage_type, metadata
- [x] 處理插入失敗的情況
- [x] **驗收**：插入成功，`token_usage_logs` 表包含正確記錄

### 2.4 實作餘額查詢方法

- [x] 實作 `getCompanyBalance(companyId: string)` 方法（已在 getCurrentBalance 實作）
- [x] 查詢 `company_subscriptions` 表
- [x] 返回 `{ monthly: number, purchased: number, total: number }`
- [x] **驗收**：返回正確的餘額資訊

---

## 階段三：重試和錯誤處理【優先級：中】

### 3.1 實作指數退避重試邏輯

- [x] 建立 `src/lib/utils/retry.ts`
- [x] 實作 `retryWithExponentialBackoff<T>()` 泛型函數
- [x] 實作 `RetryOptions` 介面（maxRetries, baseDelay, maxDelay, shouldRetry）
- [x] 實作指數退避演算法（delay = baseDelay \* 2^attempt）
- [x] 限制最大延遲（Math.min(delay, maxDelay)）
- [x] 實作 `shouldRetry` 判斷邏輯
- [ ] **驗收**：單元測試驗證重試次數和延遲時間

### 3.2 實作 deductTokensWithRetry() 包裝函數

- [x] 建立 `deductTokensWithRetry()` 函數
- [x] 配置 maxRetries = 3
- [x] 配置 baseDelay = 1000ms
- [x] 配置 maxDelay = 10000ms
- [x] 實作 shouldRetry 邏輯（不重試 InsufficientBalanceError 和 DeductionInProgressError）
- [ ] **驗收**：測試暫時性錯誤會重試，永久性錯誤不重試

### 3.3 記錄重試日誌

- [x] 每次重試時記錄 console.log（包含 attempt, delay, error message）
- [x] 最後一次重試失敗時記錄 console.error
- [x] **驗收**：日誌輸出清晰，包含足夠的除錯資訊

---

## 階段四：整合文章生成流程【優先級：高】

### 4.1 修改文章任務建立 API

- [x] 修改 `src/app/api/articles/generate/route.ts` POST handler
- [x] 實作餘額前置檢查（調用 `getCurrentBalance()`）
- [x] 估算文章生成所需 Token（15,000 tokens）
- [x] 如果餘額不足，返回 HTTP 402 和錯誤訊息
- [x] 錯誤訊息包含 upgradeUrl
- [x] 建立 article_job 記錄
- [x] 觸發 GitHub Actions workflow
- [x] **驗收**：餘額不足時返回 402，餘額足夠時正常建立任務

### 4.2 修改 GitHub Actions workflow

- [x] 修改 `.github/workflows/article-generation.yml`
- [x] 在文章生成成功後新增 "扣除 Token" step
- [x] 傳遞環境變數（JOB_ID, TOKEN_AMOUNT）
- [x] 調用 `node dist/scripts/deduct-tokens.js`
- [x] 只在生成成功後執行扣款
- [x] **驗收**：workflow 成功執行並扣款

### 4.3 建立 deduct-tokens.ts script

- [x] 建立 `scripts/deduct-tokens.ts`
- [x] 從環境變數讀取 JOB_ID, TOKEN_AMOUNT
- [x] 從資料庫查詢 company_id 和 article_id
- [x] 實例化 TokenBillingService
- [x] 調用 `deductTokensWithRetry()`（使用 JOB_ID 作為 idempotency_key）
- [x] 處理 InsufficientBalanceError（更新任務狀態為 failed）
- [x] 處理其他錯誤（標記為 pending_token_deduction）
- [x] 記錄成功/失敗日誌
- [x] **驗收**：script 成功扣款並記錄日誌

### 4.4 測試端到端流程

- [ ] 建立測試文章任務
- [ ] 觸發 GitHub Actions workflow
- [ ] 驗證文章生成成功
- [ ] 驗證 Token 正確扣除
- [ ] 驗證 `token_deduction_records` 記錄為 completed
- [ ] 驗證 `token_usage_logs` 包含使用記錄
- [ ] **驗收**：完整流程無錯誤，餘額正確更新

---

## 階段五：對帳機制【優先級：中】

### 5.1 建立對帳 script

- [x] 建立 `scripts/reconcile-token-deductions.ts`
- [x] 查詢超過 1 小時的 pending 記錄
- [x] 對於每筆記錄，檢查對應的文章是否存在
- [x] 如果文章存在，重試扣款
- [x] 如果文章不存在，標記為 failed
- [x] 記錄對帳結果（成功/失敗數量）
- [ ] **驗收**：手動執行 script 能處理卡住的記錄

### 5.2 實作 retryStuckDeduction() 函數

- [x] 使用 idempotency_key 重新調用 `deduct_tokens_atomic` 函數
- [x] PostgreSQL 函數會檢測到 pending 並增加 retry_count
- [x] 處理重試成功/失敗
- [ ] **驗收**：卡住的 pending 記錄成功轉為 completed 或 failed

### 5.3 設定 cron job（可選）

- [ ] 建立 GitHub Actions workflow 定時執行對帳（每小時）
- [ ] 或使用外部 cron 服務（如 Vercel Cron）
- [ ] 配置告警（如果對帳失敗）
- [ ] **驗收**：cron job 定時執行並記錄日誌

### 5.4 記錄對帳日誌

- [x] 記錄處理的 pending 記錄數量
- [x] 記錄成功/失敗數量
- [x] 記錄錯誤訊息
- [x] **驗收**：日誌清晰，方便除錯

---

## 階段六：前端整合【優先級：中】

### 6.1 修改 TokenBalanceDisplay 組件

- [x] 修改 `src/components/billing/TokenBalanceDisplay.tsx`
- [x] 使用 SWR 每 5 秒刷新餘額
- [x] 顯示月配額和購買的 Token 分別
- [x] 餘額 < 1000 時顯示紅色警告
- [x] 顯示「升級方案」按鈕（餘額不足時）
- [x] **驗收**：組件即時更新餘額

### 6.2 實作餘額 API endpoint

- [x] 建立 `src/app/api/billing/balance/route.ts`
- [x] GET handler 返回當前使用者公司的餘額
- [x] 返回格式：`{ monthly: number, purchased: number, total: number }`
- [x] 處理未登入情況（返回 401）
- [x] **驗收**：API 返回正確的餘額資訊

### 6.3 修改文章列表頁面錯誤處理

- [x] 修改 `src/components/articles/ArticleGenerationButtonsWrapper.tsx`
- [x] 修改 `handleBatchGenerate()` 函數
- [x] 處理 HTTP 402 錯誤（餘額不足）
- [x] 顯示 toast 錯誤訊息和升級連結
- [x] **驗收**：餘額不足時顯示友善的錯誤提示

### 6.4 新增升級方案頁面連結

- [ ] 確保 `/dashboard/billing/upgrade` 頁面存在
- [ ] 顯示方案比較和價格
- [ ] 提供升級按鈕
- [ ] **驗收**：使用者能順利升級方案

---

## 階段七：測試驗證【優先級：高】

### 7.1 冪等性測試

- [ ] 測試相同 idempotency_key 多次調用只扣款一次
- [ ] 驗證第二次調用返回 `idempotent: true`
- [ ] 驗證餘額未改變
- [ ] **驗收**：測試通過，無重複扣款

### 7.2 併發請求測試

- [ ] 測試同時發送相同 idempotency_key 的請求
- [ ] 其中一個應成功，另一個應拋出 DeductionInProgressError
- [ ] **驗收**：測試通過，防止併發重複扣款

### 7.3 原子性測試

- [ ] 測試餘額不足時整個事務回滾
- [ ] 驗證 `token_deduction_records` 狀態為 failed
- [ ] 驗證公司餘額未改變
- [ ] **驗收**：測試通過，確保原子性

### 7.4 重試邏輯測試

- [ ] 模擬暫時性錯誤（資料庫連接逾時）
- [ ] 驗證系統自動重試（最多 3 次）
- [ ] 驗證指數退避延遲時間（1s, 2s, 4s）
- [ ] **驗收**：測試通過，重試邏輯正確

### 7.5 餘額不足測試

- [ ] 設定公司餘額為 100
- [ ] 嘗試扣款 500
- [ ] 驗證返回 InsufficientBalanceError
- [ ] 驗證前端顯示友善錯誤訊息
- [ ] **驗收**：測試通過，錯誤處理正確

### 7.6 對帳機制測試

- [ ] 建立卡住的 pending 記錄（超過 1 小時）
- [ ] 執行對帳 script
- [ ] 驗證記錄被正確處理（completed 或 failed）
- [ ] **驗收**：測試通過，對帳機制正常運作

### 7.7 端到端整合測試

- [ ] 完整測試文章生成流程（從建立任務到扣款完成）
- [ ] 驗證 Token 正確扣除
- [ ] 驗證 `token_deduction_records` 和 `token_usage_logs` 正確記錄
- [ ] 驗證 Dashboard 餘額即時更新
- [ ] **驗收**：完整流程無錯誤

---

## 階段八：文件和部署【優先級：中】

### 8.1 撰寫 API 文件

- [ ] 記錄 `deductTokensIdempotent()` API
- [ ] 記錄參數、返回值、錯誤類型
- [ ] 提供使用範例
- [ ] **驗收**：文件完整清晰

### 8.2 撰寫部署文件

- [ ] 記錄 migration 執行步驟
- [ ] 記錄環境變數配置
- [ ] 記錄監控指標
- [ ] 記錄回滾計畫
- [ ] **驗收**：團隊成員能依文件部署

### 8.3 部署到測試環境

- [ ] 執行 migrations
- [ ] 部署應用層代碼
- [ ] 設定 cron job（對帳）
- [ ] 配置監控和告警
- [ ] 執行冒煙測試
- [ ] **驗收**：測試環境正常運作

### 8.4 部署到生產環境

- [ ] 執行 migrations（資料庫變更）
- [ ] 部署應用層代碼
- [ ] 設定 cron job
- [ ] 配置監控
- [ ] 執行冒煙測試
- [ ] 監控系統指標（扣款成功率、延遲等）
- [ ] **驗收**：生產環境正常運作，無錯誤

---

## 階段九：監控和優化【優先級：低】

### 9.1 配置監控指標

- [ ] 扣款成功率（completed / total）
- [ ] 平均扣款時間
- [ ] Pending 記錄數量
- [ ] 重試次數分布
- [ ] 餘額不足錯誤率
- [ ] **驗收**：監控 dashboard 顯示所有指標

### 9.2 設定告警規則

- [ ] 扣款成功率 < 99% 觸發告警
- [ ] 持續 > 10 分鐘的 pending 記錄觸發告警
- [ ] 平均扣款時間 > 1s 觸發告警
- [ ] **驗收**：告警規則正確觸發

### 9.3 效能優化（可選）

- [ ] 分析慢查詢
- [ ] 優化索引
- [ ] 考慮使用 Redis 快取餘額資訊
- [ ] **驗收**：扣款時間 < 500ms

### 9.4 撰寫運營手冊

- [ ] 記錄常見錯誤和解決方案
- [ ] 記錄對帳流程
- [ ] 記錄回滾步驟
- [ ] **驗收**：運營團隊能獨立處理常見問題

---

## 驗收標準總覽

### 功能驗收

- [ ] 相同 idempotency_key 多次調用只扣款一次
- [ ] 重複請求返回原始結果（不拋出錯誤）
- [ ] Pending 狀態的請求被正確拒絕
- [ ] 扣款和餘額更新在同一事務中
- [ ] 任何步驟失敗都會回滾
- [ ] `token_deduction_records` 狀態與實際扣款一致

### 錯誤處理驗收

- [ ] 建立文章任務前檢查餘額
- [ ] 餘額不足時返回明確錯誤（HTTP 402）
- [ ] 前端顯示友善的錯誤提示和升級連結
- [ ] 暫時性錯誤會自動重試（最多 3 次）
- [ ] 永久性錯誤（如餘額不足）不重試

### 整合驗收

- [ ] 文章生成成功後 Token 正確扣除
- [ ] `token_usage_logs` 正確記錄使用量
- [ ] Dashboard 顯示的餘額即時更新
- [ ] `npm run build` 成功完成，無 TypeScript 錯誤

### 對帳驗收

- [ ] 對帳 script 可以處理卡住的 pending 記錄
- [ ] 超過 1 小時的 pending 記錄被自動處理
- [ ] 對帳日誌記錄詳細資訊

---

## 任務優先級說明

- **高優先級**：核心功能，必須完成
  - 階段一：資料庫 Schema
  - 階段二：冪等性計費服務
  - 階段四：整合文章生成流程
  - 階段七：測試驗證

- **中優先級**：重要但非阻塞
  - 階段三：重試和錯誤處理
  - 階段五：對帳機制
  - 階段六：前端整合
  - 階段八：文件和部署

- **低優先級**：優化和改進
  - 階段九：監控和優化

---

## 預估工作量

- 階段一（資料庫）：4-6 小時
- 階段二（計費服務）：6-8 小時
- 階段三（重試邏輯）：3-4 小時
- 階段四（整合流程）：6-8 小時
- 階段五（對帳機制）：4-6 小時
- 階段六（前端整合）：4-6 小時
- 階段七（測試驗證）：8-10 小時
- 階段八（文件部署）：4-6 小時
- 階段九（監控優化）：4-6 小時

**總計**：43-60 小時（約 5-8 個工作天）
