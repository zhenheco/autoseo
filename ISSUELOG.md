# 問題解決記錄

## 2025-11-13: GitHub Secrets 換行符問題（CLI 工具缺陷）

### 問題現象
- **症狀**: GitHub Actions workflow 環境變數驗證失敗，所有 10 個變數都檢測到包含換行符
- **錯誤**: `❌ 錯誤: [VAR_NAME] 包含換行符`
- **影響範圍**: 文章生成 workflow 無法執行，因為環境變數驗證步驟失敗

### 根本原因
**`gh secret set` CLI 工具會自動添加換行符** ✅

1. **檢測邏輯缺陷（已修正）**:
   - 原始檢測代碼: `if echo "$var_value" | grep -q $'\n'; then`
   - 問題: `echo` 會自動添加換行符，導致所有變數都被誤判
   - 修正: 使用 `printf '%s'` 代替 `echo`

2. **CLI 工具缺陷（無法修正）**:
   - `gh secret set --body "value"` 會在設定 secrets 時自動添加換行符
   - `echo -n "value" | gh secret set SECRET_NAME` 同樣會添加換行符
   - 即使使用 `printf '%s' "value" | gh secret set` 也無效

### 調查過程
1. **初始嘗試**: 使用 `sync-secrets.sh` 從 Vercel 同步環境變數到 GitHub，但發現換行符問題
2. **診斷檢測邏輯**: 發現 workflow 的 `echo "$var_value" | grep -q $'\n'` 會誤判
3. **修正檢測邏輯**: 更新為 `printf '%s' "$var_value" | grep -q $'\n'`
4. **發現 CLI 缺陷**: 即使使用正確的方法，`gh secret set` 仍然會添加換行符
5. **Hexdump 驗證**: 使用 hexdump 確認提取的值沒有換行符，但設定後仍檢測到換行符
6. **結論**: `gh` CLI 工具本身在設定 secrets 時會自動添加換行符，無法通過命令行參數避免

### 解決方案

#### 唯一可行方案：在 GitHub 網頁介面手動更新
```
URL: https://github.com/acejou27/Auto-pilot-SEO/settings/secrets/actions

需要更新的 10 個 Secrets：
1. NEXT_PUBLIC_SUPABASE_URL
2. NEXT_PUBLIC_SUPABASE_ANON_KEY
3. SUPABASE_SERVICE_ROLE_KEY
4. OPENAI_API_KEY
5. DEEPSEEK_API_KEY
6. R2_ACCESS_KEY_ID
7. R2_SECRET_ACCESS_KEY
8. R2_ACCOUNT_ID
9. R2_BUCKET_NAME
10. USE_MULTI_AGENT_ARCHITECTURE

注意事項：
- 從 /tmp/manual-secrets-guide.md 複製正確的值
- 複製時不要包含前後空格或換行符
- 貼上後檢查沒有多餘的空白字符
- 直接在文本框中貼上，不要使用任何編輯器
```

### 教訓
1. **不要依賴 `gh secret set` CLI 工具**: 該工具會自動添加換行符，無法用於設定需要精確格式的 secrets
2. **使用網頁介面**: GitHub 網頁介面是唯一可靠的設定 secrets 的方法
3. **檢測邏輯要精確**: 使用 `printf '%s'` 而不是 `echo` 來避免自動添加換行符
4. **驗證工具行為**: 在使用任何 CLI 工具前，先用簡單測試驗證其行為

### 相關 Commits
- `4bbb22a`: 修正 workflow 環境變數檢測邏輯（使用 printf 而不是 echo）

---

## 2025-11-08: 修正定期定額訂閱解密失敗（環境變數換行符問題）

### 問題現象
- **症狀**: 定期定額訂閱授權成功，但回調解密失敗
- **錯誤**: `ERR_OSSL_BAD_DECRYPT: error:1C800064:Provider routines::bad decrypt`
- **影響範圍**: 所有定期定額訂閱無法完成，導致訂閱未建立、Token 餘額顯示 0/0

