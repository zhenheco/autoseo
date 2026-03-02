# Dashboard 統計與訂閱流程完整修復計劃

## 📋 執行概述

本文檔記錄了 Dashboard 統計數據動態化和訂閱流程月繳修正的完整實施計劃。

**創建日期**: 2025-11-11
**狀態**: 待執行

---

## 🎯 核心問題分析

### 問題 1：Dashboard 統計數據硬編碼

- **現況**: 總文章數（24）和網站數量（3）使用硬編碼值
- **問題**: Credit 餘額卡片整個都是可點擊按鈕
- **期望**: 數值從資料庫動態讀取，餘額卡片變為純顯示（不可點擊）

### 問題 2：升級流程錯誤配置

**根本原因**：

- 當前配置為 `periodType: 'Y'`（年繳）
- 但 `periodPoint: '1'` 不符合年繳格式（應為 `MM,DD`）
- PAYUNi（統一金流）回傳錯誤：「**年期授權時間資料不正確，無該日期**」

**用戶期望**：月繳 12 期方案

---

## 📚 PAYUNi（統一金流） API 參數說明（官方文件）

### PeriodType (週期類別)

- `D` = 固定天期
- `W` = 每週
- `M` = 每月
- `Y` = 每年

### PeriodPoint (交易週期授權時間)

根據 `PeriodType` 不同而有不同格式：

- `PeriodType = D`: 數字 2~999
- `PeriodType = W`: 數字 1~7（週一至週日）
- `PeriodType = M`: 數字 01~31（每月 1 號~31 號）
- `PeriodType = Y`: 格式為 `MMDD`（例如 `1231` 表示 12/31）

### PeriodTimes (授權期數)

- 授權期數
- 授權期數大於信用卡到期日，系統自動以信用卡到期日為最終期數

### 月繳 12 期的正確參數範例

```javascript
{
  PeriodType: "M",           // 每月
  PeriodPoint: "15",         // 每月 15 號扣款（使用授權當天日期）
  PeriodTimes: 12,           // 12 期
  PeriodAmt: 999,            // 每期金額（月費）
  PeriodStartType: 2,        // 立即執行委託金額授權
  ProdDesc: "訂閱方案 - 月繳（12期）"
}
```

---

## 📁 完整修改清單

### 第一部分：Dashboard 統計數據動態化

#### 1. `/src/components/dashboard/TokenBalanceCard.tsx`

**目標**: 移除點擊功能，變為純顯示卡片

**修改內容**:

- ❌ 移除 `<Link href="/dashboard/subscription">` 包裝
- ✅ 改為 `<div>`
- ❌ 移除 hover 效果（`hover:bg-accent`, `cursor-pointer` 等）
- ✅ 保持數值從 API 讀取的邏輯
- ✅ 保持文字硬編碼（"Credit 餘額"）

**預期結果**: 卡片變為純顯示，無法點擊

---

#### 2. `/src/app/(dashboard)/dashboard/page.tsx`

**目標**: 文章數和網站數改為從資料庫動態讀取

**新增資料庫查詢邏輯**:

```typescript
// 在 Server Component 中新增查詢
export default async function DashboardPage() {
  await checkPagePermission('canAccessDashboard')

  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // 獲取公司 ID
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  let articlesCount = 0
  let websitesCount = 0

  if (membership) {
    // 查詢總文章數
    const { count: articlesCountResult } = await supabase
      .from('generated_articles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', membership.company_id)

    articlesCount = articlesCountResult || 0

    // 查詢網站數量
    const { count: websitesCountResult } = await supabase
      .from('website_configs')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', membership.company_id)
      .eq('is_active', true)

    websitesCount = websitesCountResult || 0
  }

  return (
    <div className="space-y-6">
      {/* ... */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="總文章數"
          value={articlesCount.toString()}
          icon={FileText}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
        />
        <StatCard
          title="網站數量"
          value={websitesCount.toString()}
          icon={Globe}
          iconBgColor="bg-success/10"
          iconColor="text-success"
        />
        <TokenBalanceCard />
      </div>
    </div>
  )
}
```

