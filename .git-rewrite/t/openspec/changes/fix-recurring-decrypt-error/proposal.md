# 提案：修正定期定額解密失敗問題

## 問題描述
訂閱方案後顯示「訂閱失敗」，實際原因是 **Period 參數解密失敗**，導致整個授權流程中斷。

## 錯誤日誌分析

### 錯誤訊息
```
Error: error:1C800064:Provider routines::bad decrypt
    at f.aesDecrypt (.next/server/chunks/9366.js:1:1283)
    at f.decryptPeriodCallback (.next/server/chunks/9366.js:1:3756)
```

### 錯誤代碼
- **Code**: `ERR_OSSL_BAD_DECRYPT`
- **Library**: `Provider routines`
- **Reason**: `bad decrypt`

### 觸發路徑
1. **ReturnURL** (`/api/payment/recurring/callback`) - ✅ 成功收到 Period 參數
2. **NotifyURL** (`/api/payment/recurring/notify`) - ✅ 成功收到 Period 參數
3. 兩個端點都嘗試解密 Period 參數
4. 解密失敗 → 整個流程中斷

## 根本原因分析

### 可能原因 1: HashKey/HashIV 不正確（最可能）
**症狀**:
- 環境變數 `NEWEBPAY_HASH_KEY` 或 `NEWEBPAY_HASH_IV` 與藍新金流設定不一致
- 可能是測試環境與正式環境密鑰混用
- 可能是密鑰設定時包含隱藏字元（空格、換行符）

**驗證方法**:
```bash
# 檢查密鑰長度
echo -n "$NEWEBPAY_HASH_KEY" | wc -c  # 必須是 32 bytes
echo -n "$NEWEBPAY_HASH_IV" | wc -c   # 必須是 16 bytes
```

**相關經驗**:
- 參考 `ISSUELOG.md:2025-11-04` - 曾因環境變數包含換行符導致加密失敗
- 當時症狀: `Invalid initialization vector`
- 當時解法: 使用 `echo -n` 重新設定環境變數

### 可能原因 2: Period 參數格式錯誤
**症狀**: 藍新金流回傳的 Period 參數格式與預期不同

**Period 參數內容**:
```
72b28af3870cd46d8cfe66ccd706da6024ac8f8064cd95bfe2f1b748dcb9a49a...（3143 字元）
```

**檢查點**:
- ✅ 參數存在（`hasPeriod: true`）
- ❓ 參數格式是否正確
- ❓ 是否需要先進行 URL decode

### 可能原因 3: 解密邏輯錯誤
**檢查 `newebpay-service.ts` 的 `decryptPeriodCallback` 方法**:
```typescript
decryptPeriodCallback(period: string): any {
  try {
    const decrypted = this.aesDecrypt(period)  // ← 這裡失敗
    return JSON.parse(decrypted)
  } catch (error) {
    console.error('[NewebPay] Period 解密失敗:', error)
    throw error
  }
}
```

**可能問題**:
1. Period 參數是否需要先進行處理（如 URL decode、Base64 decode）
2. AES 解密模式是否正確（應為 AES-256-CBC）
3. Padding 模式是否正確

### 可能原因 4: 藍新金流環境設定錯誤
**檢查點**:
- 使用的是測試環境還是正式環境？
- `NEWEBPAY_MERCHANT_ID` 是否正確？
- 藍新金流後台的 HashKey/HashIV 設定是否與程式碼一致？

## 現象對比

### 單次購買（Token 包）
- ✅ 使用 `TradeInfo` + `TradeSha` 解密
- ✅ 解密成功
- ✅ 流程正常

### 定期定額訂閱
- ❌ 使用 `Period` 解密
- ❌ 解密失敗
- ❌ 整個流程中斷

**關鍵差異**:
- 單次購買和定期定額使用**相同的 HashKey 和 HashIV**
- 但解密方法可能不同

## 調查步驟

### 第一步: 驗證環境變數
- [ ] 檢查 Vercel 環境變數 `NEWEBPAY_HASH_KEY` 長度（必須 32 bytes）
- [ ] 檢查 Vercel 環境變數 `NEWEBPAY_HASH_IV` 長度（必須 16 bytes）
- [ ] 確認沒有尾隨空格或換行符
- [ ] 確認是正式環境密鑰而非測試環境

### 第二步: 比對藍新金流文件
- [ ] 閱讀藍新金流「信用卡定期定額」API 文件
- [ ] 確認 Period 參數的加密方式
- [ ] 確認是否需要額外的處理步驟（如 URL decode）

### 第三步: 加入診斷日誌
- [ ] 記錄 Period 參數的原始內容和長度
- [ ] 記錄解密前的處理步驟
- [ ] 記錄使用的 HashKey 和 HashIV 長度（不記錄實際值）

### 第四步: 對比單次購買成功案例
- [ ] 檢查單次購買的解密邏輯
- [ ] 找出定期定額解密的差異點

## 解決方案（待確認根本原因後填寫）

## 影響範圍
- 🔴 **關鍵** - 所有定期定額訂閱完全無法使用
- 影響新用戶訂閱和現有用戶續約
- 用戶會看到「訂閱失敗」訊息
- 可能導致付費轉換率為 0

## 優先級
🔴🔴🔴 **緊急且關鍵** - 阻擋所有定期定額訂閱功能

## 相關檔案
- `src/lib/payment/newebpay-service.ts` - 解密邏輯
- `src/app/api/payment/recurring/callback/route.ts` - ReturnURL 端點
- `src/app/api/payment/recurring/notify/route.ts` - NotifyURL 端點
- 藍新金流文件 - 信用卡定期定額 API 規格

## 參考資料
- `ISSUELOG.md:2025-11-04` - 環境變數導致加密失敗的案例
- 錯誤日誌時間: `2025-11-08 10:45:28`
