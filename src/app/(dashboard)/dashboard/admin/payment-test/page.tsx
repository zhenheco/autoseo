"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Loader2, Repeat } from "lucide-react";
import { submitPayuniForm } from "@/lib/payment/payuni-client";

/** 付款類型 */
type PaymentType = "onetime" | "recurring";

/** 定期定額週期 */
type PeriodType = "week" | "month" | "year";

/**
 * Admin 付款測試頁面
 *
 * 用於在正式環境測試 PAYUNi 金流整合
 * 僅 super-admin 可見（透過 sidebar 權限控制）
 */
export default function AdminPaymentTestPage() {
  const t = useTranslations("admin.paymentTest");
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>("onetime");
  const [amount, setAmount] = useState(1);
  const [description, setDescription] = useState("PAYUNi 金流測試");
  const [email, setEmail] = useState("acejou27@gmail.com");

  // 定期定額參數
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [periodDate, setPeriodDate] = useState("1");
  const [periodTimes, setPeriodTimes] = useState(3);

  /**
   * 執行單次付款測試
   */
  async function handleOnetimePayment() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/test-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "onetime",
          amount,
          description,
          email,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(t("paymentCreateFailed", { error: result.error?.message || t("unknownError") }));
        return;
      }

      // 跳轉至 PAYUNi 付款頁面
      // 注意：金流微服務直接返回 payuniForm 在根層級，而非 data.payuniForm
      console.log("[PaymentTest] API 回應:", JSON.stringify(result, null, 2));

      if (result.payuniForm) {
        console.log("[PaymentTest] payuniForm:", result.payuniForm);
        toast.success(t("redirectingToPayuni"));
        // 重要：不要在 submitPayuniForm 後設置 loading=false
        // 因為頁面會跳轉，設置狀態可能導致 React 重新渲染而中斷表單提交
        submitPayuniForm(result.payuniForm);
        return; // 跳轉後不執行 finally
      } else {
        console.error("[PaymentTest] 未收到 payuniForm，完整回應:", result);
        toast.error(t("noPaymentFormReceived"));
      }
    } catch (error) {
      console.error("[PaymentTest] 付款測試失敗:", error);
      toast.error(t("paymentTestFailed"));
    }
    setLoading(false);
  }

  /**
   * 執行定期定額付款測試
   */
  async function handleRecurringPayment() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/test-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "recurring",
          amount,
          description,
          email,
          periodParams: {
            periodType,
            periodDate,
            periodTimes,
          },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(t("paymentCreateFailed", { error: result.error?.message || t("unknownError") }));
        return;
      }

      // 跳轉至 PAYUNi 付款頁面
      console.log("[PaymentTest] API 回應:", JSON.stringify(result, null, 2));

      if (result.payuniForm) {
        console.log("[PaymentTest] payuniForm:", result.payuniForm);
        toast.success(t("redirectingToPayuni"));
        submitPayuniForm(result.payuniForm);
        return; // 跳轉後不執行後續代碼
      } else {
        console.error("[PaymentTest] 未收到 payuniForm，完整回應:", result);
        toast.error(t("noPaymentFormReceived"));
      }
    } catch (error) {
      console.error("[PaymentTest] 付款測試失敗:", error);
      toast.error(t("paymentTestFailed"));
    }
    setLoading(false);
  }

  /**
   * 處理付款
   */
  function handlePayment() {
    if (paymentType === "onetime") {
      handleOnetimePayment();
    } else {
      handleRecurringPayment();
    }
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>
            {t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 付款類型選擇 */}
          <div className="space-y-2">
            <Label>{t("paymentType")}</Label>
            <Select
              value={paymentType}
              onValueChange={(value) => setPaymentType(value as PaymentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onetime">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t("onetimePayment")}
                  </div>
                </SelectItem>
                <SelectItem value="recurring">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    {t("recurringPayment")}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 金額 */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              {paymentType === "recurring" ? t("amountPerPeriod") : t("paymentAmount")} (TWD)
            </Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              {t("amountHint")}
            </p>
          </div>

          {/* 商品描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("productDescription")}</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">{t("payerEmail")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* 定期定額參數 */}
          {paymentType === "recurring" && (
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">{t("recurringSettings")}</h4>

              {/* 扣款週期 */}
              <div className="space-y-2">
                <Label>{t("billingCycle")}</Label>
                <Select
                  value={periodType}
                  onValueChange={(value) => setPeriodType(value as PeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">{t("cycleWeekly")}</SelectItem>
                    <SelectItem value="month">{t("cycleMonthly")}</SelectItem>
                    <SelectItem value="year">{t("cycleYearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 扣款日期 */}
              <div className="space-y-2">
                <Label htmlFor="periodDate">
                  {t("billingDate")}
                  {periodType === "week" && ` ${t("billingDateWeekHint")}`}
                  {periodType === "month" && ` ${t("billingDateMonthHint")}`}
                  {periodType === "year" && ` ${t("billingDateYearHint")}`}
                </Label>
                <Input
                  id="periodDate"
                  value={periodDate}
                  onChange={(e) => setPeriodDate(e.target.value)}
                  placeholder={periodType === "year" ? "2025-12-25" : "1"}
                />
              </div>

              {/* 扣款期數 */}
              <div className="space-y-2">
                <Label htmlFor="periodTimes">{t("billingTimes")}</Label>
                <Input
                  id="periodTimes"
                  type="number"
                  min={1}
                  max={900}
                  value={periodTimes}
                  onChange={(e) => setPeriodTimes(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* 付款按鈕 */}
          <Button
            onClick={handlePayment}
            disabled={loading || amount < 1}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("processing")}
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                {paymentType === "onetime"
                  ? t("payButton", { amount })
                  : t("subscribeButton", { amount, times: periodTimes })}
              </>
            )}
          </Button>

          {/* 警告訊息 */}
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
            <strong>{t("warningTitle")}</strong>
            {t("warningMessage")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