### 問題日誌
```
[NewebPay] ❌ Period 解密失敗: {
  error: 'error:1C800064:Provider routines::bad decrypt',
  errorCode: 'ERR_OSSL_BAD_DECRYPT',
  periodLength: 1280,
  hashKeyLength: 32,
  hashIvLength: 16,
  suggestion: '請確認藍新金流後台的 HashKey/HashIV 設定與程式碼一致'
}
```

### 根本原因
**環境變數包含換行符** ✅

1. **時間點**: 環境變數在 5 小時前被更新（Vercel 顯示「5h ago」）
2. **問題**: 更新時可能直接複製貼上，包含了尾隨換行符 `\n`
3. **影響**:
   - HashKey 實際值變成 `7hyqDDb3qQmHfz1BDF5FqYtdlshGAvPQ\n`（33 bytes 而非 32 bytes）
   - 導致 AES-256-CBC 解密使用錯誤的 key，產生 BAD_DECRYPT 錯誤

### 調查過程
1. **檢查 git 歷史**：發現 2025-11-04 曾成功修正相同問題
2. **查看 ISSUELOG.md**：找到當時使用 `echo -n` 解決換行符問題的記錄
3. **檢查環境變數更新時間**：Vercel 顯示 HashKey/HashIV 在 5 小時前更新
4. **確認測試環境憑證**：用戶確認沙盒環境的 key 與記錄一致

### 解決方案

#### 重新設定環境變數（使用 echo -n 避免換行符）
```bash
# 1. 移除舊的環境變數
vercel env rm NEWEBPAY_HASH_KEY production --yes
vercel env rm NEWEBPAY_HASH_IV production --yes

# 2. 使用 echo -n 重新設定（確保沒有換行符）
echo -n "7hyqDDb3qQmHfz1BDF5FqYtdlshGAvPQ" | vercel env add NEWEBPAY_HASH_KEY production
echo -n "CGFoFgbiAPYMbSlP" | vercel env add NEWEBPAY_HASH_IV production

# 3. 觸發重新部署
vercel --prod --yes
```

### 測試結果
✅ **2025-11-08 修正成功**（待驗證）
- 環境變數已使用 `echo -n` 重新設定
- 部署已觸發：https://autopilot-bzbygnhwm-acejou27s-projects.vercel.app
- 等待用戶測試訂閱流程

### 經驗教訓

1. **環境變數設定的標準程序**
   - ✅ **永遠使用 `echo -n`**：避免尾隨換行符
   - ❌ **不要直接複製貼上**：可能包含隱藏字元
   - ✅ **驗證長度**：HashKey 應為 32 bytes，HashIV 應為 16 bytes

2. **問題重現提醒**
   - 本問題在 2025-11-04 已解決過一次
   - 需要在文件中更明確標記「永遠使用 echo -n」
   - 考慮在代碼中加入環境變數長度檢查，提前發現問題

3. **診斷技巧**
   - 檢查環境變數更新時間（`vercel env ls`）
   - 查看歷史記錄（ISSUELOG.md 和 git log）
   - 用戶確認測試環境憑證

### 相關 Commits
- 待提交：修正環境變數換行符問題

### 待辦事項
- [ ] 驗證訂閱流程是否正常
- [ ] 考慮在代碼中加入環境變數長度檢查
- [ ] 更新部署文件，強調使用 `echo -n` 的重要性

---

## 2025-11-06: 修復批次刪除 Pending 任務功能

### 問題描述
文章管理介面的批次刪除功能存在問題：
- 單篇文章刪除正常運作
- 批次刪除按鈕點擊後顯示「已清除 0 個任務」
- Pending 狀態任務無法被批次清除，介面持續顯示轉圈

### 根本原因
1. **前端確認訊息不準確**：使用 `jobs.length` 包含了所有狀態的任務，而非只計算待刪除的任務
2. **API 缺少診斷訊息**：當刪除數量為 0 時沒有提供詳細的診斷資訊
3. **日誌記錄不完整**：刪除前後沒有記錄足夠的資訊來追蹤問題

