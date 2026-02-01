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
import { useTranslations } from "next-intl";

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
  { value: "product_issue", labelKey: "productIssue" },
  { value: "service_unsatisfied", labelKey: "serviceUnsatisfied" },
  { value: "billing_error", labelKey: "billingError" },
  { value: "change_of_mind", labelKey: "changeOfMind" },
  { value: "other", labelKey: "other" },
] as const;

export function RefundRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: RefundRequestDialogProps) {
  const t = useTranslations("refund");
  const tCommon = useTranslations("common");

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
    setSuccessMessage("");
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch("/api/refund/orders");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("loadOrdersFailed"));
      }

      setOrders(data.orders || []);
    } catch (error) {
      console.error("Failed to load orders:", error);
      toast.error(t("loadOrdersFailed"));
    } finally {
      setLoadingOrders(false);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const handleSubmitRequest = async () => {
    if (!selectedOrderId || !reasonCategory) {
      toast.error(t("selectOrderAndReason"));
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
        throw new Error(data.error || t("requestFailed"));
      }

      setRefundId(data.refundId);
      setRefundNo(data.refundNo);
      setRetentionCredits(data.retentionCredits);

      // Show retention offer
      setStep("retention");
    } catch (error) {
      console.error("Failed to request refund:", error);
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
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
        throw new Error(data.error || t("acceptRetentionFailed"));
      }

      setSuccessStatus("retention_accepted");
      setSuccessMessage(
        t("retentionSuccessMessage", { credits: data.creditsAdded.toLocaleString() }),
      );
      setStep("success");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to accept retention:", error);
      toast.error(error instanceof Error ? error.message : t("acceptRetentionFailed"));
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
        throw new Error(data.error || t("proceedRefundFailed"));
      }

      setSuccessStatus(data.status);
      setSuccessMessage(data.message);
      setStep("success");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to process refund:", error);
      toast.error(error instanceof Error ? error.message : t("proceedRefundFailed"));
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
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>
                {t("description")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Order Selection */}
              <div className="space-y-2">
                <Label>{t("selectOrder")}</Label>
                {loadingOrders ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("loadingOrders")}
                  </div>
                ) : orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noRefundableOrders")}
                  </p>
                ) : (
                  <Select
                    value={selectedOrderId}
                    onValueChange={setSelectedOrderId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectOrderPlaceholder")} />
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
                              · {t("daysAgo", { days: order.daysSincePurchase })}
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
                    <span className="text-muted-foreground">{t("orderAmount")}</span>
                    <span className="font-medium">
                      NT$ {selectedOrder.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">{t("daysSincePurchase")}</span>
                    <span
                      className={
                        selectedOrder.isAutoEligible
                          ? "text-green-600"
                          : "text-orange-600"
                      }
                    >
                      {selectedOrder.daysSincePurchase} {tCommon("next") === "Next" ? "days" : "天"}
                      {selectedOrder.isAutoEligible
                        ? ` ${t("autoEligible")}`
                        : ` ${t("manualReview")}`}
                    </span>
                  </div>
                  {selectedOrder.creditsToDeduct > 0 && (
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">
                        {t("creditsToDeduct")}
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
                <Label>{t("selectReason")}</Label>
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
                        {t(`reasons.${option.labelKey}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Additional Details */}
              <div className="space-y-2">
                <Label>{t("additionalDetails")}</Label>
                <Textarea
                  placeholder={t("additionalDetailsPlaceholder")}
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {tCommon("cancel")}
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
                    {t("processing")}
                  </>
                ) : (
                  t("nextStep")
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
                {t("retentionTitle")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-center text-muted-foreground">
                {t("retentionDescription")}
              </p>
              <div className="text-center">
                <span className="text-3xl font-bold text-primary">
                  {retentionCredits.toLocaleString()}
                </span>
                <span className="ml-2 text-lg text-muted-foreground">
                  {t("retentionCredits")}
                </span>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {t("retentionPercentage")}
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
                {t("acceptRetention")}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleProceedRefund}
                disabled={loading}
              >
                {t("proceedRefund")}
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
                  ? t("retentionAccepted")
                  : t("refundSubmitted")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 text-center">
              <p>{successMessage}</p>

              {successStatus !== "retention_accepted" && (
                <>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("refundNo")}</span>
                      <span className="font-mono">{refundNo}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      {t("refundWarning")}
                    </span>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button className="w-full" onClick={handleClose}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
