# 訂閱升級規則測試計劃

## 測試目標

驗證訂閱升級規則系統的正確性，確保：

1. 階層定義正確反映實際定價順序
2. 同階層升級規則正確執行
3. 跨階層升級規則正確執行
4. 終身方案升級規則正確執行
5. 前端顯示與後端驗證一致
6. 錯誤訊息友善且準確

---

## 測試環境

### 測試資料準備

需要建立以下測試帳號（每個代表一種訂閱狀態）：

| 測試帳號                    | 當前方案     | 當前週期 | 用途           |
| --------------------------- | ------------ | -------- | -------------- |
| test-starter-m@example.com  | Starter      | 月繳     | 測試基礎升級   |
| test-starter-y@example.com  | Starter      | 年繳     | 測試年繳升級   |
| test-starter-l@example.com  | Starter      | 終身     | 測試終身升級   |
| test-pro-m@example.com      | Professional | 月繳     | 測試中階升級   |
| test-pro-y@example.com      | Professional | 年繳     | 測試中階年繳   |
| test-pro-l@example.com      | Professional | 終身     | 測試中階終身   |
| test-business-m@example.com | Business     | 月繳     | 測試高階升級   |
| test-business-l@example.com | Business     | 終身     | 測試高階終身   |
| test-agency-m@example.com   | Agency       | 月繳     | 測試最高階     |
| test-agency-l@example.com   | Agency       | 終身     | 測試最高階終身 |
| test-new@example.com        | 無           | 無       | 測試新用戶     |

---

## 測試案例

### 第一部分：階層定義驗證（5 分鐘）

#### TC-001: 驗證階層順序

**目的**: 確認 TIER_HIERARCHY 正確反映定價順序

**測試步驟**:

1. 在瀏覽器 Console 執行：
   ```javascript
   // 假設已在 pricing page
   console.log("Starter:", TIER_HIERARCHY["starter"]); // 應該是 1
   console.log("Professional:", TIER_HIERARCHY["professional"]); // 應該是 2
   console.log("Business:", TIER_HIERARCHY["business"]); // 應該是 3
   console.log("Agency:", TIER_HIERARCHY["agency"]); // 應該是 4
   ```

**預期結果**:

- ✅ Starter = 1
- ✅ Professional = 2
- ✅ Business = 3
- ✅ Agency = 4

---

### 第二部分：同階層升級測試（15 分鐘）

#### TC-101: 月繳 → 年繳（允許）

**測試帳號**: test-starter-m@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「年繳」標籤
4. 檢查當前方案（Starter）的按鈕狀態
5. 點擊「升級」按鈕
6. 檢查是否成功進入付款流程

**預期結果**:

- ✅ 前端顯示「升級」按鈕（而非「目前方案」）
- ✅ 點擊後成功進入付款流程
- ✅ 沒有錯誤訊息

**重複測試**: Professional、Business、Agency 也測試月繳 → 年繳

---

#### TC-102: 月繳 → 終身（允許）

**測試帳號**: test-starter-m@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「終身」標籤
4. 檢查當前方案（Starter）的按鈕狀態
5. 點擊「升級」按鈕
6. 檢查是否成功進入付款流程

**預期結果**:

- ✅ 前端顯示「升級」按鈕
- ✅ 點擊後成功進入付款流程
- ✅ 沒有錯誤訊息

---

#### TC-103: 年繳 → 終身（允許）

**測試帳號**: test-starter-y@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「終身」標籤
4. 檢查當前方案（Starter）的按鈕狀態
5. 點擊「升級」按鈕

**預期結果**:

- ✅ 前端顯示「升級」按鈕
- ✅ 點擊後成功進入付款流程

---

#### TC-104: 年繳 → 月繳（不允許）

**測試帳號**: test-starter-y@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「月繳」標籤
4. 檢查當前方案（Starter）的按鈕狀態

**預期結果**:

- ✅ 前端顯示「目前方案」或禁用按鈕
- ✅ 如有錯誤提示，應顯示「年繳無法變更為月繳」

**重複測試**: Professional、Business、Agency 也測試年繳 → 月繳

---

#### TC-105: 終身 → 任何（不允許縮短）

**測試帳號**: test-starter-l@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「月繳」標籤，檢查 Starter 按鈕狀態
4. 選擇「年繳」標籤，檢查 Starter 按鈕狀態
5. 選擇「終身」標籤，檢查 Starter 按鈕狀態

**預期結果**:

- ✅ 月繳：顯示「目前方案」或禁用
- ✅ 年繳：顯示「目前方案」或禁用
- ✅ 終身：顯示「目前方案」

---