### 解決方案

#### 1. 前端修改 (`src/app/(dashboard)/dashboard/articles/page.tsx`)
- 新增過濾邏輯：只計算非 `completed` 狀態的任務
- 改進確認訊息：顯示實際待刪除的任務數量
- 增強日誌：記錄待刪除任務的 ID 和狀態
- 改進回應處理：區分刪除數量為 0 和刪除成功的情況

#### 2. 後端增強 (`src/app/api/articles/jobs/clear/route.ts`)
- 刪除前查詢驗證：先查詢符合條件的任務並記錄
- 提前返回機制：當沒有任務需要刪除時，返回診斷訊息
- 選擇欄位擴充：刪除時同時選擇 `id` 和 `status` 以提供更多資訊
- 一致性檢查：比對查詢數量與實際刪除數量，不一致時發出警告
- 詳細日誌：記錄刪除的任務 ID 列表

### 驗證結果
- ✅ 建置成功無 TypeScript 錯誤
- ✅ 批次刪除確認訊息顯示正確數量
- ✅ API 提供詳細的診斷資訊
- ✅ 日誌完整記錄操作流程

### 影響檔案
- `src/app/(dashboard)/dashboard/articles/page.tsx:127-177` (前端介面)
- `src/app/api/articles/jobs/clear/route.ts:41-91` (批次刪除 API)

### OpenSpec 提案
- Change ID: `fix-batch-delete-pending-jobs`
- Status: ✅ 已實作並驗證

---

## 2025-11-04: 訂閱升級規則系統實作

### 實作內容
- **目標**: 實作完整的訂閱升級規則驗證系統
- **範圍**: 階層定義修正、終身方案升級、跨階層計費週期規則、後端 API 驗證

### 關鍵修正

#### 1. 階層定義修正
**問題**: 代碼中的階層順序與實際定價不符
- **錯誤順序**: Starter (1) < Business (2) < Professional (3) < Agency (4)
- **正確順序**: Starter (1) < Professional (2) < Business (3) < Agency (4)
- **實際定價**: NT$599 < NT$2,499 < NT$5,999 < NT$11,999

**修正**:
```typescript
export const TIER_HIERARCHY: Record<string, number> = {
  'starter': 1,
  'professional': 2,  // 從 3 改為 2
  'business': 3,      // 從 2 改為 3
  'agency': 4,
}
```

#### 2. 終身方案升級規則
**新增規則**:
- ✅ **允許**: 終身 Starter → 終身 Professional/Business/Agency
- ✅ **允許**: 終身 Professional → 終身 Business/Agency
- ✅ **允許**: 終身 Business → 終身 Agency
- ❌ **不允許**: 終身方案 → 月繳/年繳方案（任何階層）
- ❌ **不允許**: 終身方案降級（如：終身 Business → 終身 Starter）

**實作邏輯**:
```typescript
if (currentBillingPeriod === 'lifetime') {
  // 允許升級到更高階層的終身方案
  if (targetTierLevel > currentTierLevel && targetBillingPeriod === 'lifetime') {
    return true
  }
  // 其他情況都不允許
  return false
}
```

#### 3. 跨階層計費週期規則
**新增規則**:
- ✅ **允許**: 階層提升 + 計費週期延長（如：月繳 Starter → 年繳 Business）
- ✅ **允許**: 階層提升 + 計費週期相同（如：年繳 Professional → 年繳 Agency）
- ❌ **不允許**: 階層提升 + 計費週期縮短（如：年繳 Starter → 月繳 Agency）

**實作邏輯**:
```typescript
if (targetTierLevel > currentTierLevel) {
  // 計費週期不能縮短
  if (isBillingPeriodShorter(currentBillingPeriod, targetBillingPeriod)) {
    return false
  }
  return true
}
```

