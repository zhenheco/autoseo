# Spec: Decrypt Diagnosis（解密診斷）

## 概述

診斷並修正定期定額訂閱的 Period 參數解密失敗問題，確保授權流程正常運作。

## 問題陳述

定期定額訂閱的 ReturnURL 和 NotifyURL 都收到 Period 參數，但在嘗試解密時失敗，錯誤訊息為 `error:1C800064:Provider routines::bad decrypt`。

## ADDED Requirements

### Requirement: 環境變數完整性驗證

系統 MUST 在啟動時驗證藍新金流環境變數的完整性和正確性，包括 HashKey 和 HashIV 的長度和格式。

#### Scenario: HashKey 長度驗證

- **GIVEN** NewebPayService 初始化
- **WHEN** 讀取 `NEWEBPAY_HASH_KEY` 環境變數
- **THEN** 系統 MUST 驗證長度為 32 bytes
- **AND** 如果長度不正確，MUST 拋出錯誤並記錄實際長度

#### Scenario: HashIV 長度驗證

- **GIVEN** NewebPayService 初始化
- **WHEN** 讀取 `NEWEBPAY_HASH_IV` 環境變數
- **THEN** 系統 MUST 驗證長度為 16 bytes
- **AND** 如果長度不正確，MUST 拋出錯誤並記錄實際長度

#### Scenario: 隱藏字元檢測

- **GIVEN** HashKey 或 HashIV 環境變數
- **WHEN** 系統載入環境變數
- **THEN** 系統 SHOULD 檢測並警告包含空格、換行符或其他隱藏字元
- **AND** 如果偵測到隱藏字元，MUST 記錄警告日誌

### Requirement: 解密診斷日誌

系統 MUST 在解密失敗時記錄詳細的診斷資訊，包括參數長度、密鑰長度和錯誤堆疊。

#### Scenario: Period 解密失敗診斷

- **GIVEN** 收到 Period 參數
- **WHEN** `decryptPeriodCallback` 解密失敗
- **THEN** 系統 MUST 記錄以下資訊：
  - Period 參數長度
  - Period 前 50 字元（不記錄完整內容保護隱私）
  - HashKey 長度（不記錄實際值）
  - HashIV 長度（不記錄實際值）
  - 完整錯誤堆疊
- **AND** 錯誤訊息 MUST 包含診斷提示（如「請檢查環境變數長度」）

#### Scenario: 成功解密日誌

- **GIVEN** Period 參數解密成功
- **WHEN** 系統處理解密資料
- **THEN** 系統 SHOULD 記錄成功訊息和解密資料長度
- **AND** 如果是 JSON 格式，SHOULD 記錄主要欄位名稱

### Requirement: 解密錯誤處理韌性

系統 MUST 在解密失敗時提供清晰的錯誤訊息和恢復建議，不應該讓用戶看到技術性錯誤。

#### Scenario: 解密失敗的友善錯誤

- **GIVEN** Period 解密失敗
- **WHEN** 系統準備返回錯誤給前端
- **THEN** 錯誤訊息 MUST 是用戶友善的（如「訂閱處理失敗，請稍後再試或聯繫客服」）
- **AND** 技術性錯誤 MUST 只記錄在伺服器日誌
- **AND** 前端 SHOULD 重定向到 `payment=error&error={友善訊息}`

#### Scenario: 解密失敗的後續處理

- **GIVEN** Period 解密失敗
- **WHEN** 系統記錄錯誤
- **THEN** 系統 SHOULD 嘗試記錄原始 Period 參數到資料庫（用於後續診斷）
- **AND** 系統 SHOULD 發送警告通知給管理員（未來功能）

### Requirement: 單次購買解密對比

系統 MUST 維護單次購買和定期定額的解密邏輯一致性，便於診斷和維護，兩者 SHALL 使用相同的底層加密函式和參數。

#### Scenario: 共用 AES 解密函式

- **GIVEN** 單次購買的 `decryptCallback` 和定期定額的 `decryptPeriodCallback`
- **WHEN** 兩者都需要解密資料
- **THEN** 兩者 MUST 使用相同的 `aesDecrypt` 函式
- **AND** 使用相同的 HashKey 和 HashIV
- **AND** 使用相同的加密模式（AES-256-CBC）

#### Scenario: 解密邏輯差異記錄

- **GIVEN** 單次購買解密成功但定期定額失敗
- **WHEN** 系統記錄錯誤
- **THEN** 日誌 MUST 明確指出「單次購買正常，定期定額失敗」
- **AND** 提示可能的原因（如 Period 參數格式不同）

## 實作細節

### 修改點 1: newebpay-service.ts:298-316（環境變數驗證）