**修改重點**:

- ❌ 移除硬編碼的 `"24"` 和 `"3"`
- ✅ 使用 `count: 'exact', head: true` 只獲取數量（不載入完整資料）
- ✅ 文字保持硬編碼（"總文章數", "網站數量"）
- ✅ 數值動態讀取並轉換為字串

---

### 第二部分：訂閱流程改為月繳 12 期

#### 3. `/src/lib/payment/payment-service.ts` (line 146-201)

**目標**: 修改 `createRecurringPayment()` 方法支援月繳

**修改內容**:

```typescript
createRecurringPayment(params: RecurringPaymentParams): {
  merchantId: string
  postData: string
  apiUrl: string
} {
  // 驗證週期類型
  if (params.periodType !== 'M') {
    throw new Error('目前僅支援月繳訂閱（periodType: M）')
  }

  // 驗證 periodPoint 格式（月繳應為 01-31）
  const periodPoint = params.periodPoint || String(new Date().getDate())
  const periodPointNum = parseInt(periodPoint)
  if (periodPointNum < 1 || periodPointNum > 31) {
    throw new Error('月繳的 periodPoint 必須在 1-31 之間')
  }

  const periodData: Record<string, string> = {
    // ... 其他欄位
    PeriodType: 'M',
    PeriodPoint: periodPoint.padStart(2, '0'), // 確保兩位數格式（01-31）
    PeriodTimes: String(params.periodTimes || 12), // 預設 12 期
    PeriodAmt: String(params.amount), // 每期金額
  }

  // ... 其餘加密邏輯
}
```

**修改重點**:

- ✅ 只接受 `periodType: 'M'`（月繳）
- ✅ `periodPoint` 格式驗證（1-31）
- ✅ 預設 `periodTimes: 12`
- ❌ 移除年繳相關邏輯

---

#### 4. `/src/lib/payment/payment-service.ts` (line 130-244)

**目標**: 修改 `createRecurringPayment()` 介面和邏輯

**修改 Interface**:

```typescript
export interface CreateRecurringOrderParams {
  companyId: string;
  planId: string;
  amount: number;
  description: string;
  email: string;
  periodType: "M"; // 固定為月繳
  periodPoint?: string; // 每月扣款日（1-31），預設為當天
  periodStartType: 1 | 2 | 3;
  periodTimes: number; // 預設 12 期
}
```

**修改實作邏輯**:

```typescript
async createRecurringPayment(params: CreateRecurringOrderParams): Promise<{...}> {
  // 前置驗證
  if (params.periodType !== 'M') {
    throw new Error('目前僅支援月繳訂閱')
  }

  // 計算當天日期作為預設扣款日
  const today = new Date().getDate()
  const periodPoint = params.periodPoint || String(today)

  // 計算總金額（月費 × 期數）
  const totalAmount = params.amount * params.periodTimes

  // 生成委託編號
  const mandateNo = `SUB${Date.now()}${Math.random().toString(36).substr(2, 9)}`

  // 寫入資料庫
  const { data: mandateData, error: mandateError } = await this.supabase
    .from('recurring_mandates')
    .insert({
      company_id: params.companyId,
      subscription_plan_id: params.planId,
      mandate_no: mandateNo,
      period_type: 'M',
      period_point: periodPoint.padStart(2, '0'),
      period_times: params.periodTimes,
      period_amount: params.amount,
      total_amount: totalAmount,
      status: 'pending',
    })
    .select()
    .single()

  if (mandateError) throw mandateError

  // 呼叫金流 API
  const paymentParams: RecurringPaymentParams = {
    orderNo: mandateNo,
    amount: params.amount,
    description: params.description,
    email: params.email,
    periodType: 'M',
    periodPoint: periodPoint,
    periodStartType: params.periodStartType,
    periodTimes: params.periodTimes,
    returnUrl: `${baseUrl}/api/payment/recurring/callback`,
    notifyUrl: `${baseUrl}/api/payment/recurring/notify`,
    clientBackUrl: `${baseUrl}/dashboard/subscription`,
  }

  return this.newebpayService.createRecurringPayment(paymentParams)
}
```

