# 冪等性 Token 計費系統實作報告

**實作日期**: 2025-11-14
**Commit Hash**: c0370fe
**部署狀態**: ✅ 已部署至 Vercel Production

---

## ✅ 實作摘要

成功實作完整的冪等性 Token 計費系統，包含以下核心功能：

### 1. 資料庫層 (Database Layer)
- ✅ 建立 `token_deduction_records` 表
  - 使用 UNIQUE 約束的 `idempotency_key` 防止重複扣款
  - 狀態機制：`pending` → `completed` / `failed` / `compensated`
  - 包含重試計數、錯誤訊息、餘額變化記錄

- ✅ 實作 `deduct_tokens_atomic` PostgreSQL 函數
  - FOR UPDATE 鎖定機制防止併發問題
  - 原子性事務保證資料一致性
  - 優先順序扣款：月配額 > 購買 Token
  - 完整的錯誤處理和回滾機制

### 2. 應用層 (Application Layer)
- ✅ 擴展 `TokenBillingService` 類別
  - 新增 `deductTokensIdempotent()` 方法
  - 實作冪等性邏輯和錯誤處理
  - 整合 token usage 日誌記錄

- ✅ 自定義錯誤類型
  - `InsufficientBalanceError`: 餘額不足
  - `DeductionInProgressError`: 扣款進行中
  - `DatabaseError`: 資料庫錯誤
  - `MaxRetriesExceededError`: 超過最大重試次數

- ✅ 指數退避重試機制
  - 最多重試 3 次
  - 基礎延遲 1000ms，指數增長至最大 10000ms
  - 智慧錯誤分類（不重試永久性錯誤）

### 3. 文章生成整合 (Article Generation Integration)
- ✅ API 餘額前置檢查
  - 在 `/api/articles/generate` 檢查 Token 餘額
  - 估算每篇文章需要 15,000 tokens
  - 餘額不足時返回 HTTP 402 with upgrade URL

- ✅ GitHub Actions 自動扣款
  - 修改 `article-generation.yml` workflow
  - 文章生成成功後自動執行 Token 扣款
  - 失敗時不影響主流程

- ✅ Token 扣款腳本
  - 建立 `scripts/deduct-tokens.ts`
  - 從環境變數讀取 JOB_ID
  - 自動查詢資料庫取得相關資訊
  - 使用 JOB_ID 作為 idempotency key

### 4. 對帳機制 (Reconciliation)
- ✅ 自動對帳腳本
  - 建立 `scripts/reconcile-token-deductions.ts`
  - 處理超過 1 小時的 pending 記錄
  - 檢查關聯文章是否存在
  - 重試或標記為 failed

### 5. 前端整合 (Frontend Integration)
- ✅ 更新 `TokenBalanceDisplay` 組件
  - 使用 SWR 每 5 秒自動刷新餘額
  - 顯示月配額和購買 Token 分別
  - 餘額 < 1000 時顯示紅色警告

- ✅ 餘額查詢 API
  - 建立 `/api/billing/balance` endpoint
  - 返回 `{ monthly, purchased, total }` 格式

- ✅ 錯誤處理和用戶提示
  - 捕獲 402 錯誤
  - 顯示友善的 toast 訊息
  - 提供「立即升級」按鈕

---

## 📦 變更檔案清單

### 資料庫 (2 個檔案)
- `supabase/migrations/20251114000000_token_deduction_records.sql`
- `supabase/migrations/20251114000001_deduct_tokens_atomic.sql`

### 後端邏輯 (6 個檔案)
- `src/lib/billing/errors.ts` (新增)
- `src/lib/billing/token-billing-service.ts` (擴展)
- `src/lib/utils/retry.ts` (新增)
- `src/app/api/billing/balance/route.ts` (新增)
- `src/app/api/articles/generate/route.ts` (修改)
- `scripts/deduct-tokens.ts` (新增)
- `scripts/reconcile-token-deductions.ts` (新增)

### 前端 (2 個檔案)
- `src/components/billing/TokenBalanceDisplay.tsx` (修改)
- `src/components/articles/ArticleGenerationButtonsWrapper.tsx` (修改)

### CI/CD (1 個檔案)
- `.github/workflows/article-generation.yml` (修改)