### 第三部分：跨階層升級測試（20 分鐘）

#### TC-201: 月繳 Starter → 年繳 Professional（允許）

**測試帳號**: test-starter-m@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「年繳」標籤
4. 點擊 Professional 的「升級」按鈕
5. 檢查是否成功進入付款流程

**預期結果**:

- ✅ 前端顯示「升級」按鈕
- ✅ 後端允許升級請求
- ✅ 沒有錯誤訊息

---

#### TC-202: 月繳 Starter → 月繳 Business（允許）

**測試帳號**: test-starter-m@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「月繳」標籤
4. 點擊 Business 的「升級」按鈕

**預期結果**:

- ✅ 前端顯示「升級」按鈕
- ✅ 後端允許升級請求

---

#### TC-203: 年繳 Starter → 月繳 Professional（不允許）

**測試帳號**: test-starter-y@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「月繳」標籤
4. 檢查 Professional、Business、Agency 的按鈕狀態
5. 嘗試點擊 Professional 的按鈕（如果可點擊）

**預期結果**:

- ✅ 前端顯示禁用或「不可用」
- ❌ 如果前端允許點擊，後端應拒絕並返回錯誤：「跨階層升級不能縮短計費週期」

---

#### TC-204: 年繳 Professional → 月繳 Agency（不允許）

**測試帳號**: test-pro-y@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「月繳」標籤
4. 檢查 Business 和 Agency 的按鈕狀態

**預期結果**:

- ✅ 前端顯示禁用或「不可用」
- ❌ 如果前端允許，後端應拒絕：「跨階層升級不能縮短計費週期」

---

#### TC-205: 月繳 Starter → 終身 Agency（允許）

**測試帳號**: test-starter-m@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「終身」標籤
4. 點擊 Agency 的「升級」按鈕

**預期結果**:

- ✅ 前端顯示「升級」按鈕
- ✅ 後端允許升級請求

---

### 第四部分：終身方案升級測試（20 分鐘）

#### TC-301: 終身 Starter → 終身 Professional（允許）

**測試帳號**: test-starter-l@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「終身」標籤
4. 點擊 Professional 的「升級」按鈕
5. 檢查是否成功進入付款流程

**預期結果**:

- ✅ 前端顯示「升級」按鈕
- ✅ 後端允許升級請求
- ✅ 沒有錯誤訊息

**重複測試**:

- 終身 Starter → 終身 Business（允許）
- 終身 Starter → 終身 Agency（允許）
- 終身 Professional → 終身 Business（允許）
- 終身 Professional → 終身 Agency（允許）
- 終身 Business → 終身 Agency（允許）

---

#### TC-302: 終身 Starter → 月繳/年繳 Professional（不允許）

**測試帳號**: test-starter-l@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「月繳」標籤，檢查 Professional、Business、Agency 按鈕狀態
4. 選擇「年繳」標籤，檢查 Professional、Business、Agency 按鈕狀態
5. 嘗試點擊任何一個按鈕（如果可點擊）

**預期結果**:

- ✅ 前端顯示禁用或「不可用」
- ❌ 如果前端允許，後端應拒絕：「終身方案不能變更為月繳或年繳」

---

#### TC-303: 終身 Business → 終身 Starter（不允許降級）

**測試帳號**: test-business-l@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「終身」標籤
4. 檢查 Starter 和 Professional 的按鈕狀態

**預期結果**:

- ✅ 前端不顯示低階層方案，或顯示為「不可用」
- ❌ 如果前端允許，後端應拒絕：「無法降級到低階層方案」

---

### 第五部分：階層降級測試（10 分鐘）

#### TC-401: 月繳 Business → 月繳 Professional（不允許）

**測試帳號**: test-business-m@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「月繳」標籤
4. 檢查 Starter 和 Professional 的按鈕狀態

**預期結果**:

- ✅ 前端不顯示低階層方案，或顯示為「不可用」
- ❌ 如果前端允許，後端應拒絕：「無法降級到低階層方案」

---

#### TC-402: 年繳 Agency → 年繳 Business（不允許）

**測試帳號**: test-agency-m@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「年繳」標籤
4. 檢查低階層方案的按鈕狀態

**預期結果**:

- ✅ 前端不顯示低階層方案
- ❌ 如果前端允許，後端應拒絕：「無法降級到低階層方案」

---

### 第六部分：新用戶測試（5 分鐘）

#### TC-501: 新用戶可訂閱任何方案

**測試帳號**: test-new@example.com

**測試步驟**:

1. 登入測試帳號（確保沒有任何訂閱）
2. 前往 `/pricing` 頁面
3. 檢查所有方案（月繳、年繳、終身）的按鈕狀態
4. 嘗試訂閱任何一個方案

