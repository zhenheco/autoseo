# 聯盟行銷系統開發狀態

## 🌿 分支狀態

### ✅ 舊分支：`claude/affiliate-marketing-system-011CUq3gnVQYreQsEVhLV5jQ`

**狀態**: 已合併 (Merged)

**包含功能**:

1. ✅ 完整的前端頁面（5個頁面）
   - 申請頁面
   - 主儀表板（含最近推薦客戶）
   - 推薦客戶列表
   - 佣金記錄
   - 提領申請
   - 提領記錄

2. ✅ 完整的後端 API
   - POST /api/affiliate/apply
   - GET /api/affiliate/stats
   - GET /api/affiliate/referrals
   - GET /api/affiliate/commissions
   - POST /api/affiliate/withdraw
   - GET /api/affiliate/withdraw

3. ✅ 資料庫 Migration
   - 使用 ALTER TABLE 保留現有資料
   - 添加所有必要欄位
   - 創建必要的函數

4. ✅ 稅務須知和服務條款頁面
   - /dashboard/affiliate/tax-notice
   - /dashboard/affiliate/terms

5. ✅ TypeScript 修復
   - 修復所有 `NextRequest.ip` 錯誤
   - 使用 `x-forwarded-for` 和 `x-real-ip` headers

**最後提交**: `6691e84` - fix: 更新聯盟行銷服務條款聯絡資訊

---

### 🚀 新分支：`claude/affiliate-webhook-automation-011CUq3gnVQYreQsEVhLV5jQ`

**狀態**: 待合併 (Pending PR)

**基於**: 舊分支的最新提交 `6691e84`

**新增功能**:

1. ✅ NewebPay Webhook 整合
   - 支付成功後自動計算並創建佣金
   - 僅針對訂閱付款（Token 包不計算）
   - 異步處理，不影響支付流程
   - 詳細日誌記錄

2. ✅ Vercel Cron Jobs 配置
   - unlock-commissions: 每小時執行（0 \* \* \* \*）
   - check-inactive-affiliates: 每日凌晨 2 點（0 2 \* \* \*）
   - CRON_SECRET 保護

**提交**: `6678c2b` - feat: 整合聯盟行銷佣金自動化系統

**待實作功能**:

- ⏳ 證件上傳功能（Supabase Storage）
- ⏳ Email 通知（申請成功、佣金解鎖、提領完成）
- ⏳ 管理後台（審核提領、查看所有夥伴）

---

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

---

## 📊 系統配置

| 項目         | 設定值         |
| ------------ | -------------- |
| 佣金比例     | 20%            |
| 鎖定期       | 30 天          |
| 最低提領金額 | NT$1,000       |
| 不活躍期限   | 3 個月無新客戶 |
| Cookie 期限  | 30 天          |
| 居民稅率     | 10%            |
| 非居民稅率   | 20%            |

---

## 🐛 已修復的問題

1. ✅ `NextRequest.ip` TypeScript 錯誤
   - 改用 `x-forwarded-for` 和 `x-real-ip` headers
   - 兩處修復：logTrackingEvent 和 getClientIp

2. ✅ 稅務須知 404 錯誤
   - 創建完整的稅務須知頁面

3. ✅ 缺少服務條款頁面
   - 創建詳細的服務條款頁面

4. ✅ 資料庫欄位不匹配
   - 使用 ALTER TABLE 添加所有缺少欄位
   - 保留現有資料和結構

---

## 📝 下一步計劃

### 🔜 優先級 1：部署新分支

- 創建 Pull Request
- 合併到 main 分支
- 觸發 Vercel 部署

### 🔜 優先級 2：證件上傳功能

- 整合 Supabase Storage
- 上傳身分證明文件
- 上傳銀行存摺影本
- 上傳稅務文件

### 🔜 優先級 3：Email 通知

- 申請成功通知
- 佣金解鎖通知
- 提領完成通知

### 🔜 優先級 4：管理後台

- 審核提領申請
- 查看所有聯盟夥伴
- 手動調整佣金

---

## 🎯 技術棧

- **框架**: Next.js 15 (App Router)
- **資料庫**: Supabase (PostgreSQL)
- **UI**: shadcn/ui + Tailwind CSS
- **語言**: TypeScript
- **部署**: Vercel
- **Cron**: Vercel Cron Jobs
- **支付**: NewebPay

---

## 📞 聯絡資訊

- **Email**: service@zhenhe-co.com
- **管轄法院**: 桃園地方法院

---

**最後更新**: 2025-01-06
**版本**: 2.0.0 (含自動化)
