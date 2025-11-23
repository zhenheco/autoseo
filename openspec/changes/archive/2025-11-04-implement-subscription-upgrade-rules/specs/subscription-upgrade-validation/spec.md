# Subscription Upgrade Validation Specification

## ADDED Requirements

### Requirement: 階層定義正確性

訂閱方案階層 MUST 正確反映實際定價順序。

#### Scenario: 階層順序驗證

**Given** 系統中定義了訂閱方案階層

**When** 驗證 `TIER_HIERARCHY` 常數

**Then**

- Starter 的階層值為 1
- Professional 的階層值為 2
- Business 的階層值為 3
- Agency 的階層值為 4
- 階層值與實際定價順序一致（NT$599 < NT$2,499 < NT$5,999 < NT$11,999）

---

### Requirement: 同階層升級規則

同階層內的訂閱升級 MUST 只允許延長計費週期。

#### Scenario: 同階層延長計費週期

**Given** 用戶當前為「月繳 Starter」方案

**When** 用戶嘗試升級到「年繳 Starter」或「終身 Starter」

**Then**

- `canUpgrade()` 返回 `true`
- 升級請求被允許
- 前端顯示「升級」按鈕

#### Scenario: 同階層縮短計費週期

**Given** 用戶當前為「年繳 Business」方案

**When** 用戶嘗試「升級」到「月繳 Business」

**Then**

- `canUpgrade()` 返回 `false`
- `getUpgradeBlockReason()` 返回「年繳無法變更為月繳」
- 前端顯示「目前方案」或禁用按鈕
- API 拒絕升級請求

#### Scenario: 同階層相同計費週期

**Given** 用戶當前為「月繳 Agency」方案

**When** 用戶嘗試「升級」到「月繳 Agency」

**Then**

- `canUpgrade()` 返回 `false`
- `getUpgradeBlockReason()` 返回「目前方案」
- 前端顯示「目前方案」標籤

---

### Requirement: 跨階層升級 + 延長或相同計費週期

跨階層升級時，若計費週期延長或相同，MUST 允許升級。

#### Scenario: 跨階層升級 + 延長計費週期

**Given** 用戶當前為「月繳 Starter」方案

**When** 用戶嘗試升級到「年繳 Business」或「終身 Agency」

**Then**

- `canUpgrade()` 返回 `true`
- 升級請求被允許
- 前端顯示「升級」按鈕

#### Scenario: 跨階層升級 + 相同計費週期

**Given** 用戶當前為「年繳 Professional」方案

**When** 用戶嘗試升級到「年繳 Business」或「年繳 Agency」

**Then**

- `canUpgrade()` 返回 `true`
- 升級請求被允許
- 前端顯示「升級」按鈕

---

### Requirement: 跨階層升級 + 縮短計費週期

跨階層升級時，若計費週期縮短，MUST 拒絕升級。

#### Scenario: 跨階層升級但縮短計費週期

**Given** 用戶當前為「年繳 Starter」方案

**When** 用戶嘗試升級到「月繳 Business」或「月繳 Agency」

**Then**

- `canUpgrade()` 返回 `false`
- `getUpgradeBlockReason()` 返回「跨階層升級不能縮短計費週期」
- 前端禁用或隱藏該升級選項
- API 拒絕升級請求並返回 400 錯誤

#### Scenario: 年繳升級到月繳高階方案

**Given** 用戶當前為「年繳 Business」方案

**When** 用戶嘗試升級到「月繳 Agency」

**Then**

- `canUpgrade()` 返回 `false`
- `getUpgradeBlockReason()` 返回「跨階層升級不能縮短計費週期」
- 前端禁用該選項

---

### Requirement: 階層降級限制

任何形式的階層降級 MUST 被拒絕。

#### Scenario: 降級到低階層方案

**Given** 用戶當前為「月繳 Business」方案

**When** 用戶嘗試「升級」到「年繳 Professional」或「終身 Starter」

**Then**

- `canUpgrade()` 返回 `false`
- `getUpgradeBlockReason()` 返回「無法降級到低階層方案」
- 前端不顯示低階層方案的升級選項
- API 拒絕請求並返回 400 錯誤

#### Scenario: Professional 降級到 Starter

**Given** 用戶當前為「年繳 Professional」方案

**When** 用戶嘗試變更到任何 Starter 方案（無論計費週期）

**Then**

- `canUpgrade()` 返回 `false`
- `getUpgradeBlockReason()` 返回「無法降級到低階層方案」
- 前端不顯示 Starter 的任何升級選項

---

### Requirement: 終身方案升級規則

終身方案用戶 MUST 可以升級到更高階層的終身方案，但不能降級或縮短計費週期。

