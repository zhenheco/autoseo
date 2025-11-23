# 重構終身定價方案（Restructure Lifetime Pricing）

## 概述（Overview）

本提案旨在全面重構 AutoPilot SEO 的定價策略，從混合月費/年費/終身方案轉為純終身定價模型。此變更基於 2025 年 SaaS 定價最佳實踐，參考 AppSumo、OpenAI、Intercom、Google Cloud 等業界標準，以提供更清晰的價值主張並簡化購買流程。

## 動機（Motivation）

### 當前問題

1. **定價複雜度過高**
   - 同時提供月費、年費、終身三種計費模式
   - 用戶難以比較不同方案的實際價值
   - 增加系統維護複雜度（需處理訂閱續約、週期計費等）

2. **價值曲線不明確**
   - Token 配額在各方案間的倍增關係不明確
   - 缺乏清晰的升級動機和錨定效應
   - 終身價格與月費/年費之間的對應關係模糊

3. **客服支援層級缺失**
   - 現有系統未明確區分不同方案的客服等級
   - 缺少專屬客戶經理、優先支援等差異化服務
   - 無法滿足企業客戶對高級支援的需求

4. **前端顯示不一致**
   - 定價頁面與實際資料庫配置可能不同步
   - 硬編碼的價格和功能描述難以維護
   - 缺乏統一的設計系統和組件庫

### 商業目標

1. **簡化定價結構** - 移除月費/年費選項，專注於終身方案
2. **提高 ARPU** - 透過清晰的價值階梯引導用戶升級到更高方案
3. **降低流失率** - 終身方案消除訂閱焦慮，提高用戶留存
4. **標準化客服** - 建立符合業界標準的分層客服體系

## 設計要點（Design Highlights）

### 1. 終身定價結構

| 方案                | 終身價格        | 每月 Credits | 倍增比例 | 目標客群   |
| ------------------- | --------------- | ------------ | -------- | ---------- |
| **FREE**            | NT$ 0           | 10K          | -        | 試用用戶   |
| **STARTER**         | **NT$ 14,900**  | **50K**      | 1×       | 個人創作者 |
| **PROFESSIONAL** ⭐ | **NT$ 59,900**  | **250K**     | 5×       | 專業團隊   |
| **BUSINESS**        | **NT$ 149,900** | **750K**     | 15×      | 中型企業   |
| **AGENCY**          | **NT$ 299,900** | **2,000K**   | 40×      | 大型代理商 |

**定價邏輯**：

- 終身價 ≈ 月度等值 × 12 個月 × 12 年 × 0.8 折扣係數
- Credits 倍增清晰（5×、15×、40×），易於理解和比較
- 使用 xx,900 心理定價，比整數更具吸引力
- PROFESSIONAL 標記為推薦，利用錨定效應

### 2. 客服支援層級

| 層級          | 響應時間 | 渠道         | 適用方案         |
| ------------- | -------- | ------------ | ---------------- |
| **Community** | 無保證   | 論壇/文檔    | FREE             |
| **Standard**  | 48 小時  | Email        | STARTER          |
| **Priority**  | 24 小時  | Email + Chat | PROFESSIONAL     |
| **Dedicated** | 4 小時   | 全渠道 + TAM | BUSINESS, AGENCY |

**TAM（Technical Account Manager）服務包含**：

- 定期業務檢討
- 架構穩定性諮詢
- 優先功能請求處理
- 主動問題預防

### 3. 功能差異化

**關鍵功能限制對照**：

| 功能           | FREE     | STARTER  | PROFESSIONAL | BUSINESS | AGENCY   |
| -------------- | -------- | -------- | ------------ | -------- | -------- |
| WordPress 網站 | 0        | 1        | 5            | 無限     | 無限     |
| 團隊成員       | 1        | 1        | 3            | 10       | 無限     |
| 品牌聲音       | 0        | 1        | 3            | 無限     | 無限     |
| API 存取       | ✗        | ✗        | ✓            | ✓        | ✓        |
| 白標服務       | ✗        | ✗        | ✗            | ✗        | ✓        |
| AI 模型        | DeepSeek | 基礎模型 | 所有模型     | 所有模型 | 所有模型 |