**修改重點**:

- ✅ 固定 `periodType: 'M'`
- ✅ `periodPoint` 預設為當天日期
- ✅ 計算 `total_amount = amount × periodTimes`
- ✅ 資料庫寫入月繳參數

---

#### 5. `/src/app/api/payment/recurring/create/route.ts` (line 6-180)

**目標**: API 層固定月繳參數

**修改內容**:

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId } = body; // 只需要 planId

    // 獲取用戶資訊
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    // 獲取公司 ID
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    const companyId = membership?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "找不到公司資訊" }, { status: 400 });
    }

    // 獲取方案資訊
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "找不到方案" }, { status: 404 });
    }

    // 固定月繳參數
    const today = new Date().getDate();

    const paymentService = new PaymentService();
    const result = await paymentService.createRecurringPayment({
      companyId,
      planId,
      amount: plan.price, // 使用月費
      description: `${plan.name} 月繳方案（12期）`,
      email: user.email || "",
      periodType: "M", // 固定月繳
      periodPoint: String(today), // 使用當天日期
      periodStartType: 2, // 立即執行委託金額授權
      periodTimes: 12, // 固定 12 期
    });

    return NextResponse.json({
      success: true,
      paymentForm: result,
    });
  } catch (error) {
    console.error("創建訂閱失敗:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "創建訂閱失敗" },
      { status: 500 },
    );
  }
}
```

**修改重點**:

- ✅ API 只接受 `planId` 參數
- ✅ 內部固定所有月繳參數
- ✅ 使用 `plan.price`（月費）
- ✅ 描述改為「月繳方案（12期）」
- ❌ 移除前端傳入的 `periodType`, `periodPoint`, `periodTimes` 參數

---

#### 6. `/src/components/dashboard/UpgradePromptCard.tsx` (line 63-144)

**目標**: 簡化升級邏輯，只傳 planId

**修改 `handleUpgrade()` 函數**:

```typescript
const handleUpgrade = async (
  planSlug: string,
  yearlyPrice: number,
  planName: string,
) => {
  try {
    setProcessingSlug(planSlug);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login?redirect=/dashboard");
      return;
    }

    // 獲取方案 ID
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("slug", planSlug)
      .single();

    if (!plan) {
      alert("找不到方案資訊");
      return;
    }

    // 簡化請求，參數由後端控制
    const response = await fetch("/api/payment/recurring/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "支付請求失敗");
    }

    if (data.paymentForm) {
      const formData = {
        apiUrl: data.paymentForm.apiUrl,
        postData: data.paymentForm.postData,
        tradeInfo: data.paymentForm.tradeInfo,
        tradeSha: data.paymentForm.tradeSha,
        version: data.paymentForm.version,
        merchantId: data.paymentForm.merchantId,
      };

      const encodedFormData = encodeURIComponent(JSON.stringify(formData));
      router.push(
        `/dashboard/billing/authorizing?paymentForm=${encodedFormData}`,
      );
    }
  } catch (error) {
    console.error("升級失敗:", error);
    alert(error instanceof Error ? error.message : "升級失敗，請稍後再試");
  } finally {
    setProcessingSlug(null);
  }
};
```

**修改重點**:

- ✅ 只傳送 `planId`
- ❌ 移除所有硬編碼的 `periodType`, `periodPoint`, `periodTimes` 參數
- ✅ 錯誤處理邏輯保持不變

---

#### 7. `/src/app/(dashboard)/dashboard/subscription/subscription-plans.tsx` (line 23-70)

**目標**: 同樣簡化為只傳 planId

**修改 `handleSubscribe()` 函數**:

```typescript
const handleSubscribe = async (plan: Plan) => {
  try {
    setLoading(plan.id);

    // 簡化請求，參數由後端控制
    const response = await fetch("/api/payment/recurring/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "未知錯誤");
    }

    if (data.paymentForm) {
      const formData = {
        apiUrl: data.paymentForm.apiUrl,
        postData: data.paymentForm.postData,
        merchantId: data.paymentForm.merchantId,
      };

      const encodedForm = encodeURIComponent(JSON.stringify(formData));
      router.push(`/dashboard/billing/authorizing?paymentForm=${encodedForm}`);
    } else {
      throw new Error("缺少付款表單資料");
    }
  } catch (error) {
    console.error("訂閱錯誤:", error);
    alert(`訂閱失敗: ${error instanceof Error ? error.message : "請稍後再試"}`);
    setLoading(null);
  }
};
```

**修改重點**:

- ✅ 只傳送 `planId`
- ❌ 移除硬編碼參數
- ✅ 保持錯誤處理

---

#### 8. `/src/app/pricing/page.tsx` (line 199-375)

**目標**: 修改計費週期選項和價格顯示

**修改計費週期狀態**:

```typescript
// line 52：修改狀態類型（保留月繳和終身）
const [billingPeriod, setBillingPeriod] = useState<"monthly" | "lifetime">(
  "monthly",
);
```

**修改計費週期切換按鈕** (line 629-668):

```typescript
<div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card/50 backdrop-blur-sm shadow-sm">
  <button
    onClick={() => setBillingPeriod('monthly')}
    className={cn(
      "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
      billingPeriod === 'monthly'
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    月繳 12 期
  </button>
  <button
    onClick={() => setBillingPeriod('lifetime')}
    className={cn(
      "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2",
      billingPeriod === 'lifetime'
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    <span>終身方案</span>
    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20">
      <Crown className="w-3 h-3" />
    </Badge>
  </button>
</div>
```

**修改 `getPlanPrice()` 函數** (line 199-207):

```typescript
const getPlanPrice = (plan: SubscriptionPlan) => {
  if (billingPeriod === "lifetime") {
    return plan.lifetime_price;
  }
  // 月繳顯示總價（月費 × 12）
  return plan.price * 12;
};
```

**修改價格顯示邏輯** (line 713-728):

```typescript
<div className="flex items-baseline gap-2">
  <span className="text-4xl font-bold tracking-tight">
    ${billingPeriod === 'lifetime'
      ? getPlanPrice(plan).toLocaleString()
      : plan.price.toLocaleString()}
  </span>
  <span className="text-muted-foreground">
    {billingPeriod === 'lifetime' ? '一次付清' : '/ 月'}
  </span>
</div>

{billingPeriod === 'monthly' && (
  <p className="text-sm text-muted-foreground mt-1">
    共 12 期，總計 ${getPlanPrice(plan).toLocaleString()}
  </p>
)}
```

**修改 `handlePlanPurchase()` 函數** (line 257-375):

```typescript
async function handlePlanPurchase(plan: SubscriptionPlan) {
  try {
    setProcessingPlanId(plan.id);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login?redirect=/pricing");
      return;
    }

    const isLifetime = billingPeriod === "lifetime";

    if (isLifetime) {
      // 終身方案邏輯不變
      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentType: "lifetime",
          relatedId: plan.id,
          amount: plan.lifetime_price,
          description: `${plan.name} 終身方案`,
          email: user.email || "",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "支付請求失敗");
      if (data.paymentForm) submitPaymentForm(data.paymentForm);
    } else {
      // 月繳邏輯（簡化，參數全部由後端控制）
      const response = await fetch("/api/payment/recurring/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "支付請求失敗");
      if (data.paymentForm) submitPaymentForm(data.paymentForm);
    }
  } catch (error) {
    console.error("購買失敗:", error);
    alert(error instanceof Error ? error.message : "購買失敗，請稍後再試");
  } finally {
    setProcessingPlanId(null);
  }
}
```

**修改重點**:

- ✅ 計費週期改為「月繳 12 期」和「終身方案」
- ✅ 月繳顯示「每月 $XXX」
- ✅ 顯示「共 12 期，總計 $XXX」
- ❌ 移除「年繳」選項
- ✅ 月繳購買只傳 `planId`

---

### 第三部分：金流回調處理

#### 9. `/src/app/api/payment/recurring/callback/route.ts` (line 16-345)

**目標**: 更新續約日期計算邏輯

**注意事項**:

- 此檔案主要依賴 `payment-service.handleRecurringCallback()`
- 需要確保月繳的下次扣款日計算正確

---

#### 10. `/src/lib/payment/payment-service.ts`

**目標**: 更新 `calculateNextPaymentDate()` 方法

**新增月繳計算邏輯**:

```typescript
private calculateNextPaymentDate(
  currentDate: Date,
  periodType: 'M',
  periodPoint: string
): Date {
  const nextDate = new Date(currentDate)
  nextDate.setMonth(nextDate.getMonth() + 1)

  const targetDay = parseInt(periodPoint)

  // 處理月份沒有該日期的情況（例如 2 月沒有 31 號）
  const year = nextDate.getFullYear()
  const month = nextDate.getMonth()
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()

  // 使用目標日期或該月最後一天（取較小者）
  nextDate.setDate(Math.min(targetDay, lastDayOfMonth))

  return nextDate
}
```

**修改重點**:

- ✅ 支援月繳（每月 +1）
- ✅ 處理月份日期不存在的情況（例如 2/31 → 2/28）
- ❌ 移除年繳計算邏輯

---

### 第四部分：資料庫 Schema（可選）

#### 11. 新建 Migration

**檔案**: `supabase/migrations/[timestamp]_update_recurring_mandates_for_monthly.sql`

**內容**:

```sql
-- 修改 recurring_mandates 表的 period_type 約束
-- 改為只接受月繳（'M'）

ALTER TABLE recurring_mandates
DROP CONSTRAINT IF EXISTS recurring_mandates_period_type_check;

ALTER TABLE recurring_mandates
ADD CONSTRAINT recurring_mandates_period_type_check
CHECK (period_type = 'M');

-- 更新現有的年繳記錄為月繳（如果有的話）
-- 注意：這會影響現有訂閱，請謹慎評估
-- UPDATE recurring_mandates
-- SET period_type = 'M', period_times = 12
-- WHERE period_type = 'Y';
```

**注意**:

- 這個 migration 是可選的
- 如果有現有年繳用戶，可能需要保留年繳支援
- 建議：只在前端和 API 層禁止新建年繳，資料庫層保持彈性

---

## 🔗 連動影響分析

### 1. 訂閱狀態檢查

**檔案**: `/src/lib/subscription/upgrade-rules.ts`

**影響**:

- `canUpgrade()` 函數需要正確處理月繳訂閱的升級邏輯
- 檢查是否還在 12 期內

**建議檢查**:

- 從免費升級到月繳：允許
- 月繳升級到更高方案：允許（重新開始 12 期）
- 月繳升級到終身：允許

---

### 2. 訂閱金額計算

**影響位置**:

- 所有顯示訂閱金額的地方
- Dashboard 訂閱頁面
- Pricing 頁面

**修改重點**:

- 顯示月費：`plan.price`
- 顯示總金額：`plan.price * 12`
- 文案：「每月 $XXX，共 12 期」

---

### 3. 訂閱描述文字

**需要更新的文案**:

- "年繳方案" → "月繳方案（12期）"
- "每年" → "每月"
- "年度訂閱" → "月繳訂閱"

**檔案位置**:

- `UpgradePromptCard.tsx`
- `pricing/page.tsx`
- `subscription/page.tsx`
- API route 的 description 參數

---

### 4. 計費週期顯示

**Dashboard 訂閱頁面需要顯示**:

- 當前方案：專業版 - 月繳方案
- 已付款：第 3 期 / 共 12 期
- 下次扣款日：2025-12-15
- 每月金額：$999

**實作建議**:
在 `company_subscriptions` 表新增欄位：

- `current_period`: 當前期數（1-12）
- `total_periods`: 總期數（12）

---

### 5. 終身方案處理

**影響**: 無

**說明**:

- 終身方案使用單次支付 API (`/api/payment/onetime/create`)
- 與定期定額訂閱完全分開
- 不受此次修改影響

---

## ⚠️ 潛在風險和 Edge Cases

### 1. 續約日期計算

**風險**: 月份沒有 31 號時如何處理

**情境**:

- 用戶在 1/31 訂閱，`periodPoint = "31"`
- 下次扣款日應為 2/28（或 2/29 閏年）
- 3 月扣款日恢復為 3/31

**解決方案**:

```typescript
// 使用目標日期或該月最後一天（取較小者）
const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
nextDate.setDate(Math.min(targetDay, lastDayOfMonth));
```

---

### 2. 12 期用完後的處理

**問題**: 12 期扣款完成後如何處理

**選項 A**: 自動續約新的 12 期

- 優點：用戶體驗好，不會中斷服務
- 缺點：可能違反某些地區的消費者保護法規

**選項 B**: 訂閱到期，需要重新訂閱

- 優點：符合法規要求
- 缺點：可能流失用戶

**建議**: 採用選項 B，並在第 11 期時提醒用戶續約

**實作**:

- 在 `handleRecurringCallback()` 中檢查 `current_period`
- 如果 `current_period === 11`，發送續約提醒信
- 如果 `current_period === 12`，將訂閱狀態改為 `completed`

---

### 3. 現有年繳用戶

**風險**: 如果有用戶已經在年繳訂閱

**解決方案**:

1. **資料庫層**: 保留對年繳的支援
2. **API 層**: 新訂閱只允許月繳
3. **回調處理**: 同時支援月繳和年繳的續約計算

**migration 建議**:

```sql
-- 不要修改 CHECK 約束，保持彈性
-- 只在應用層控制新訂閱類型

-- 可以新增一個欄位標記訂閱世代
ALTER TABLE recurring_mandates
ADD COLUMN subscription_version INTEGER DEFAULT 2;

-- version 1: 舊的年繳訂閱
-- version 2: 新的月繳訂閱
```

---

### 4. 金額計算精度

**風險**: `plan.price * 12` 可能與資料庫的 `yearly_price` 不同

**情境**:

- 月費 $999
- 月費 × 12 = $11,988
- 年費優惠價 = $9,999（打 8.4 折）

**解決方案**:

- 月繳總額使用 `plan.price * 12`（不打折）
- 年費優惠只適用於一次付清的情況
- 在 Pricing 頁面明確顯示差異

**文案建議**:

```
月繳方案（12期）
每月 $999，共 12 期
總計 $11,988

年繳方案（一次付清）
原價 $11,988
優惠價 $9,999（省 $1,989）
```

---

### 5. 扣款失敗處理

**風險**: 某期扣款失敗如何處理

**PAYUNi（統一金流）機制**:

- 扣款失敗會重試 3 次
- 仍失敗則通知商店

**建議處理流程**:

1. 在 `company_subscriptions` 表新增 `failed_payments_count` 欄位
2. 扣款失敗時 +1
3. 超過 3 次失敗：
   - 暫停訂閱（`status = 'suspended'`）
   - 發送提醒信給用戶
   - 要求更新信用卡資訊
4. 用戶更新卡片後，手動觸發補扣款

---

## ✅ 驗證清單

### 前端驗證

- [ ] Dashboard 顯示真實的文章數（從 `generated_articles` 表）
- [ ] Dashboard 顯示真實的網站數（從 `website_configs` 表）
- [ ] Credit 餘額卡片不可點擊（純顯示）
- [ ] Pricing 頁面顯示「月繳（12期）」和「終身」兩個選項
- [ ] 月繳價格顯示為「每月 $XXX」
- [ ] 月繳顯示「共 12 期，總計 $XXX」
- [ ] 訂閱按鈕文案為「月繳方案」
- [ ] 升級提示卡片使用月繳邏輯

### API 驗證

- [ ] `/api/payment/recurring/create` 只接受 `planId` 參數
- [ ] API 內部固定 `periodType: 'M'`
- [ ] API 內部固定 `periodTimes: 12`
- [ ] API 使用 `periodPoint: String(new Date().getDate())`
- [ ] 使用月費金額（`plan.price`）
- [ ] 描述為「月繳方案（12期）」

### 金流驗證

- [ ] 提交到PAYUNi（統一金流）的 `PeriodType` 為 `'M'`
- [ ] `PeriodPoint` 為 `'01'` ~ `'31'` 格式
- [ ] `PeriodTimes` 為 `12`
- [ ] `PeriodAmt` 為月費金額
- [ ] 授權成功（不會再出現「年期授權時間資料不正確」錯誤）
- [ ] 可以正常跳轉到金流授權頁面

### 資料庫驗證

- [ ] `recurring_mandates.period_type` 寫入 `'M'`
- [ ] `recurring_mandates.period_point` 格式為 `'01'` ~ `'31'`
- [ ] `recurring_mandates.period_times` 為 `12`
- [ ] `recurring_mandates.period_amount` 為月費
- [ ] `recurring_mandates.total_amount` 為月費 × 12
- [ ] `company_subscriptions` 正確創建

### 回調驗證

- [ ] 首次授權成功回調正確處理
- [ ] 訂閱狀態更新為 `active`
- [ ] Token 配額正確發放
- [ ] 每月扣款回調正確處理
- [ ] 下次扣款日計算正確（當月日期 +1 個月）
- [ ] 第 12 期完成後訂閱狀態更新正確

---

## 📝 建議實施順序

### 階段一：金流核心修正（最關鍵，必須先完成）

**預估時間**: 2-3 小時

1. `payment-service.ts` - 修改 `createRecurringPayment()` 支援月繳
2. `payment-service.ts` - 修改介面和實作邏輯
3. `/api/payment/recurring/create/route.ts` - 固定月繳參數
4. **測試**: 建立測試訂閱，確認金流參數正確

**驗證重點**:

- 提交到PAYUNi（統一金流）的參數格式正確
- 不會再出現「年期授權時間資料不正確」錯誤

---

### 階段二：前端訂閱入口（修正用戶觸發點）

**預估時間**: 1-2 小時

5. `UpgradePromptCard.tsx` - 簡化為只傳 planId
6. `subscription-plans.tsx` - 同樣簡化
7. `pricing/page.tsx` - 修改計費週期選項和價格顯示

**驗證重點**:

- 所有訂閱入口都正確調用月繳 API
- 價格顯示正確（每月 + 總計）

---

### 階段三：Dashboard 統計數據（獨立功能，可並行）

**預估時間**: 1 小時

8. `TokenBalanceCard.tsx` - 移除點擊功能
9. `dashboard/page.tsx` - 新增資料庫查詢

**驗證重點**:

- 文章數和網站數動態顯示
- 餘額卡片不可點擊

---

### 階段四：回調處理（處理續約邏輯）

**預估時間**: 1-2 小時

10. `payment-service.ts` - 更新 `calculateNextPaymentDate()`
11. 測試回調處理邏輯

**驗證重點**:

- 首次授權成功
- 每月續約計算正確
- 處理月份日期不存在的情況

---

### 階段五：完整測試（端到端驗證）

**預估時間**: 2-3 小時

12. 完整流程測試
13. 邊界情況測試
14. 回歸測試

**測試項目**:

- [ ] 新用戶註冊 → 選擇月繳方案 → 授權成功
- [ ] 免費用戶升級 → 月繳方案 → 授權成功
- [ ] 查看 Dashboard 統計數據正確
- [ ] 查看訂閱頁面顯示正確
- [ ] 模擬月繳回調（使用PAYUNi測試環境）

---

## 💡 額外建議

### 1. 新增「剩餘期數」顯示

**位置**: Dashboard 訂閱頁面

**建議 UI**:

```
當前訂閱：專業版 - 月繳方案
已付款：第 3 期 / 共 12 期
下次扣款日：2025-12-15
每月金額：$999
```

**實作**:

- 在 `company_subscriptions` 表新增 `current_period` 欄位
- 每次扣款成功後 +1
- 達到 12 時標記訂閱完成

---

### 2. 第 11 期提前續約提醒

**時機**: 第 11 期扣款成功後

**建議動作**:

1. 發送 Email 提醒
2. Dashboard 顯示續約提示
3. 提供一鍵續約按鈕

**Email 文案**:

```
您的訂閱即將到期

親愛的用戶，

您的專業版訂閱即將在下個月（第 12 期）到期。

為了避免服務中斷，請提前續約。

[立即續約] 按鈕

感謝您的支持！
```

---

### 3. 考慮無限期月繳選項

**用戶場景**: 某些用戶可能需要長期訂閱

**建議方案**:

- 月繳 12 期（目前方案）
- 月繳無限期（`periodTimes: 99`）

**Pricing 頁面顯示**:

```
月繳方案（12 期）
每月 $999，共 12 期

月繳方案（持續訂閱）
每月 $999，持續扣款直到取消
```

**實作**:

- 新增一個 checkbox：「持續訂閱（可隨時取消）」
- 如果勾選，`periodTimes` 設為 99
- 提供「取消訂閱」功能

---

### 4. 價格顯示優化

**Pricing 頁面建議文案**:

```
專業版

月繳方案（12 期）
每月 $999
總計 $11,988（分 12 期付款）

[立即訂閱]

---

年繳方案（一次付清）
原價 $11,988
優惠價 $9,999
節省 $1,989（83 折）

[立即購買]

---

終身方案
一次付清 $29,999
永久使用

[立即購買]
```

---

### 5. 訂閱取消功能

**功能需求**: 允許用戶取消訂閱

**實作建議**:

1. Dashboard 訂閱頁面新增「取消訂閱」按鈕
2. 調用PAYUNi（統一金流）「終止委託」API
3. 更新 `recurring_mandates.status = 'cancelled'`
4. 保留已付費期間的服務權限
5. 到期後自動降級為免費方案

**注意**:

- 已付費的期數仍然有效
- 只是不再續約新的期數
- PAYUNi（統一金流）需要調用專門的終止委託 API

---

## 📚 參考資料

### PAYUNi（統一金流）官方文件

- [信用卡定期定額技術串接手冊](https://www.payuni.com.tw/website/Page/content/download_api)
- 測試環境: `https://ccore.payuni.com.tw/MPG/period`
- 正式環境: `https://core.payuni.com.tw/MPG/period`

### 關鍵參數格式

- `PeriodType: 'M'` - 每月
- `PeriodPoint: '01' ~ '31'` - 每月扣款日
- `PeriodTimes: 12` - 12 期
- `PeriodStartType: 2` - 立即執行委託金額授權

---

## 🎯 成功標準

修復完成後，應達到以下效果：

### 功能正常運作

- [x] Dashboard 顯示真實統計數據
- [x] Credit 餘額卡片為純顯示（不可點擊）
- [x] 用戶可以成功訂閱月繳 12 期方案
- [x] 不會再出現「年期授權時間資料不正確」錯誤
- [x] 金流授權成功
- [x] 訂閱記錄正確寫入資料庫

### 用戶體驗

- [x] Pricing 頁面清楚顯示「月繳（12期）」選項
- [x] 價格顯示清晰（每月 + 總計）
- [x] 訂閱流程順暢，無錯誤提示

### 資料正確性

- [x] 文章數從資料庫讀取
- [x] 網站數從資料庫讀取
- [x] 訂閱參數正確（月繳、12 期）
- [x] 金流參數格式正確

---

## 📞 支援和問題回報

如果在實施過程中遇到問題：

1. **檢查錯誤日誌**: 查看 Vercel 部署日誌或本地 console
2. **驗證參數**: 使用 `console.log()` 確認傳送到PAYUNi（統一金流）的參數
3. **測試環境**: 先在PAYUNi測試環境驗證，再部署到正式環境
4. **資料庫檢查**: 確認 `recurring_mandates` 表的資料是否正確寫入

---

**文件版本**: 1.0
**最後更新**: 2025-11-11
**維護者**: Claude Code