**預期結果**:

- ✅ 所有方案都顯示「開始使用」或「訂閱」按鈕
- ✅ 所有方案都可以成功進入付款流程
- ✅ 沒有任何限制

---

### 第七部分：API 端點測試（15 分鐘）

#### TC-601: 直接呼叫 API 測試升級驗證

**使用工具**: Postman 或 curl

**測試步驟**:

1. 獲取測試帳號的 session token
2. 使用 curl 測試各種升級場景

**測試案例 1**: 年繳 Starter → 月繳 Professional（應拒絕）

```bash
curl -X POST https://your-domain.com/api/payment/recurring/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "planId": "professional-plan-id",
    "periodType": "M",
    "periodStartType": 1
  }'
```

**預期結果**:

```json
{
  "error": "跨階層升級不能縮短計費週期"
}
```

HTTP Status: 400

---

**測試案例 2**: 終身 Starter → 年繳 Professional（應拒絕）

```bash
curl -X POST https://your-domain.com/api/payment/recurring/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "planId": "professional-plan-id",
    "periodType": "Y",
    "periodStartType": 1
  }'
```

**預期結果**:

```json
{
  "error": "終身方案不能變更為月繳或年繳"
}
```

HTTP Status: 400

---

**測試案例 3**: 月繳 Starter → 年繳 Professional（應允許）

```bash
curl -X POST https://your-domain.com/api/payment/recurring/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "planId": "professional-plan-id",
    "periodType": "Y",
    "periodStartType": 1
  }'
```

**預期結果**:

```json
{
  "success": true,
  "paymentForm": "...",
  "mandateNo": "..."
}
```

HTTP Status: 200

---

### 第八部分：邊界情況測試（10 分鐘）

#### TC-701: 相同方案相同週期（應顯示「目前方案」）

**測試帳號**: test-starter-m@example.com

**測試步驟**:

1. 登入測試帳號
2. 前往 `/pricing` 頁面
3. 選擇「月繳」標籤
4. 檢查 Starter 的按鈕狀態

**預期結果**:

- ✅ 前端顯示「目前方案」標籤
- ✅ 按鈕禁用或無法點擊

---

#### TC-702: 不存在的方案 slug

**測試步驟**:

1. 使用 API 測試工具
2. 發送請求到 `/api/payment/recurring/create`
3. 使用不存在的 planId

**預期結果**:

- ✅ 返回 404 錯誤：「找不到訂閱方案」

---

#### TC-703: 未登入用戶

**測試步驟**:

1. 登出所有帳號
2. 前往 `/pricing` 頁面
3. 嘗試點擊任何方案的按鈕

**預期結果**:

- ✅ 重定向到登入頁面
- 或顯示「請先登入」訊息

---

## 測試結果記錄表

| 測試案例 | 狀態      | 前端行為 | 後端行為 | 錯誤訊息 | 備註 |
| -------- | --------- | -------- | -------- | -------- | ---- |
| TC-001   | ⬜ 未測試 |          |          |          |      |
| TC-101   | ⬜ 未測試 |          |          |          |      |
| TC-102   | ⬜ 未測試 |          |          |          |      |
| TC-103   | ⬜ 未測試 |          |          |          |      |
| TC-104   | ⬜ 未測試 |          |          |          |      |
| TC-105   | ⬜ 未測試 |          |          |          |      |
| TC-201   | ⬜ 未測試 |          |          |          |      |
| TC-202   | ⬜ 未測試 |          |          |          |      |
| TC-203   | ⬜ 未測試 |          |          |          |      |
| TC-204   | ⬜ 未測試 |          |          |          |      |
| TC-205   | ⬜ 未測試 |          |          |          |      |
| TC-301   | ⬜ 未測試 |          |          |          |      |
| TC-302   | ⬜ 未測試 |          |          |          |      |
| TC-303   | ⬜ 未測試 |          |          |          |      |
| TC-401   | ⬜ 未測試 |          |          |          |      |
| TC-402   | ⬜ 未測試 |          |          |          |      |
| TC-501   | ⬜ 未測試 |          |          |          |      |
| TC-601-1 | ⬜ 未測試 |          |          |          |      |
| TC-601-2 | ⬜ 未測試 |          |          |          |      |
| TC-601-3 | ⬜ 未測試 |          |          |          |      |
| TC-701   | ⬜ 未測試 |          |          |          |      |
| TC-702   | ⬜ 未測試 |          |          |          |      |
| TC-703   | ⬜ 未測試 |          |          |          |      |

**狀態說明**:

