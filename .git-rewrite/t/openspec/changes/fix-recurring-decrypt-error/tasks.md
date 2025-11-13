# Tasks: 修正定期定額解密失敗問題

## 緊急診斷（優先執行）

### 步驟 1: 驗證環境變數
- [ ] **檢查 HashKey 長度**
  ```bash
  vercel env pull .env.check
  echo -n "$(grep NEWEBPAY_HASH_KEY .env.check | cut -d'=' -f2)" | wc -c
  # 預期: 32 bytes
  ```

- [ ] **檢查 HashIV 長度**
  ```bash
  echo -n "$(grep NEWEBPAY_HASH_IV .env.check | cut -d'=' -f2)" | wc -c
  # 預期: 16 bytes
  ```

- [ ] **檢查是否有隱藏字元**
  ```bash
  echo -n "$(grep NEWEBPAY_HASH_KEY .env.check | cut -d'=' -f2)" | od -c
  # 不應包含 \n、\r、空格等
  ```

### 步驟 2: 對比測試環境與正式環境
- [ ] 確認使用的是正式環境密鑰
- [ ] 對比 `NEWEBPAY_MERCHANT_ID` 是否與藍新金流後台一致
- [ ] 確認 `NEWEBPAY_API_URL` 和 `NEWEBPAY_PERIOD_API_URL` 指向正確環境

### 步驟 3: 加入診斷日誌
- [x] **修改 `src/lib/payment/newebpay-service.ts:206-256`** - ✅ 已完成
  - 加入 Period 參數長度和前綴日誌
  - 加入 HashKey 和 HashIV 長度驗證
  - 加入解密成功/失敗的詳細診斷資訊
  - 加入環境變數配置建議

- [x] **修改 `src/lib/payment/newebpay-service.ts:329-375`** - ✅ 已完成
  - 加入 createInstance 中的環境變數驗證
  - 驗證 HashKey 長度（必須 32 bytes）
  - 驗證 HashIV 長度（必須 16 bytes）
  - 檢測隱藏字元（換行符、空格）

- [x] **修改 `src/app/api/payment/recurring/callback/route.ts:302-325`** - ✅ 已完成
  - 加入解密錯誤的特殊處理
  - 提供友善的錯誤訊息給用戶
  - 記錄詳細的診斷建議

- [x] **修改 `src/app/api/payment/recurring/notify/route.ts:42-65`** - ✅ 已完成
  - 加入解密錯誤的特殊處理
  - 提供清晰的錯誤訊息

- [x] **執行 TypeScript 類型檢查** - ✅ 通過
  - `npx tsc --noEmit` 無錯誤

### 步驟 5: 修正 PeriodPoint 缺失問題
- [x] **修正 payment-service.ts** - ✅ 已完成
  - 自動為月繳訂閱提供 periodPoint（使用今天的日期）
  - 避免 /dashboard 路由出現 PER10004 錯誤
  - 程式碼位置: `src/lib/payment/payment-service.ts:217-233`

- [x] **加強 newebpay-service.ts 驗證** - ✅ 已完成
  - 月繳訂閱缺少 periodPoint 時拋出錯誤
  - 提供清楚的錯誤訊息
  - 程式碼位置: `src/lib/payment/newebpay-service.ts:139-155`

原始規格：
- [ ] **修改 `src/lib/payment/newebpay-service.ts:206-224`**
  ```typescript
  decryptPeriodCallback(period: string): DecryptedResponse {
    // 診斷日誌
    console.log('[NewebPay] Period 參數長度:', period.length)
    console.log('[NewebPay] Period 前 50 字元:', period.substring(0, 50))
    console.log('[NewebPay] HashKey 長度:', this.config.hashKey.length)
    console.log('[NewebPay] HashIV 長度:', this.config.hashIv.length)

    try {
      const decryptedData = this.aesDecrypt(period)
      console.log('[NewebPay] 解密成功，長度:', decryptedData.length)

      // 嘗試解析為 JSON
      try {
        const jsonData = JSON.parse(decryptedData)
        console.log('[NewebPay] JSON 解析成功')
        return jsonData
      } catch (e) {
        console.log('[NewebPay] 非 JSON 格式，使用 URLSearchParams 解析')
        // URLSearchParams 解析...
      }
    } catch (error) {
      console.error('[NewebPay] Period 解密失敗 - 詳細資訊:', {
        error: error instanceof Error ? error.message : String(error),
        periodLength: period.length,
        hashKeyLength: this.config.hashKey.length,
        hashIvLength: this.config.hashIv.length,
      })
      throw error
    }
  }
  ```