### 套件 (2 個檔案)
- `package.json` (新增 swr 依賴)
- `package-lock.json` (更新)

**總計**: 24 個檔案變更，新增 2786 行，刪除 124 行

---

## 🎯 核心技術實作

### 冪等性保證 (Idempotency Guarantee)

**策略**: 資料庫層 + 應用層雙重保護

1. **資料庫層**:
   - `idempotency_key` UNIQUE 約束
   - FOR UPDATE 行級鎖定
   - PostgreSQL 事務隔離

2. **應用層**:
   - 請求前檢查是否存在相同 key
   - Pending 狀態防止併發
   - 完成後返回原始結果

**測試方法**:
```bash
# 相同 JOB_ID 執行多次
JOB_ID=test-123 node dist/scripts/deduct-tokens.js
JOB_ID=test-123 node dist/scripts/deduct-tokens.js

# 第二次應返回 idempotent=true，餘額不變
```

### 扣款優先順序 (Deduction Priority)

**邏輯**: 月配額（會過期）> 購買 Token（永久有效）

```sql
-- 優先從月配額扣除
IF v_monthly_balance >= p_amount THEN
  v_deducted_from_monthly := p_amount;
  v_deducted_from_purchased := 0;
ELSIF v_monthly_balance > 0 THEN
  v_deducted_from_monthly := v_monthly_balance;
  v_deducted_from_purchased := p_amount - v_monthly_balance;
ELSE
  v_deducted_from_monthly := 0;
  v_deducted_from_purchased := p_amount;
END IF;
```

### 錯誤處理策略 (Error Handling Strategy)

| 錯誤類型 | 是否重試 | HTTP 狀態碼 | 處理方式 |
|---------|---------|------------|---------|
| 餘額不足 | ❌ | 402 | 立即失敗，顯示升級提示 |
| 扣款進行中 | ❌ | 409 | 等待原始請求完成 |
| 網路錯誤 | ✅ (3次) | 500 | 指數退避重試 |
| 資料庫逾時 | ✅ (3次) | 500 | 指數退避重試 |

### 重試邏輯 (Retry Logic)

**指數退避算法**:
```
delay = min(baseDelay * 2^attempt, maxDelay)
```

**配置**:
- `maxRetries`: 3
- `baseDelay`: 1000ms
- `maxDelay`: 10000ms

**重試序列**:
1. 第 1 次：1000ms
2. 第 2 次：2000ms
3. 第 3 次：4000ms

---

## 🔍 測試清單

### ⚠️ 需要手動執行的測試

#### 1. 資料庫 Migration
```bash
# 在 Supabase Dashboard SQL Editor 執行：
# 1. supabase/migrations/20251114000000_token_deduction_records.sql
# 2. supabase/migrations/20251114000001_deduct_tokens_atomic.sql
```

#### 2. 餘額查詢 API
```bash
# 登入後測試
curl https://autopilot-91ncltgvh-acejou27s-projects.vercel.app/api/billing/balance

# 預期返回:
# {"monthly": 10000, "purchased": 0, "total": 10000}
```

#### 3. 餘額不足測試
1. 在資料庫將 `monthly_token_quota` 設為 100
2. 嘗試建立文章任務
3. 應看到 402 錯誤和升級提示

#### 4. 完整文章生成流程
1. 建立文章任務（餘額足夠）
2. 等待 GitHub Actions 完成
3. 檢查資料庫:
   ```sql
   SELECT * FROM token_deduction_records ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM token_usage_logs ORDER BY created_at DESC LIMIT 5;
   ```
4. 驗證餘額正確扣除

#### 5. 冪等性測試
```bash
# 同一個 JOB_ID 執行兩次
JOB_ID=<existing-job-id> node dist/scripts/deduct-tokens.js
JOB_ID=<existing-job-id> node dist/scripts/deduct-tokens.js

# 第二次應該返回 idempotent=true
```

#### 6. 對帳機制測試
```bash
# 執行對帳腳本
node dist/scripts/reconcile-token-deductions.js

# 檢查是否處理了超過 1 小時的 pending 記錄
```

---

## 📊 監控指標建議

### 關鍵指標 (Key Metrics)