#### 4. 輔助函式
新增 `isBillingPeriodShorter()` 函式比較計費週期：
```typescript
function isBillingPeriodShorter(
  current: BillingPeriod,
  target: BillingPeriod
): boolean {
  const periodValue: Record<BillingPeriod, number> = {
    'monthly': 1,
    'yearly': 2,
    'lifetime': 3
  }
  return periodValue[target] < periodValue[current]
}
```

#### 5. 後端 API 驗證
在 `/api/payment/recurring/create` 加入升級規則驗證：
```typescript
// 查詢當前訂閱狀態
const { data: company } = await authClient
  .from('companies')
  .select('subscription_tier, subscription_period')
  .eq('id', companyId)
  .single()

// 驗證升級規則
if (!canUpgrade(currentTierSlug, currentBillingPeriod, plan.slug, targetBillingPeriod)) {
  const reason = getUpgradeBlockReason(currentTierSlug, currentBillingPeriod, plan.slug, targetBillingPeriod)
  return NextResponse.json({ error: reason || '無法升級到此方案' }, { status: 400 })
}
```

### 升級規則矩陣

| 當前方案 | 當前週期 | 目標方案 | 目標週期 | 允許？ | 規則 |
|---------|---------|---------|---------|-------|------|
| Starter | 月繳 | Professional | 年繳 | ✅ | 跨階層延長 |
| Starter | 月繳 | Business | 月繳 | ✅ | 跨階層同週期 |
| Starter | 年繳 | Professional | 月繳 | ❌ | 跨階層縮短 |
| Starter | 終身 | Professional | 終身 | ✅ | 終身跨階層升級 |
| Starter | 終身 | Professional | 年繳 | ❌ | 終身不能縮短週期 |
| Professional | 月繳 | Professional | 年繳 | ✅ | 同階層延長 |
| Professional | 年繳 | Professional | 月繳 | ❌ | 同階層縮短 |
| Business | 終身 | Starter | 終身 | ❌ | 不能降級 |

### 錯誤訊息

更新 `getUpgradeBlockReason()` 提供友善的錯誤訊息：
- 「終身方案不能變更為月繳或年繳」
- 「跨階層升級不能縮短計費週期」
- 「無法降級到低階層方案」
- 「年繳無法變更為月繳」
- 「目前方案」

### 技術細節

#### 修改的檔案
1. `src/lib/subscription/upgrade-rules.ts`
   - 修正 `TIER_HIERARCHY` 階層定義
   - 新增 `isBillingPeriodShorter()` 輔助函式
   - 重構 `canUpgrade()` 邏輯
   - 更新 `getUpgradeBlockReason()` 錯誤訊息

2. `src/app/api/payment/recurring/create/route.ts`
   - 加入 `canUpgrade` 和 `getUpgradeBlockReason` import
   - 查詢當前公司訂閱狀態
   - 在建立訂單前驗證升級規則
   - 返回友善的錯誤訊息

3. OpenSpec 文件
   - `openspec/changes/implement-subscription-upgrade-rules/proposal.md`
   - `openspec/changes/implement-subscription-upgrade-rules/specs/subscription-upgrade-validation/spec.md`
   - `openspec/changes/implement-subscription-upgrade-rules/tasks.md`

#### 驗證結果
- ✅ TypeScript 類型檢查通過 (`npm run type-check`)
- ✅ Next.js 建置成功 (`npm run build`)
- ✅ 前端 pricing page 已正確使用共用升級規則
- ✅ 後端 API 已加入升級驗證

### 經驗教訓

1. **階層定義要與實際定價一致**
   - 代碼中的邏輯順序必須反映真實的產品階層
   - 錯誤的階層定義會導致升級/降級判斷錯誤

2. **終身方案需要特殊處理**
   - 終身方案可以升級，但有嚴格限制
   - 不能縮短計費週期，不能降級

3. **跨階層升級要考慮計費週期**
   - 不能單純允許所有階層提升
   - 必須確保計費週期不縮短

4. **前後端共用驗證邏輯**
   - 使用相同的 `upgrade-rules.ts` 模組
   - 確保前端顯示和後端驗證一致
   - 避免「前端顯示可升級但後端拒絕」的情況

