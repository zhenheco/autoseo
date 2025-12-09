"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Gift, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface RefundableOrder {
  id: string;
  orderNo: string;
  paymentType: string;
  paymentTypeText: string;
  amount: number;
  tradeNo: string;
  paidAt: string;
  daysSincePurchase: number;
  isAutoEligible: boolean;
  creditsToDeduct: number;
}

interface RefundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = "form" | "retention" | "success";

const reasonOptions = [
  { value: "product_issue", label: "產品功能不符合預期" },
  { value: "service_unsatisfied", label: "服務品質不滿意" },
  { value: "billing_error", label: "帳務問題/重複扣款" },
  { value: "change_of_mind", label: "改變心意" },
  { value: "other", label: "其他" },
];

export function RefundRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: RefundRequestDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<RefundableOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form state
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");

  // Retention state
  const [refundId, setRefundId] = useState("");
  const [refundNo, setRefundNo] = useState("");
  const [retentionCredits, setRetentionCredits] = useState(0);
  const [isAutoEligible, setIsAutoEligible] = useState(false);

  // Success state
  const [successMessage, setSuccessMessage] = useState("");
  const [successStatus, setSuccessStatus] = useState<
    "retention_accepted" | "completed" | "pending_review"
  >("completed");

  useEffect(() => {
    if (open) {
      resetForm();
      fetchOrders();
    }
  }, [open]);

  const resetForm = () => {
    setStep("form");
    setSelectedOrderId("");
    setReasonCategory("");
    setReasonDetail("");
    setRefundId("");
    setRefundNo("");
    setRetentionCredits(0);
    setIsAutoEligible(false);
    setSuccessMessage("");
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch("/api/refund/orders");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "載入訂單失敗");
      }

      setOrders(data.orders || []);
    } catch (error) {
      console.error("載入訂單失敗:", error);
      toast.error("載入訂單失敗");
    } finally {
      setLoadingOrders(false);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const handleSubmitRequest = async () => {
    if (!selectedOrderId || !reasonCategory) {
      toast.error("請選擇訂單和退款原因");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/refund/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrderId,
          reasonCategory,
          reasonDetail: reasonDetail.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "申請退款失敗");
      }

      setRefundId(data.refundId);
      setRefundNo(data.refundNo);
      setRetentionCredits(data.retentionCredits);
      setIsAutoEligible(data.isAutoEligible);

      // Show retention offer
      setStep("retention");
    } catch (error) {
      console.error("申請退款失敗:", error);
      toast.error(error instanceof Error ? error.message : "申請退款失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRetention = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/refund/accept-retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "接受慰留失敗");
      }

      setSuccessStatus("retention_accepted");
      setSuccessMessage(
        `感謝您的支持！已為您新增 ${data.creditsAdded.toLocaleString()} credits`,
      );
      setStep("success");
      onSuccess?.();
    } catch (error) {
      console.error("接受慰留失敗:", error);
      toast.error(error instanceof Error ? error.message : "接受慰留失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedRefund = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/refund/proceed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "處理退款失敗");
      }

      setSuccessStatus(data.status);
      setSuccessMessage(data.message);
      setStep("success");
      onSuccess?.();
    } catch (error) {
      console.error("處理退款失敗:", error);
      toast.error(error instanceof Error ? error.message : "處理退款失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>申請退款</DialogTitle>
              <DialogDescription>
                請選擇要退款的訂單並填寫退款原因
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Order Selection */}
              <div className="space-y-2">
                <Label>選擇要退款的訂單</Label>
                {loadingOrders ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    載入中...
                  </div>
                ) : orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    沒有可退款的訂單
                  </p>
                ) : (
                  <Select
                    value={selectedOrderId}
                    onValueChange={setSelectedOrderId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇訂單" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          <div className="flex flex-col">
                            <span>
                              {order.paymentTypeText} - NT${" "}
                              {order.amount.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.paidAt).toLocaleDateString(
                                "zh-TW",
                              )}{" "}
                              · {order.daysSincePurchase} 天前
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Selected Order Info */}
              {selectedOrder && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">訂單金額</span>
                    <span className="font-medium">
                      NT$ {selectedOrder.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">購買天數</span>
                    <span
                      className={
                        selectedOrder.isAutoEligible
                          ? "text-green-600"
                          : "text-orange-600"
                      }
                    >
                      {selectedOrder.daysSincePurchase} 天
                      {selectedOrder.isAutoEligible
                        ? " (符合自動退款)"
                        : " (需人工審核)"}
                    </span>
                  </div>
                  {selectedOrder.creditsToDeduct > 0 && (
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">
                        將扣除 Credits
                      </span>
                      <span className="text-red-600">
                        -{selectedOrder.creditsToDeduct.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Reason Selection */}
              <div className="space-y-2">
                <Label>選擇退款原因</Label>
                <RadioGroup
                  value={reasonCategory}
                  onValueChange={setReasonCategory}
                >
                  {reasonOptions.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="font-normal">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Additional Details */}
              <div className="space-y-2">
                <Label>補充說明（選填）</Label>
                <Textarea
                  placeholder="請輸入補充說明..."
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button
                onClick={handleSubmitRequest}
                disabled={
                  loading ||
                  !selectedOrderId ||
                  !reasonCategory ||
                  loadingOrders
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  "下一步"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "retention" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                我們想留住您！
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-center text-muted-foreground">
                如果您願意繼續使用，我們將額外贈送您
              </p>
              <div className="text-center">
                <span className="text-3xl font-bold text-primary">
                  {retentionCredits.toLocaleString()}
                </span>
                <span className="ml-2 text-lg text-muted-foreground">
                  credits
                </span>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                （訂單金額的 50%）
              </p>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="w-full"
                onClick={handleAcceptRetention}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Gift className="mr-2 h-4 w-4" />
                )}
                接受優惠，繼續使用
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleProceedRefund}
                disabled={loading}
              >
                不，我要繼續退款
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                {successStatus === "retention_accepted"
                  ? "感謝您的支持！"
                  : "退款申請已提交"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 text-center">
              <p>{successMessage}</p>

              {successStatus !== "retention_accepted" && (
                <>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">退款編號</span>
                      <span className="font-mono">{refundNo}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      退款完成後，您的訂閱將降級為 Free 方案，且相關 credits
                      將被扣除
                    </span>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button className="w-full" onClick={handleClose}>
                確定
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