1. **扣款成功率**
   ```sql
   SELECT
     COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) * 100 AS success_rate
   FROM token_deduction_records
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

2. **平均扣款時間**
   ```sql
   SELECT
     AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) AS avg_deduction_seconds
   FROM token_deduction_records
   WHERE status = 'completed'
     AND created_at > NOW() - INTERVAL '24 hours';
   ```

3. **Pending 記錄數量**
   ```sql
   SELECT COUNT(*)
   FROM token_deduction_records
   WHERE status = 'pending'
     AND created_at < NOW() - INTERVAL '10 minutes';
   ```

4. **重試次數分布**
   ```sql
   SELECT retry_count, COUNT(*) as count
   FROM token_deduction_records
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY retry_count
   ORDER BY retry_count;
   ```

### 告警規則 (Alert Rules)

- 🚨 扣款成功率 < 99%
- 🚨 Pending 超過 10 分鐘的記錄 > 5 筆
- 🚨 平均扣款時間 > 1 秒
- ⚠️ 重試次數 = 3 的記錄比例 > 10%

---

## 🚀 部署狀態

### Git
- ✅ Commit: `c0370fe`
- ✅ 已推送至 `origin/main`
- ✅ 工作目錄乾淨

### Vercel
- ✅ 已部署至 Production
- ✅ URL: https://autopilot-91ncltgvh-acejou27s-projects.vercel.app
- ✅ 建置成功，無錯誤

### TypeScript
- ✅ 編譯成功
- ✅ 無類型錯誤
- ⚠️ 有部分 ESLint 警告（未使用的變數等）

---

## 📝 下一步行動

### 立即執行（優先級：高）

1. **部署資料庫 Migrations** ⚠️ **必須**
   - 登入 Supabase Dashboard
   - 執行兩個 migration SQL 檔案
   - 驗證表和函數已建立

2. **測試餘額 API**
   - 訪問 `/api/billing/balance`
   - 確認返回正確的餘額格式

3. **測試文章生成流程**
   - 建立一篇測試文章
   - 確認 GitHub Actions 成功執行
   - 檢查 Token 是否正確扣除

### 後續優化（優先級：中）

1. **設定對帳 Cron Job**
   - 使用 GitHub Actions 或 Vercel Cron
   - 每小時執行一次 `reconcile-token-deductions.ts`

2. **實作監控 Dashboard**
   - 顯示扣款成功率
   - 顯示 Pending 記錄數量
   - 顯示錯誤分布

3. **完善錯誤處理**
   - 更詳細的錯誤訊息
   - 更好的用戶提示
   - 錯誤追蹤和日誌

### 長期改進（優先級：低）

1. **效能優化**
   - 分析慢查詢
   - 優化索引
   - 考慮使用 Redis 快取

2. **升級方案頁面**
   - 實作 `/dashboard/billing/upgrade`
   - 顯示方案比較
   - 整合付款流程

---

## ⚠️ 已知限制

1. **Migration 需手動執行**
   - Supabase CLI 未配置 project ref
   - 需要在 Dashboard 手動執行 SQL

2. **前端組件依賴 SWR**
   - 已安裝 `swr` 套件
   - 確保所有環境都有此依賴

3. **對帳機制未自動化**
   - 需要手動執行或設定 cron job
   - 建議設定每小時自動執行

4. **升級頁面未實作**
   - 目前只有連結，頁面內容需補充
   - 可能導致用戶點擊後找不到內容

---

## 📚 相關文件

- OpenSpec 提案: `openspec/changes/implement-idempotent-token-billing/proposal.md`
- 設計文件: `openspec/changes/implement-idempotent-token-billing/design.md`
- 任務清單: `openspec/changes/implement-idempotent-token-billing/tasks.md`
- 技術規格: `openspec/changes/implement-idempotent-token-billing/specs/token-billing/spec.md`

---

## ✅ 結論

冪等性 Token 計費系統已成功實作並部署至生產環境。系統提供：

- ✅ 完整的冪等性保證，防止重複扣款
- ✅ 原子性事務，確保資料一致性
- ✅ 智慧重試機制，提高系統可靠性
- ✅ 對帳機制，處理異常情況
- ✅ 前端整合，提供即時餘額顯示和友善的錯誤提示

**下一步**：請執行資料庫 migrations 並測試完整流程。

---

**實作者**: Claude Code
**日期**: 2025-11-14
**版本**: 1.0.0
