# 實作冪等性 Token 計費系統

## 概述

此變更實作冪等性（idempotency）Token 計費機制，解決文章生成後 Token 餘額未正確扣款的問題。主要目標：

1. **防止重複扣款**：使用 idempotency key 確保同一次操作只扣款一次
2. **原子性交易**：使用 PostgreSQL 儲存程序確保扣款和餘額更新的原子性
3. **狀態追蹤**：記錄每次扣款的完整狀態（pending/completed/failed）
4. **錯誤處理**：實作重試邏輯和對帳機制處理失敗情況

**分離原因**：從 `fix-preview-and-ui-issues` 分離出來，因為此功能涉及資料庫 schema 變更、複雜的交易邏輯和冪等性設計，需要獨立處理和測試。

## 影響範圍

### 資料庫

- 新增 `token_deduction_records` 表 - 扣款記錄和狀態追蹤
- 新增 PostgreSQL 儲存程序 `deduct_tokens_atomic` - 原子性扣款操作

### 後端服務

- 修改 `src/lib/billing/token-billing-service.ts` - 新增冪等性扣款方法
- 修改文章生成流程 - 整合冪等性計費
- 新增對帳 script - 處理卡住的扣款記錄

### 前端組件

- 修改 Dashboard - 確保 Token 餘額即時更新
- 處理餘額不足錯誤 - 顯示友善提示

## Why（為何需要此變更）

### 現有實作的關鍵缺陷（基於代碼審查）

#### 1. 嚴重缺陷：無冪等性保護導致重複扣款風險

- **代碼位置**：`src/lib/billing/token-billing-service.ts:57-196`（`completeWithBilling` 方法）
- **現狀問題**：
  - 完全沒有 idempotency key 機制
  - 網路逾時重試會導致重複扣款
  - GitHub Actions workflow 重試會重複扣款
  - 使用者可能被誤扣 Token 數倍，嚴重影響信任度
- **實際案例**：
  ```typescript
  // 現有代碼：每次調用都會扣款，沒有任何去重保護
  const response = await aiClient.complete(prompt, options);
  // ... 直接扣款，無檢查 ...
  await this.supabase.from("company_subscriptions").update({
    monthly_quota_balance: newMonthlyQuota,
    purchased_token_balance: newPurchased,
  });
  ```
- **解決方案**：參考 Stripe/PayPal 設計，使用 UUID idempotency key + 24 小時快取

#### 2. 高風險：非原子性操作導致資料不一致

- **代碼位置**：`src/lib/billing/token-billing-service.ts:112-158`
- **現狀問題**：
  - 扣款分為 **4 個獨立資料庫操作**：
    1. `INSERT token_balance_changes` (購買的 Token) - 行 117-125
    2. `INSERT token_balance_changes` (月配額) - 行 135-143
    3. `UPDATE company_subscriptions` (更新餘額) - 行 146-153
    4. `INSERT token_usage_logs` (使用記錄) - 行 160-175
  - 如果步驟 2 或 3 失敗，**會出現部分扣款**
  - 如果步驟 4 失敗，**餘額已扣但無審計記錄**
  - 沒有 rollback 機制
- **解決方案**：使用 PostgreSQL 儲存程序封裝所有操作在單一事務中

#### 3. 中風險：扣款優先順序錯誤

- **代碼位置**：`src/lib/billing/token-billing-service.ts:112-126`
- **現狀問題**：
  ```typescript
  // 錯誤：優先扣購買的 Token
  if (purchasedBefore > 0) {
    const deductFromPurchased = Math.min(remainingToDeduct, purchasedBefore);
    newPurchased -= deductFromPurchased;
    // ...
  }
  // 再扣月配額
  if (remainingToDeduct > 0) {
    newMonthlyQuota -= remainingToDeduct;
  }
  ```

  - 商業邏輯錯誤：應優先使用會過期的月配額
  - 使用者期望：先用月配額（因為會過期），再用購買的 Token（永久有效）
- **解決方案**：反轉扣款順序（月配額優先）

#### 4. 中風險：無併發控制導致 race condition