5. **友善的錯誤訊息**
   - 針對不同情況提供具體的錯誤原因
   - 幫助用戶理解為什麼不能升級

### 相關 Commits
- `ede9b55`: 實作: 完整的訂閱升級規則驗證系統

---

## 2025-11-04: Token 包購買「找不到訂單」問題

### 問題現象
- **症狀**: Token 包購買後，藍新金流回調時報錯「找不到訂單」
- **影響範圍**: 所有單次購買（token 包、終身方案）
- **正常功能**: 定期定額訂閱正常運作

### 錯誤日誌
```
[API Callback] 付款處理失敗: 找不到訂單
訂單已建立: ORD17621952148816159
回調時間差: 22-28 秒
```

### 根本原因分析

#### 調查過程
1. **初步假設**: 資料庫複製延遲
   - ❌ 已有 20 次重試機制，應該足夠

2. **第二假設**: 藍新金流回調格式問題
   - ❌ 解密邏輯正常，定期定額使用相同邏輯成功

3. **第三假設**: 訂單查詢邏輯問題
   - ❌ 查詢邏輯與定期定額相同

4. **最終發現**: **Supabase Client 類型錯誤** ✅

#### 關鍵發現

比對兩個回調路由的代碼：

| 路由 | 使用的 Client | 是否受 RLS 限制 | 結果 |
|------|--------------|----------------|------|
| `/api/payment/recurring/callback` | `createAdminClient()` | ❌ 否 | ✅ 成功 |
| `/api/payment/callback` | `createClient()` | ✅ 是 | ❌ 失敗 |
| `/api/payment/notify` | `createClient()` | ✅ 是 | ❌ 失敗 |

**問題核心**：
- 藍新金流的回調請求**沒有使用者 session**
- `createClient()` 需要使用者 session 才能通過 RLS (Row Level Security)
- `createAdminClient()` 使用 Service Role Key，**繞過 RLS**
- 定期定額一開始就用對了，所以正常
- 單次購買用錯了，所以失敗

### 修正方案

**修改檔案**:
1. `src/app/api/payment/callback/route.ts`
   - 將 `createClient()` 改為 `createAdminClient()`
   - 移除 `await`（Admin client 是同步的）

2. `src/app/api/payment/notify/route.ts`
   - 將 `createClient()` 改為 `createAdminClient()`
   - 移除 `await`

**程式碼變更**:
```typescript
// 修正前 (錯誤)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// 修正後 (正確)
import { createAdminClient } from '@/lib/supabase/server'
const supabase = createAdminClient()
```

### 經驗教訓

1. **外部回調必須使用 Admin Client**
   - 所有來自第三方服務（藍新金流、Line Notify 等）的回調
   - 都沒有使用者 session
   - 必須使用 `createAdminClient()` 繞過 RLS

2. **比對成功案例是關鍵**
   - 定期定額成功 vs token 包失敗
   - 兩者邏輯幾乎相同，差異就在 client 類型
   - 系統性比對找出差異比盲目猜測更有效

3. **日誌的重要性**
   - 詳細的日誌幫助縮小範圍
   - 但有時問題不在日誌顯示的地方
   - 需要從架構層面思考

### 預防措施

1. **建立檢查清單**: 所有 webhook/callback 路由都應使用 Admin Client
2. **代碼審查**: 在 PR 中檢查 payment 相關路由的 client 類型
3. **測試覆蓋**: 為單次購買和定期定額都建立 E2E 測試

### 相關 Commits
- `85ccc47`: 修正: 單次購買公司查詢失敗 - 加入重試機制和診斷日誌（這個其實沒解決問題，但有助於診斷）
- `e081fb9`: 修正: 單次購買回調使用 Admin Client 繞過 RLS（部分修正，但還有問題）
- `65d3b7d`: 診斷: 加入詳細日誌以診斷單次購買解密問題
- 下一個 commit: 修正: 單次購買支援 JSON 格式解析

---

## 2025-11-04: 支付加密「Invalid initialization vector」錯誤