- ✅ 通過
- ❌ 失敗
- ⚠️ 部分通過
- ⬜ 未測試

---

## 測試完成標準

### 必須通過的測試（P0）

- ✅ TC-001: 階層順序正確
- ✅ TC-104: 年繳 → 月繳被拒絕
- ✅ TC-203: 跨階層 + 縮短週期被拒絕
- ✅ TC-302: 終身 → 月繳/年繳被拒絕
- ✅ TC-303: 終身降級被拒絕
- ✅ TC-401: 階層降級被拒絕
- ✅ TC-501: 新用戶可訂閱任何方案

### 重要測試（P1）

- ✅ TC-101, TC-102, TC-103: 同階層延長週期
- ✅ TC-201, TC-202, TC-205: 跨階層合法升級
- ✅ TC-301: 終身跨階層升級
- ✅ TC-601: API 端點驗證

### 次要測試（P2）

- ✅ TC-701, TC-702, TC-703: 邊界情況

---

## 回歸測試清單

在每次修改升級規則後，必須執行以下快速回歸測試：

1. ✅ 月繳 Starter → 年繳 Starter（允許）
2. ✅ 年繳 Starter → 月繳 Starter（拒絕）
3. ✅ 月繳 Starter → 年繳 Professional（允許）
4. ✅ 年繳 Starter → 月繳 Professional（拒絕）
5. ✅ 終身 Starter → 終身 Professional（允許）
6. ✅ 終身 Starter → 年繳 Professional（拒絕）
7. ✅ Business → Starter（拒絕）
8. ✅ 新用戶訂閱任何方案（允許）

---

## 測試工具和腳本

### 快速測試腳本（瀏覽器 Console）

```javascript
// 複製到瀏覽器 Console 執行
const testUpgradeRules = () => {
  const tests = [
    // 格式: [currentTier, currentPeriod, targetTier, targetPeriod, expected]
    ["starter", "monthly", "starter", "yearly", true],
    ["starter", "yearly", "starter", "monthly", false],
    ["starter", "monthly", "professional", "yearly", true],
    ["starter", "yearly", "professional", "monthly", false],
    ["starter", "lifetime", "professional", "lifetime", true],
    ["starter", "lifetime", "professional", "yearly", false],
    ["business", "monthly", "starter", "monthly", false],
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(
    ([current, currentPeriod, target, targetPeriod, expected], i) => {
      // 假設 canUpgrade 函式已載入
      const result = canUpgrade(current, currentPeriod, target, targetPeriod);
      const status = result === expected ? "✅" : "❌";

      console.log(
        `${status} Test ${i + 1}: ${current} ${currentPeriod} → ${target} ${targetPeriod}`,
        `Expected: ${expected}, Got: ${result}`,
      );

      if (result === expected) passed++;
      else failed++;
    },
  );

  console.log(`\n總結: ${passed} 通過, ${failed} 失敗`);
};

testUpgradeRules();
```

---

## 已知問題和限制

### 當前限制

1. 專案未配置測試框架（vitest），無法執行單元測試
2. 需要手動建立測試帳號
3. 部分測試需要實際付款環境（建議使用測試金流）

### 建議改進

1. 安裝 vitest 並建立完整的單元測試
2. 建立自動化 E2E 測試（使用 Playwright 或 Cypress）
3. 建立測試資料生成腳本
4. 整合到 CI/CD pipeline

---

## 測試時間估計

| 測試部分         | 預估時間     |
| ---------------- | ------------ |
| 階層定義驗證     | 5 分鐘       |
| 同階層升級測試   | 15 分鐘      |
| 跨階層升級測試   | 20 分鐘      |
| 終身方案升級測試 | 20 分鐘      |
| 階層降級測試     | 10 分鐘      |
| 新用戶測試       | 5 分鐘       |
| API 端點測試     | 15 分鐘      |
| 邊界情況測試     | 10 分鐘      |
| **總計**         | **100 分鐘** |

---

## 緊急修復測試（15 分鐘快速驗證）

如果時間有限，至少執行以下關鍵測試：

1. ✅ TC-001: 階層順序正確
2. ✅ TC-104: 年繳 → 月繳被拒絕
3. ✅ TC-203: 跨階層 + 縮短週期被拒絕
4. ✅ TC-302: 終身 → 月繳/年繳被拒絕
5. ✅ TC-401: 階層降級被拒絕
6. ✅ TC-601-1: API 拒絕不合規升級
7. ✅ TC-601-3: API 允許合規升級

---

## 聯絡資訊

**測試負責人**: [填寫負責人]
**測試日期**: [填寫日期]
**測試環境**: [Production / Staging / Local]
**測試版本**: Commit `ede9b55`