- **代碼位置**：`src/lib/billing/token-billing-service.ts:93-98`
- **現狀問題**：
  ```typescript
  // 沒有使用 FOR UPDATE 鎖定
  const { data: subscriptionData } = await this.supabase
    .from("company_subscriptions")
    .select("monthly_quota_balance, purchased_token_balance")
    .eq("company_id", companyId)
    .single();
  ```

  - 多個文章同時生成時，可能出現 race condition
  - 兩個請求讀到相同的餘額 → 都扣款成功 → 餘額被覆蓋
  - 最終結果：只扣了一次款，但生成了兩篇文章
- **解決方案**：使用 PostgreSQL `FOR UPDATE` 鎖定訂閱記錄

#### 5. 低風險：錯誤處理不完善

- **現狀問題**：
  - 沒有區分暫時性錯誤（可重試）和永久性錯誤（不可重試）
  - 沒有指數退避重試策略
  - 缺乏對帳機制處理卡住的扣款
- **解決方案**：實作完整的錯誤分類和重試策略

### What Changes（具體變更）

1. **新增 `token_deduction_records` 表**：記錄扣款狀態和 idempotency key
2. **新增 `deduct_tokens_atomic` PostgreSQL 函數**：原子性執行所有扣款操作
3. **修正扣款優先順序**：月配額優先 → 購買的 Token
4. **實作冪等性服務**：`TokenBillingService.deductTokensIdempotent()`
5. **新增重試邏輯**：指數退避策略，最多 3 次重試
6. **新增對帳機制**：處理卡住的 pending 扣款記錄

## 相關變更

- **前置變更**：`fix-preview-and-ui-issues` 已完成（移除批次清除、強化安全性）
- **相關 spec**：`token-balance-api` - Token 餘額查詢 API

## 非目標

- 不修改 Token 計價邏輯（保持現有的 model_multiplier × 2.0）
- 不實作自動對帳排程（使用手動 script）
- 不修改現有的推薦和經銷商系統
- 不修改月配額重置邏輯

## 風險評估

### 中風險

- 資料庫 migration：需要新增表和儲存程序
- 交易邏輯變更：可能影響現有扣款流程
- 需完整測試：確保不會誤扣款或漏扣款

### 低風險

- 冪等性設計：idempotency key 是成熟的設計模式
- 向後相容：新舊系統可以並存運行

## 驗收標準

### 冪等性驗證

- [x] 使用相同 idempotency_key 多次調用，只扣款一次
- [x] 重複請求返回原始結果（不拋出錯誤）
- [x] pending 狀態的請求被正確拒絕

### 原子性驗證

- [x] 扣款和餘額更新在同一事務中
- [x] 任何步驟失敗都會回滾
- [x] `token_deduction_records` 狀態與實際扣款一致

### 餘額不足處理

- [x] 建立文章任務前檢查餘額
- [x] 餘額不足時返回明確錯誤
- [x] 前端顯示友善的錯誤提示和升級連結

### 錯誤恢復

- [x] 暫時性錯誤會自動重試（最多 3 次）
- [x] 永久性錯誤（如餘額不足）不重試
- [x] 對帳 script 可以處理卡住的 pending 記錄

### 整合驗證

- [x] 文章生成成功後 Token 正確扣除
- [x] `token_usage_logs` 正確記錄使用量
- [x] Dashboard 顯示的餘額即時更新
- [x] `npm run build` 成功完成，無 TypeScript 錯誤

## 實施計畫

1. **階段一：資料庫 Schema**
   - 建立 `token_deduction_records` 表
   - 建立 `deduct_tokens_atomic` PostgreSQL 函數
   - 建立索引和約束

2. **階段二：冪等性計費服務**
   - 實作 `deductTokensIdempotent` 方法
   - 實作 idempotency key 檢查邏輯
   - 實作狀態管理（pending/completed/failed）

3. **階段三：重試和錯誤處理**
   - 實作指數退避重試邏輯
   - 區分可重試和不可重試的錯誤
   - 記錄重試次數

4. **階段四：整合文章生成流程**
   - 修改文章生成 API 使用冪等性計費
   - 實作餘額不足前置檢查
   - 更新前端錯誤處理

5. **階段五：對帳機制**
   - 建立對帳 script
   - 處理卡住的 pending 記錄
   - 記錄對帳結果

6. **階段六：測試驗證**
   - 測試冪等性（重複請求）
   - 測試原子性（模擬錯誤）
   - 測試重試邏輯
   - 測試對帳機制
   - 完整端到端測試