```typescript
static createInstance(): NewebPayService {
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID
  const hashKey = process.env.NEWEBPAY_HASH_KEY
  const hashIv = process.env.NEWEBPAY_HASH_IV

  if (!merchantId || !hashKey || !hashIv) {
    throw new Error('NewebPay 環境變數未設定')
  }

  // ✅ 新增：驗證 HashKey 長度
  if (hashKey.length !== 32) {
    console.error('[NewebPay] HashKey 長度錯誤:', {
      expected: 32,
      actual: hashKey.length,
      hasNewline: hashKey.includes('\n'),
      hasSpace: hashKey.includes(' '),
    })
    throw new Error(`HashKey 長度必須為 32 bytes，實際為 ${hashKey.length} bytes`)
  }

  // ✅ 新增：驗證 HashIV 長度
  if (hashIv.length !== 16) {
    console.error('[NewebPay] HashIV 長度錯誤:', {
      expected: 16,
      actual: hashIv.length,
      hasNewline: hashIv.includes('\n'),
      hasSpace: hashIv.includes(' '),
    })
    throw new Error(`HashIV 長度必須為 16 bytes，實際為 ${hashIv.length} bytes`)
  }

  console.log('[NewebPay] 環境變數驗證通過:', {
    merchantId: merchantId.substring(0, 8) + '...',
    hashKeyLength: hashKey.length,
    hashIvLength: hashIv.length,
  })

  return new NewebPayService({
    merchantId,
    hashKey,
    hashIv,
    apiUrl,
    periodApiUrl,
  })
}
```

### 修改點 2: newebpay-service.ts:206-224（診斷日誌）

```typescript
decryptPeriodCallback(period: string): DecryptedResponse {
  console.log('[NewebPay] 開始解密 Period 參數:', {
    periodLength: period.length,
    periodPrefix: period.substring(0, 50),
    hashKeyLength: this.config.hashKey.length,
    hashIvLength: this.config.hashIv.length,
  })

  try {
    const decryptedData = this.aesDecrypt(period)
    console.log('[NewebPay] ✅ 解密成功:', {
      decryptedLength: decryptedData.length,
      decryptedPrefix: decryptedData.substring(0, 100),
    })

    // 嘗試 JSON 解析
    try {
      const jsonData = JSON.parse(decryptedData)
      console.log('[NewebPay] ✅ JSON 解析成功:', {
        keys: Object.keys(jsonData),
        hasStatus: 'Status' in jsonData,
        hasResult: 'Result' in jsonData,
      })
      return jsonData
    } catch (e) {
      console.log('[NewebPay] 非 JSON 格式，使用 URLSearchParams 解析')
      // URLSearchParams 解析...
    }
  } catch (error) {
    console.error('[NewebPay] ❌ Period 解密失敗:', {
      error: error instanceof Error ? error.message : String(error),
      errorCode: error instanceof Error && 'code' in error ? (error as any).code : undefined,
      periodLength: period.length,
      hashKeyLength: this.config.hashKey.length,
      hashIvLength: this.config.hashIv.length,
      suggestion: hashKey.length !== 32 || hashIv.length !== 16
        ? '請檢查環境變數 NEWEBPAY_HASH_KEY 和 NEWEBPAY_HASH_IV 的長度和內容'
        : '請確認藍新金流後台的 HashKey/HashIV 設定與程式碼一致',
    })
    throw error
  }
}
```

### 修改點 3: recurring/callback/route.ts:280-310（友善錯誤）

```typescript
} catch (error) {
  console.error('=' * 80)
  console.error('[Payment Callback] 處理回調失敗 - 最外層 catch')
  console.error('[Payment Callback] 錯誤類型:', error instanceof Error ? error.constructor.name : typeof error)
  console.error('[Payment Callback] 錯誤訊息:', error instanceof Error ? error.message : String(error))

  // ✅ 新增：解密錯誤的特殊處理
  const isDecryptError = error instanceof Error && error.message.includes('bad decrypt')
  if (isDecryptError) {
    console.error('[Payment Callback] 🔴 解密失敗 - 請檢查環境變數')
    console.error('[Payment Callback] 建議：')
    console.error('  1. 確認 NEWEBPAY_HASH_KEY 長度為 32 bytes')
    console.error('  2. 確認 NEWEBPAY_HASH_IV 長度為 16 bytes')
    console.error('  3. 確認沒有包含空格或換行符')
    console.error('  4. 確認與藍新金流後台設定一致')
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const errorMessage = isDecryptError
    ? '訂閱處理失敗，請稍後再試或聯繫客服'
    : '處理失敗，請重新整理頁面'

  const redirectUrl = `${baseUrl}/dashboard/subscription?payment=error&error=${encodeURIComponent(errorMessage)}`

  return new NextResponse(/* HTML redirect */)
}
```

## 測試案例

### 測試 1: HashKey 長度錯誤

```typescript
// 設定錯誤長度的 HashKey
process.env.NEWEBPAY_HASH_KEY = "SHORT_KEY";
// 預期: 拋出錯誤「HashKey 長度必須為 32 bytes，實際為 9 bytes」
```

### 測試 2: HashKey 包含換行符

```typescript
// 設定包含換行符的 HashKey
process.env.NEWEBPAY_HASH_KEY = "YOUR_32_CHAR_KEY_WITH_NEWLINE\n";
// 預期: 拋出錯誤並記錄 hasNewline: true
```

### 測試 3: Period 解密成功

```typescript
// 使用正確的環境變數和 Period 參數
// 預期: 成功解密並記錄診斷資訊
```

## 相關規格

- `recurring-subscription` - 定期定額訂閱流程
- `payment-callbacks` - 支付回調處理

## 參考

- `ISSUELOG.md:2025-11-04` - 環境變數導致加密失敗的案例
- 藍新金流文件 - 信用卡定期定額 API
- Node.js crypto 文件 - AES-256-CBC 解密
