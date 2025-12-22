"use client";

import { useState } from "react";
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
        toast.error(`付款建立失敗: ${result.error?.message || "未知錯誤"}`);
        return;
      }

      // 跳轉至 PAYUNi 付款頁面
      if (result.data?.payuniForm) {
        toast.success("正在跳轉至 PAYUNi 付款頁面...");
        submitPayuniForm(result.data.payuniForm);
      } else {
        toast.error("未收到付款表單資料");
      }
    } catch (error) {
      console.error("付款測試失敗:", error);
      toast.error("付款測試失敗，請查看 console");
    } finally {
      setLoading(false);
    }
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
        toast.error(`付款建立失敗: ${result.error?.message || "未知錯誤"}`);
        return;
      }

      // 跳轉至 PAYUNi 付款頁面
      if (result.data?.payuniForm) {
        toast.success("正在跳轉至 PAYUNi 付款頁面...");
        submitPayuniForm(result.data.payuniForm);
      } else {
        toast.error("未收到付款表單資料");
      }
    } catch (error) {
      console.error("付款測試失敗:", error);
      toast.error("付款測試失敗，請查看 console");
    } finally {
      setLoading(false);
    }
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
            PAYUNi 金流測試
          </CardTitle>
          <CardDescription>
            正式環境付款測試（會產生真實交易，請使用小額測試）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 付款類型選擇 */}
          <div className="space-y-2">
            <Label>付款類型</Label>
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
                    單次付款
                  </div>
                </SelectItem>
                <SelectItem value="recurring">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    定期定額
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 金額 */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              {paymentType === "recurring" ? "每期金額" : "付款金額"} (TWD)
            </Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              建議使用 1 元進行測試
            </p>
          </div>

          {/* 商品描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">商品描述</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">付款人 Email</Label>
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
              <h4 className="font-medium">定期定額設定</h4>

              {/* 扣款週期 */}
              <div className="space-y-2">
                <Label>扣款週期</Label>
                <Select
                  value={periodType}
                  onValueChange={(value) => setPeriodType(value as PeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">每週</SelectItem>
                    <SelectItem value="month">每月</SelectItem>
                    <SelectItem value="year">每年</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 扣款日期 */}
              <div className="space-y-2">
                <Label htmlFor="periodDate">
                  扣款日期
                  {periodType === "week" && " (1-7，星期一至日)"}
                  {periodType === "month" && " (1-31，每月幾號)"}
                  {periodType === "year" && " (YYYY-MM-DD)"}
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
                <Label htmlFor="periodTimes">扣款期數（最多 900 期）</Label>
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
                處理中...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                {paymentType === "onetime"
                  ? `付款 NT$${amount}`
                  : `訂閱 NT$${amount}/期 × ${periodTimes} 期`}
              </>
            )}
          </Button>

          {/* 警告訊息 */}
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
            <strong>注意：</strong>
            此為正式環境測試，會產生真實交易。請確保金額正確後再進行付款。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