### 步驟 4: 測試單次購買解密（對比參考）
- [ ] 確認單次購買 `decryptCallback` 仍然正常運作
- [ ] 記錄成功的解密流程參數

## 可能的修正方案

### 方案 A: 環境變數問題（最可能）
**如果 HashKey/HashIV 長度不正確或包含隱藏字元**

- [x] 重新設定環境變數（使用 `echo -n` 避免換行符） - ✅ 已完成
  ```bash
  # 從藍新金流後台複製密鑰
  echo -n "7hyqDDb3qQmHfz1BDF5FqYtdlshGAvPQ" | vercel env add NEWEBPAY_HASH_KEY production
  echo -n "CGFoFgbiAPYMbSlP" | vercel env add NEWEBPAY_HASH_IV production
  ```
  **診斷發現**: 原先環境變數包含引號，導致實際長度為 52/51 而非 32/16

- [x] 觸發重新部署 - ✅ 已完成
  ```bash
  vercel --prod --yes
  # 部署 URL: https://autopilot-qsczrl4ce-acejou27s-projects.vercel.app
  # 狀態: ● Ready (3 分鐘前)
  ```

- [ ] 等待 90 秒後測試訂閱流程

### 方案 B: Period 參數格式問題
**如果 Period 參數需要額外處理**

- [ ] **檢查是否需要 URL decode**
  ```typescript
  decryptPeriodCallback(period: string): DecryptedResponse {
    // 嘗試 URL decode
    let periodToDecode = period
    try {
      periodToDecode = decodeURIComponent(period)
    } catch (e) {
      // 不需要 decode
    }

    const decryptedData = this.aesDecrypt(periodToDecode)
    // ...
  }
  ```

- [ ] **檢查是否需要移除空格或特殊字元**
  ```typescript
  const cleanedPeriod = period.replace(/\s+/g, '')
  const decryptedData = this.aesDecrypt(cleanedPeriod)
  ```

### 方案 C: 加密演算法參數問題
**如果 AES 解密模式不正確**

- [ ] 確認使用 AES-256-CBC（目前是正確的）
- [ ] 檢查是否需要特定的 padding 模式
- [ ] 參考藍新金流文件確認解密方式

### 方案 D: 藍新金流環境設定問題
**如果後台設定與程式碼不一致**

- [ ] 登入藍新金流後台
- [ ] 確認「信用卡定期定額」功能已啟用
- [ ] 確認 HashKey 和 HashIV 設定值
- [ ] 確認商店代號（MerchantID）正確
- [ ] 檢查是否需要申請或啟用額外權限

## 測試驗證

### 本地測試（如果可行）
- [ ] 使用藍新金流測試環境
- [ ] 模擬定期定額授權回調
- [ ] 驗證解密邏輯

### 生產環境測試
- [ ] 部署診斷日誌版本
- [ ] 執行實際訂閱流程
- [ ] 查看 Vercel 日誌收集診斷資訊
- [ ] 根據日誌調整修正方案

## 緊急應變措施

### 如果無法立即修復
- [ ] 在 Pricing 頁面暫時隱藏定期定額訂閱選項
- [ ] 顯示「維護中」訊息
- [ ] 引導用戶使用單次購買 Token 包（已驗證正常）
- [ ] 通知現有訂閱用戶可能的續約問題

## 文件更新
- [ ] 更新 `ISSUELOG.md` 記錄解密失敗問題
- [ ] 記錄診斷步驟和最終解決方案
- [ ] 更新 OpenSpec 文件

## 驗收標準
✅ HashKey 長度 = 32 bytes
✅ HashIV 長度 = 16 bytes
✅ 定期定額訂閱 Period 參數成功解密
✅ 訂閱流程完整執行無錯誤
✅ 前端顯示「訂閱成功」訊息
✅ 資料庫正確更新（委託、訂閱、Token）

## 時間估計
- 診斷階段: 30-60 分鐘
- 修正階段: 15-30 分鐘（取決於根本原因）
- 測試驗證: 15-30 分鐘
- **總計**: 1-2 小時

## 優先級
🔴🔴🔴 **P0 - 緊急** - 立即執行