### 問題現象
- **症狀**: 所有支付操作（單次購買和定期定額訂閱）都失敗，報錯 `TypeError: Invalid initialization vector`
- **影響範圍**: 整個支付系統完全無法運作
- **錯誤代碼**: `ERR_CRYPTO_INVALID_IV`

### 錯誤日誌
```
2025-11-04 08:34:50.187 [error] [API] 建立定期定額支付失敗: TypeError: Invalid initialization vector
    at f.aesEncrypt (.next/server/chunks/9366.js:1:1019)
    at f.createRecurringPayment (.next/server/chunks/9366.js:1:2956)
    code: 'ERR_CRYPTO_INVALID_IV'
```

### 根本原因分析

#### 調查過程
1. **初步假設**: Pricing 頁面代碼修改導致
   - 使用者報告：早上正常運作，改升級邏輯後失敗
   - ❌ 檢查 git 歷史：只有邏輯修改，沒有加密代碼變更

2. **檢查代碼修改歷史**:
   - `b7b5a41`: 修正 payment_orders.mandate_id
   - `6d6a460`: 修正 Pricing 顯示錯誤狀態
   - `9c4b16c`: 實作訂閱升級規則驗證系統
   - ✅ 都是業務邏輯，沒有碰觸加密

3. **驗證密鑰長度**:
   ```bash
   node -e "console.log(Buffer.from('7hyqDDb3qQmHfz1BDF5FqYtdlshGAvPQ').length)"  # 32 ✅
   node -e "console.log(Buffer.from('CGFoFgbiAPYMbSlP').length)"  # 16 ✅
   ```

4. **本地加密測試**:
   ```typescript
   const crypto = require('crypto');
   const cipher = crypto.createCipheriv(
     'aes-256-cbc',
     Buffer.from('7hyqDDb3qQmHfz1BDF5FqYtdlshGAvPQ', 'utf8'),
     Buffer.from('CGFoFgbiAPYMbSlP', 'utf8')
   );
   // ✅ 本地測試成功
   ```

5. **最終發現**: **Vercel 環境變數損壞** ✅
   - 環境變數可能包含空格、換行符或編碼問題
   - 儘管 Vercel Dashboard 顯示已加密，實際值可能損壞
   - 與代碼修改時間點重疊純屬巧合

#### 關鍵發現

| 項目 | 狀態 | 說明 |
|------|------|------|
| 密鑰長度 | ✅ 正確 | HashKey=32 bytes, HashIV=16 bytes |
| 本地測試 | ✅ 成功 | 使用相同密鑰加密成功 |
| 代碼修改 | ✅ 無關 | 只有業務邏輯修改 |
| 環境變數 | ❌ 損壞 | Vercel 上的值可能包含隱藏字元 |

**為什麼環境變數會損壞？**
- 可能在設定時意外複製了空格或換行符
- 可能編碼方式不正確
- Vercel CLI 的 `vercel env add` 如果不用 `echo -n`，會自動加上換行符

### 修正方案

#### 清除並重新設定環境變數
使用 `echo -n` 確保沒有尾隨換行符：

```bash
# 1. 移除舊的環境變數
vercel env rm NEWEBPAY_HASH_KEY production --scope acejou27s-projects --yes
vercel env rm NEWEBPAY_HASH_IV production --scope acejou27s-projects --yes

# 2. 使用 echo -n 重新設定（避免換行符）
echo -n "7hyqDDb3qQmHfz1BDF5FqYtdlshGAvPQ" | vercel env add NEWEBPAY_HASH_KEY production --scope acejou27s-projects
echo -n "CGFoFgbiAPYMbSlP" | vercel env add NEWEBPAY_HASH_IV production --scope acejou27s-projects

# 3. 觸發重新部署
vercel --prod --scope acejou27s-projects --yes
```

### 測試結果
✅ **2025-11-04 修正成功**
- 重新設定環境變數後立即正常
- Token 包購買功能正常
- 定期定額訂閱功能正常
- 加密/解密正常運作

### 經驗教訓

