# Proposal 完善摘要

## 完成的研究和改進

### 1. 深入代碼審查

✅ 檢查了以下現有代碼：
- `src/lib/billing/token-billing-service.ts` - 現有計費服務
- `src/lib/billing/token-calculator.ts` - Token 計算邏輯
- `src/app/api/token-balance/route.ts` - 餘額 API
- `src/types/database.types.ts` - 資料庫 schema

### 2. 發現的關鍵問題

#### 嚴重缺陷：無冪等性保護
- **位置**：`src/lib/billing/token-billing-service.ts:57-196`
- **問題**：完全沒有 idempotency key，網路重試會重複扣款
- **影響**：使用者可能被誤扣 Token 數倍

#### 高風險：非原子性操作
- **位置**：`src/lib/billing/token-billing-service.ts:112-175`
- **問題**：扣款分為 4 個獨立操作，可能部分失敗
- **影響**：資料不一致（扣款成功但餘額未更新，或反之）

#### 中風險：扣款順序錯誤
- **位置**：`src/lib/billing/token-billing-service.ts:112-126`
- **問題**：優先扣購買的 Token，應該月配額優先
- **影響**：使用者的月配額（會過期）未被優先使用

#### 中風險：無併發控制
- **位置**：`src/lib/billing/token-billing-service.ts:93-98`
- **問題**：沒有使用 FOR UPDATE 鎖定
- **影響**：多個請求併發時可能出現 race condition

### 3. 網路研究最佳實踐

✅ 搜尋並整合了以下最佳實踐：

#### Stripe/PayPal 模式
- 使用 UUID 作為 idempotency key
- 24 小時結果快取
- 重複請求返回快取結果，不重新處理
- Idempotency key 只防止網路重試，不防止用戶重複點擊

#### PostgreSQL 最佳實踐
- 使用儲存程序確保所有操作在單一事務中
- 使用 FOR UPDATE 防止併發修改
- 錯誤時自動回滾
- 使用 EXCEPTION 處理區塊處理錯誤

### 4. 完善的文件改進

#### proposal.md
- ✅ 新增詳細的「Why（為何需要此變更）」區段
- ✅ 列出 5 個具體的代碼缺陷和位置
- ✅ 提供現有代碼範例和問題說明
- ✅ 明確的解決方案和參考來源

#### design.md
- ✅ 新增「設計原則」區段（Stripe/PostgreSQL 最佳實踐）
- ✅ 新增「現有代碼問題修復對照表」
- ✅ 修正 PostgreSQL 函數的扣款優先順序（月配額優先）
- ✅ 加入詳細的註解說明每個步驟

#### tasks.md
- ✅ 新增「關鍵注意事項（開始前必讀）」區段
- ✅ 列出現有代碼的 4 個已知問題和修復方法
- ✅ 提供參考最佳實踐清單
- ✅ 確保實作時能避免相同問題

#### specs/token-billing/spec.md
- ✅ 已存在，包含 7 個需求和 20+ 個場景
- ✅ 涵蓋冪等性、原子性、重試、對帳等所有關鍵功能

### 5. 設計亮點

#### 冪等性設計（參考 Stripe）
```typescript
// 1. 使用 article_job_id 作為 idempotency_key
// 2. 檢查 token_deduction_records 表
// 3. 如果已存在 completed 記錄，返回快取結果
// 4. 如果已存在 pending 記錄，拒絕請求
```

#### 原子性設計（PostgreSQL 儲存程序）
```sql
-- 單一事務包含所有操作：
-- 1. 檢查 idempotency_key
-- 2. 建立 pending 記錄
-- 3. FOR UPDATE 鎖定訂閱
-- 4. 檢查餘額
-- 5. 更新訂閱
-- 6. 更新扣款記錄為 completed
-- 任何步驟失敗 → 自動回滾
```

#### 正確的扣款優先順序
```typescript
// ✅ 正確順序（新設計）
// 1. 優先扣月配額（會過期）
// 2. 再扣購買的 Token（永久有效）

// ❌ 錯誤順序（現有代碼）
// 1. 優先扣購買的 Token
// 2. 再扣月配額
```

#### 完整的錯誤處理
```typescript
// 1. 區分錯誤類型
// - InsufficientBalanceError（不可重試）
// - DeductionInProgressError（不可重試）
// - DatabaseError（可重試）

// 2. 指數退避重試
// - 第 1 次：等待 1 秒
// - 第 2 次：等待 2 秒
// - 第 3 次：等待 4 秒

// 3. 對帳機制
// - 每小時檢查 pending 記錄
// - 超過 1 小時的記錄重試或標記失敗
```

### 6. 驗證結果

✅ **OpenSpec 驗證通過**
```bash
$ npx openspec validate implement-idempotent-token-billing --strict
Change 'implement-idempotent-token-billing' is valid
```

### 7. 文件完整性

| 檔案 | 狀態 | 說明 |
|------|------|------|
| proposal.md | ✅ 完整 | 包含 Why/What、風險評估、驗收標準 |
| design.md | ✅ 完整 | 詳細技術設計、PostgreSQL 函數、測試策略 |
| tasks.md | ✅ 完整 | 9 個階段、122 個具體任務、預估工作量 |
| specs/token-billing/spec.md | ✅ 完整 | 7 個需求、20+ 個場景 |
| IMPROVEMENTS.md | ✅ 新增 | 本文件 |

## 相比初始版本的改進

### 初始版本問題
- ❌ 沒有指出現有代碼的具體問題
- ❌ 缺少代碼位置和範例
- ❌ 沒有參考業界最佳實踐
- ❌ 扣款優先順序沒有說明為何要改

### 改進後的版本
- ✅ 詳細列出 5 個代碼缺陷和具體位置
- ✅ 提供實際代碼範例和問題說明
- ✅ 參考 Stripe/PayPal/PostgreSQL 最佳實踐
- ✅ 明確說明扣款優先順序的商業邏輯
- ✅ 加入「關鍵注意事項」防止實作時重複錯誤
- ✅ 完整的測試策略和監控指標

## 下一步建議

1. **審查和批准提案**：團隊審查完善後的 proposal
2. **建立 feature branch**：`feature/idempotent-token-billing`
3. **開始實作**：按照 tasks.md 的 9 個階段逐步進行
4. **持續驗證**：每個階段完成後執行相應的測試
5. **代碼審查**：確保修復了所有已知問題

## 參考資源

- [Stripe Idempotency Keys](https://brandur.org/idempotency-keys)
- [PostgreSQL Transaction Best Practices](https://www.postgresql.org/docs/current/plpgsql-control-structures.html)
- 現有代碼：`src/lib/billing/token-billing-service.ts`

---

**建立時間**：2025-11-14
**完善者**：Claude Code
**狀態**：✅ 完成，已通過 OpenSpec 驗證