### 4. 前端 UI/UX 改進

**新增組件**：

- `<PricingCard />` - 統一的方案卡片組件
- `<SupportTierBadge />` - 客服等級徽章
- `<FeatureComparison />` - 功能對照表
- `<TokenCalculator />` - Token 使用量計算器

**設計原則**：

- 響應式設計，支援行動裝置
- 清晰的視覺層次和價值主張
- 一鍵購買流程，減少摩擦
- 透明的費用計算和功能說明

## 影響範圍（Impact）

### 資料庫變更

1. **`subscription_plans` 表**
   - 移除 `monthly_price` 和 `yearly_price` 欄位
   - 保留 `lifetime_price` 作為唯一價格欄位
   - 新增 `support_level` 到 `features` JSONB
   - 更新所有現有方案記錄

2. **`company_subscriptions` 表**
   - 將現有月費/年費訂閱轉換為終身方案
   - 更新 `billing_cycle` 為 `lifetime`
   - 保留現有 Token 餘額不變

### API 變更

1. **`/api/payment/create`** - 移除 `billingPeriod` 參數
2. **`/api/subscription/plans`** - 僅返回終身方案資料
3. **`/api/support/tiers`** - 新增客服層級查詢端點

### 前端變更

1. **`src/app/pricing/page.tsx`**
   - 移除計費週期切換器（Monthly/Yearly/Lifetime）
   - 重新設計為純終身方案展示
   - 新增客服層級說明區塊

2. **`src/app/(dashboard)/dashboard/subscription/`**
   - 更新訂閱顯示邏輯（移除到期日、續約等概念）
   - 顯示「終身有效」狀態
   - 新增升級引導（從低階方案到高階方案）

3. **新增配置檔案**
   - `src/config/support-tiers.ts` - 客服層級定義
   - `src/config/lifetime-pricing.ts` - 終身定價配置

### 遷移策略

1. **現有用戶處理**
   - 月費用戶：允許繼續使用至當前週期結束，提供升級至終身方案優惠
   - 年費用戶：按比例退款或轉換為對應終身方案（補差價）
   - 終身用戶：無需變更，享有相同權益

2. **資料遷移順序**
   - Step 1: 備份現有 `subscription_plans` 表
   - Step 2: 執行資料庫遷移腳本
   - Step 3: 驗證資料完整性
   - Step 4: 部署前端變更
   - Step 5: 監控錯誤並回滾（如需要）

## 風險與緩解（Risks & Mitigation）

### 風險 1：現有月費用戶流失

**機率**：中
**影響**：高
**緩解**：提供吸引的轉換優惠（如 50% 折扣），保證現有權益不受影響

### 風險 2：資料遷移錯誤

**機率**：低
**影響**：極高
**緩解**：完整的備份策略、多環境測試、段階段部署

### 風險 3：定價過高導致轉換率下降

**機率**：中
**影響**：中
**緩解**：基於市場研究的定價（AppSumo、OpenAI 等參考），並提供 14 天退款保證

## 成功指標（Success Metrics）

1. **購買轉換率** - 目標：從定價頁到支付完成 ≥ 15%
2. **平均訂單價值（AOV）** - 目標：≥ NT$ 60,000（PROFESSIONAL 為主力）
3. **方案分布**
   - STARTER: 25-30%
   - PROFESSIONAL: 40-45%
   - BUSINESS: 20-25%
   - AGENCY: 5-10%
4. **客服滿意度** - 目標：≥ 4.5/5（付費用戶）

## 後續工作（Follow-up）

1. **Phase 2: A/B 測試不同定價點**
2. **Phase 3: 企業定制方案（Enterprise Custom）**
3. **Phase 4: 推薦計畫（Referral Program）**
4. **Phase 5: 使用量分析儀表板（Usage Analytics Dashboard）**

## 相關文件（Related Documents）

- 詳細計畫：`/plan/lifetime-pricing-restructure.md`
- 現有規格：
  - `openspec/specs/payment-processing/`
  - `openspec/specs/subscription-display/`
- 資料庫 Schema：`src/types/database.types.ts`