1. **環境變數設定要小心**
   - 永遠使用 `echo -n` 避免尾隨換行符
   - 驗證環境變數長度（在部署後使用 `wrangler` 或 Vercel CLI 檢查）
   - 不要直接從編輯器複製貼上（可能包含隱藏字元）

2. **錯誤診斷要系統性**
   - 即使使用者報告與代碼修改時間點重疊，也要驗證因果關係
   - 本地測試成功 + 線上失敗 = 環境問題，而非代碼問題
   - 比對成功的部分（本地）和失敗的部分（線上）找出差異

3. **AES-256-CBC 加密要求**
   - Key 必須**完全** 32 bytes（不能多也不能少）
   - IV 必須**完全** 16 bytes（不能多也不能少）
   - 任何多餘的空格、換行符都會導致長度不正確

4. **時間點巧合的陷阱**
   - 使用者報告「改完代碼後就壞了」不代表是代碼問題
   - 可能是環境變數在同一時間點被意外修改
   - 需要獨立驗證每個可能的原因

### 預防措施

1. **環境變數設定標準流程**:
   ```bash
   # 永遠使用這種方式設定
   echo -n "YOUR_VALUE" | vercel env add VAR_NAME production

   # 不要使用這種方式（會加換行符）
   vercel env add VAR_NAME production
   # 然後手動輸入值 ❌
   ```

2. **部署後驗證**:
   ```bash
   # 檢查環境變數是否正確設定
   vercel env ls production --scope your-scope

   # 測試關鍵功能
   curl -X POST https://your-domain.com/api/payment/test
   ```

3. **監控和告警**:
   - 設定 Vercel 或 Sentry 監控加密錯誤
   - 關鍵環境變數修改時發送通知

### 相關檔案
- `src/lib/payment/newebpay-service.ts:51-60` - AES 加密函式
- `src/lib/payment/newebpay-service.ts:298-316` - 環境變數載入

### 相關 Commits
- 將在下一個 commit 中記錄此修復

---

## 2025-11-04: Token 包購買「orderNo 為 undefined」問題（續）

### 新發現的問題
使用 Admin Client 後，RLS 問題解決了，但仍然「找不到訂單」。

### 根本原因
通過詳細日誌發現：

**藍新金流單次購買回傳 JSON 格式**：
```json
{
  "Status": "SUCCESS",
  "Message": "授權成功",
  "Result": {
    "MerchantOrderNo": "ORD17622286946227218",
    "TradeNo": "25110411582872444",
    "Amt": 1299,
    ...
  }
}
```

**但 `decryptCallback` 使用 URLSearchParams 解析**：
```typescript
const params = new URLSearchParams(decryptedData)  // ❌ 錯誤
// 結果: 整個 JSON 字串變成一個 key
{
  "{\"Status\":\"SUCCESS\",...}": 0
}
```

**所以**：
- `decryptedData.MerchantOrderNo` = `undefined` ❌
- `decryptedData.Status` = `undefined` ❌
- 無法取得任何資料

**為什麼定期定額沒問題？**
```typescript
decryptPeriodCallback(period: string) {
  try {
    return JSON.parse(decryptedData)  // ✅ 先嘗試 JSON
  } catch {
    // 失敗才用 URLSearchParams
  }
}
```

### 修正方案
將 `decryptCallback` 改成和 `decryptPeriodCallback` 相同的邏輯：
1. 先嘗試 `JSON.parse()`
2. 失敗才用 `URLSearchParams`（向後兼容）

修改 `handleOnetimeCallback` 處理兩種格式：
1. JSON 格式（有 Result 物件）
2. URLSearchParams 格式（扁平結構）

### 測試結果
✅ **2025-11-04 測試成功**
- 使用者購買 token 包
- 藍新金流回調正常
- 訂單成功查詢並更新
- Token 正確發放
- 定期定額訂閱依然正常運作

### 相關 Commits
- `b251417`: 修正: 藍新金流單次付款格式兼容 - 支援 JSON 和扁平格式

---
