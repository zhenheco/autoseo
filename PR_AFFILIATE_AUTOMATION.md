# Pull Request: 聯盟行銷佣金自動化系統

## 🔗 GitHub PR 連結

請前往以下連結創建 Pull Request：

```
https://github.com/acejou27/Auto-pilot-SEO/compare/main...claude/affiliate-webhook-automation-011CUq3gnVQYreQsEVhLV5jQ
```

---

## 📋 PR 標題

```
feat: 聯盟行銷佣金自動化系統
```

---

## 📝 PR 說明（完整內容）

請將以下內容複製到 PR Description：

```markdown
## 📋 摘要

此 PR 整合聯盟行銷系統的佣金自動化功能，包含 NewebPay Webhook 整合和 Vercel Cron Jobs 配置。此分支基於舊分支 `claude/affiliate-marketing-system-011CUq3gnVQYreQsEVhLV5jQ` 的最新提交（已合併），包含所有先前的修復和改進。

## ✨ 新增功能

### 1. NewebPay Webhook 整合

- ✅ 支付成功後自動計算並創建佣金
- ✅ 僅針對訂閱付款計算（Token 包不計算）
- ✅ 異步處理，不影響支付流程
- ✅ 詳細日誌記錄

**修改檔案**: `src/app/api/payment/recurring/callback/route.ts`

### 2. Vercel Cron Jobs 配置

- ✅ `unlock-commissions`: 每小時執行（0 \* \* \* \*）
- ✅ `check-inactive-affiliates`: 每日凌晨 2 點執行（0 2 \* \* \*）
- ✅ CRON_SECRET 保護機制

**新增檔案**: `vercel.json` 新增 crons 配置

### 3. 開發狀態文檔

- ✅ 詳細記錄兩個分支的功能清單
- ✅ 完整的工作流程圖
- ✅ 系統配置說明
- ✅ 已修復問題列表
- ✅ 下一步計劃

**新增檔案**: `AFFILIATE_DEVELOPMENT_STATUS.md`

## 🔧 包含的修復（來自已合併的舊分支）

### TypeScript 修復

- ✅ 修復 `NextRequest.ip` 屬性不存在的錯誤
- ✅ 使用 `x-forwarded-for` 和 `x-real-ip` headers 取得 IP
- ✅ 修復位置：`src/lib/affiliate/tracking.ts` 和 `src/app/api/affiliate/track/route.ts`

### 功能改進

- ✅ 新增完整的稅務須知頁面（`/dashboard/affiliate/tax-notice`）
- ✅ 新增詳細的服務條款頁面（`/dashboard/affiliate/terms`）
- ✅ 整合推薦客戶到主儀表板（顯示最近 5 筆推薦）
- ✅ 修正聯絡資訊（管轄法院：桃園地方法院，Email: service@zhenhe-co.com）

## 🔄 完整工作流程
```

客戶點擊推薦連結
↓ Cookie 記錄 30 天
註冊並創建公司
↓ 記錄 referred_by_affiliate_code
訂閱付款成功
↓ ✨ Webhook 自動創建佣金 (locked, 30 天)
↓ ⏰ Cron Job 每小時檢查
30 天後解鎖
↓ 狀態變更為 available
聯盟夥伴申請提領
↓ 最低 NT$1,000
審核通過後撥款
↓ 自動扣除稅款
↓ ⏰ Cron Job 每日檢查
3 個月無新客戶
↓ 標記為 inactive
停止所有佣金發放

```

## 📊 系統配置

| 項目 | 設定值 |
|------|--------|
| 佣金比例 | 20% |
| 鎖定期 | 30 天 |
| 最低提領金額 | NT$1,000 |
| 不活躍期限 | 3 個月無新客戶 |
| Cookie 期限 | 30 天 |
| 居民稅率 | 10% |
| 非居民稅率 | 20% |

## 🧪 測試計劃

### 必須測試項目

- [ ] **訂閱支付流程測試**
  - [ ] 使用推薦連結註冊新用戶
  - [ ] 完成訂閱付款
  - [ ] 確認 webhook 自動創建佣金記錄（狀態為 locked）
  - [ ] 確認聯盟夥伴的 `locked_commission` 正確增加

- [ ] **Token 包測試**
  - [ ] 使用推薦連結註冊新用戶
  - [ ] 購買 Token 包
  - [ ] 確認**不會**創建佣金記錄

- [ ] **前端頁面測試**
  - [ ] 訪問稅務須知頁面 `/dashboard/affiliate/tax-notice`
  - [ ] 訪問服務條款頁面 `/dashboard/affiliate/terms`
  - [ ] 確認主儀表板顯示最近推薦客戶
  - [ ] 確認聯絡資訊正確（service@zhenhe-co.com）

- [ ] **Cron Jobs 測試**（部署到 Vercel 後）
  - [ ] 確認 Vercel Dashboard 中 Cron Jobs 正確配置
  - [ ] 在 Vercel Logs 中確認 cron 執行成功
  - [ ] 手動觸發 `/api/cron/unlock-commissions` 確認佣金解鎖邏輯
  - [ ] 手動觸發 `/api/cron/check-inactive-affiliates` 確認不活躍檢查邏輯

- [ ] **佣金鎖定期測試**
  - [ ] 創建測試佣金並手動修改 `unlock_at` 為過去時間
  - [ ] 執行 unlock-commissions API
  - [ ] 確認佣金狀態從 `locked` 變為 `available`
  - [ ] 確認聯盟夥伴的 `pending_commission` 正確更新

- [ ] **建置測試**
  - [ ] `npm run build` 成功完成
  - [ ] 無 TypeScript 錯誤
  - [ ] 無 ESLint 警告

## 📝 部署後環境變數確認

請確認 Vercel 環境變數包含：
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `CRON_SECRET`（用於保護 Cron Jobs）

## 📎 相關文檔

- 詳細開發狀態：`AFFILIATE_DEVELOPMENT_STATUS.md`
- 系統類型定義：`src/types/affiliate.types.ts`
- 資料庫結構驗證：`supabase/migrations/verify_structure.sql`

## ⏭️ 後續計劃

1. 證件上傳功能（Supabase Storage）
2. Email 通知（申請成功、佣金解鎖、提領完成）
3. 管理後台（審核提領、查看所有夥伴）

---

**🤖 Generated with [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 📦 分支資訊

- **來源分支**: `claude/affiliate-webhook-automation-011CUq3gnVQYreQsEVhLV5jQ`
- **目標分支**: `main`
- **最新提交**: `a9d9480` - docs: 新增聯盟行銷系統開發狀態文檔

---

## 🚀 創建 PR 步驟

1. 點擊上方的 GitHub PR 連結
2. 確認分支選擇正確：
   - base: `main`
   - compare: `claude/affiliate-webhook-automation-011CUq3gnVQYreQsEVhLV5jQ`
3. 填入 PR 標題（如上）
4. 複製並貼上完整的 PR 說明
5. 點擊 "Create pull request"

---

## ✅ Pre-merge 檢查清單

在合併前，請確認：

- [ ] 所有 CI/CD 檢查通過
- [ ] Vercel 預覽部署成功
- [ ] 代碼審查完成
- [ ] 已測試核心功能（至少測試訂閱支付流程）
- [ ] 已確認 Vercel 環境變數設定正確