#### Scenario: 終身方案升級到更高階層終身方案

**Given** 用戶當前為「終身 Starter」方案

**When** 用戶嘗試升級到「終身 Professional」、「終身 Business」或「終身 Agency」

**Then**

- `canUpgrade()` 返回 `true`
- 升級請求被允許
- 前端顯示「升級」按鈕

#### Scenario: 終身方案嘗試縮短計費週期

**Given** 用戶當前為「終身 Business」方案

**When** 用戶嘗試變更到「月繳 Business」、「年繳 Business」、「月繳 Agency」或「年繳 Agency」

**Then**

- `canUpgrade()` 返回 `false`
- `getUpgradeBlockReason()` 返回「終身方案不能變更為月繳或年繳」
- 前端不顯示月繳/年繳選項
- API 拒絕請求並返回 400 錯誤

#### Scenario: 終身方案嘗試降級

**Given** 用戶當前為「終身 Business」方案

**When** 用戶嘗試變更到任何 Starter 或 Professional 方案（無論計費週期）

**Then**

- `canUpgrade()` 返回 `false`
- `getUpgradeBlockReason()` 返回「無法降級到低階層方案」
- 前端不顯示低階層方案
- API 拒絕請求並返回 400 錯誤

---

### Requirement: 新用戶無限制

沒有當前訂閱的用戶 MUST 可以訂閱任何方案。

#### Scenario: 新用戶首次訂閱

**Given** 用戶沒有任何當前訂閱（`currentTierSlug` 為 `null`）

**When** 用戶嘗試訂閱任何方案（任何階層、任何計費週期）

**Then**

- `canUpgrade()` 返回 `true`
- 訂閱請求被允許
- 前端顯示所有方案的「開始使用」按鈕

---

### Requirement: 前端升級驗證

前端 MUST 在用戶點擊升級前驗證升級規則。

#### Scenario: 前端顯示升級選項

**Given** 用戶在定價頁面查看訂閱方案

**When** 頁面載入完成

**Then**

- 對每個方案卡片調用 `canUpgrade()` 驗證
- 可升級的方案顯示「升級」按鈕
- 不可升級的方案顯示「目前方案」、「降級不可」或禁用按鈕
- 不可升級的方案顯示原因提示（來自 `getUpgradeBlockReason()`）

#### Scenario: 前端階層過濾

**Given** 用戶當前為「Professional」方案

**When** 用戶在定價頁面切換計費週期（月繳/年繳/終身）

**Then**

- 只顯示 Professional、Business、Agency 方案（過濾掉 Starter）
- 或者 Starter 方案顯示為「不可用」狀態

---

### Requirement: 後端升級驗證

後端 API MUST 在處理升級請求前驗證升級規則。

#### Scenario: API 驗證升級請求

**Given** 用戶發送升級訂閱請求到 `/api/payment/recurring/create`

**When** API 收到請求

**Then**

- 查詢用戶當前訂閱方案和計費週期
- 調用 `canUpgrade()` 驗證升級合法性
- 如果 `canUpgrade()` 返回 `false`：
  - 返回 400 錯誤
  - 錯誤訊息包含 `getUpgradeBlockReason()` 的結果
  - 記錄嘗試違規升級的日誌
- 如果 `canUpgrade()` 返回 `true`：
  - 繼續處理升級請求

#### Scenario: 記錄違規嘗試

**Given** 用戶嘗試違反升級規則的操作

**When** API 拒絕請求

**Then**

- 記錄日誌：`[Upgrade Validation] Blocked upgrade attempt: {currentPlan} -> {targetPlan}, reason: {reason}`
- 不影響用戶當前訂閱狀態
- 返回友善的錯誤訊息給前端

---

### Requirement: 升級規則測試覆蓋

升級規則邏輯 MUST 有完整的單元測試覆蓋。

#### Scenario: 單元測試覆蓋所有路徑

**Given** `upgrade-rules.ts` 模組

**When** 執行單元測試

**Then**

- 測試所有 48 種升級組合（4 階層 × 3 週期 × 4 目標階層）
- 測試新用戶（`currentTierSlug` 為 `null`）的情況
- 測試 `canUpgrade()` 和 `getUpgradeBlockReason()` 的所有分支
- 所有測試通過，覆蓋率達到 100%

#### Scenario: 集成測試驗證前後端一致性

**Given** 前端和後端都使用 `upgrade-rules.ts`

**When** 執行集成測試

**Then**

- 前端按鈕狀態與後端驗證結果一致
- 不存在「前端顯示可升級但後端拒絕」的情況
- 不存在「前端禁用但後端允許」的情況
