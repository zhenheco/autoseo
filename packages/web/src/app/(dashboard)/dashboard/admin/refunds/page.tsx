"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type RefundStatus =
  | "pending"
  | "retention_accepted"
  | "auto_processing"
  | "pending_review"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

interface Refund {
  id: string;
  refundNo: string;
  companyName: string;
  orderNo: string;
  paymentType: string;
  originalAmount: number;
  refundAmount: number;
  status: RefundStatus;
  statusText: string;
  isAutoEligible: boolean;
  daysSincePurchase: number;
  reasonCategory: string;
  reasonDetail: string | null;
  retentionAccepted: boolean;
  retentionCredits: number;
  requestedAt: string;
  completedAt: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
}

export default function AdminRefundsPage() {
  const t = useTranslations("admin.refunds");
  const tCommon = useTranslations("admin.common");

  const reasonCategoryMap: Record<string, string> = {
    product_issue: t("reasonCategories.productIssue"),
    service_unsatisfied: t("reasonCategories.serviceUnsatisfied"),
    billing_error: t("reasonCategories.billingError"),
    change_of_mind: t("reasonCategories.changeOfMind"),
    other: t("reasonCategories.other"),
  };

  const paymentTypeMap: Record<string, string> = {
    lifetime: t("paymentTypes.lifetime"),
    token_package: t("paymentTypes.tokenPackage"),
    subscription: t("paymentTypes.subscription"),
  };
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Approve dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  useEffect(() => {
    fetchRefunds();
  }, [statusFilter]);

  const fetchRefunds = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/admin/refunds?${params.toString()}`);

      if (response.status === 403) {
        toast.error(t("accessDenied"));
        return;
      }

      if (!response.ok) {
        throw new Error(t("loadFailed"));
      }

      const data = await response.json();
      setRefunds(data.data || []);
    } catch (error) {
      console.error(t("loadRefundsFailed"), error);
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (refund: Refund) => {
    setSelectedRefund(refund);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (refund: Refund) => {
    setSelectedRefund(refund);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const approveRefund = async () => {
    if (!selectedRefund) return;

    setUpdating(selectedRefund.id);
    try {
      const response = await fetch(
        `/api/admin/refunds/${selectedRefund.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("approveFailed"));
      }

      toast.success(t("approveSuccess"));
      setApproveDialogOpen(false);
      fetchRefunds();
    } catch (error) {
      console.error(t("approveRefundFailed"), error);
      toast.error(error instanceof Error ? error.message : t("approveFailed"));
    } finally {
      setUpdating(null);
    }
  };

  const rejectRefund = async () => {
    if (!selectedRefund) return;

    if (!rejectReason.trim()) {
      toast.error(t("rejectReasonRequired"));
      return;
    }

    setUpdating(selectedRefund.id);
    try {
      const response = await fetch(
        `/api/admin/refunds/${selectedRefund.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectReason: rejectReason.trim() }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("rejectFailed"));
      }

      toast.success(t("rejectSuccess"));
      setRejectDialogOpen(false);
      fetchRefunds();
    } catch (error) {
      console.error(t("rejectRefundFailed"), error);
      toast.error(error instanceof Error ? error.message : t("rejectFailed"));
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: RefundStatus, statusText: string) => {
    const statusMap: Record<RefundStatus, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      retention_accepted: "bg-green-100 text-green-800",
      auto_processing: "bg-blue-100 text-blue-800",
      pending_review: "bg-orange-100 text-orange-800",
      approved: "bg-green-100 text-green-800",
      processing: "bg-purple-100 text-purple-800",
      completed: "bg-green-200 text-green-900",
      rejected: "bg-red-100 text-red-800",
      failed: "bg-red-200 text-red-900",
    };

    return (
      <span className={`rounded-full px-2 py-1 text-xs ${statusMap[status]}`}>
        {statusText}
      </span>
    );
  };

  const pendingReviewCount = refunds.filter(
    (r) => r.status === "pending_review",
  ).length;

  const canReview = (status: RefundStatus) => {
    return status === "pending_review";
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("description")}
            {pendingReviewCount > 0 && (
              <span className="ml-2 text-orange-600">
                {t("pendingReviewCount", { count: pendingReviewCount })}
              </span>
            )}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("statusAll")}</SelectItem>
            <SelectItem value="pending">{t("statusPending")}</SelectItem>
            <SelectItem value="pending_review">{t("statusPendingReview")}</SelectItem>
            <SelectItem value="retention_accepted">{t("statusRetentionAccepted")}</SelectItem>
            <SelectItem value="auto_processing">{t("statusAutoProcessing")}</SelectItem>
            <SelectItem value="approved">{t("statusApproved")}</SelectItem>
            <SelectItem value="processing">{t("statusProcessing")}</SelectItem>
            <SelectItem value="completed">{t("statusCompleted")}</SelectItem>
            <SelectItem value="rejected">{t("statusRejected")}</SelectItem>
            <SelectItem value="failed">{t("statusFailed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription", { count: refunds.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              {t("loading")}
            </div>
          ) : refunds.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {t("noRefunds")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.requestTime")}</TableHead>
                    <TableHead>{t("columns.refundNo")}</TableHead>
                    <TableHead>{t("columns.companyName")}</TableHead>
                    <TableHead>{t("columns.orderType")}</TableHead>
                    <TableHead className="text-right">{t("columns.refundAmount")}</TableHead>
                    <TableHead>{t("columns.refundReason")}</TableHead>
                    <TableHead>{t("columns.daysSincePurchase")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(refund.requestedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {refund.refundNo}
                      </TableCell>
                      <TableCell>{refund.companyName}</TableCell>
                      <TableCell>
                        {paymentTypeMap[refund.paymentType] ||
                          refund.paymentType}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        NT$ {refund.refundAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          {reasonCategoryMap[refund.reasonCategory] ||
                            refund.reasonCategory}
                        </div>
                        {refund.reasonDetail && (
                          <div className="text-xs text-muted-foreground">
                            {refund.reasonDetail}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            refund.daysSincePurchase <= 7
                              ? "text-green-600"
                              : "text-orange-600"
                          }
                        >
                          {refund.daysSincePurchase} {t("daysUnit")}
                        </span>
                        {refund.isAutoEligible && (
                          <span className="ml-1 text-xs text-green-600">
                            {t("autoEligible")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(refund.status, refund.statusText)}
                        {refund.retentionAccepted && (
                          <div className="mt-1 text-xs text-green-600">
                            {t("retentionAccepted", { credits: refund.retentionCredits })}
                          </div>
                        )}
                        {refund.rejectReason && (
                          <div className="mt-1 text-xs text-red-600">
                            {t("rejectReasonLabel", { reason: refund.rejectReason })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {canReview(refund.status) && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveClick(refund)}
                              disabled={updating === refund.id}
                            >
                              {t("approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectClick(refund)}
                              disabled={updating === refund.id}
                            >
                              {t("reject")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("approveDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("approveDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t("refundNoLabel")}</span>
                {selectedRefund.refundNo}
              </div>
              <div>
                <span className="text-muted-foreground">{t("companyLabel")}</span>
                {selectedRefund.companyName}
              </div>
              <div>
                <span className="text-muted-foreground">{t("refundAmountLabel")}</span>
                <span className="font-semibold text-red-600">
                  NT$ {selectedRefund.refundAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={approveRefund} disabled={updating !== null}>
              {updating ? tCommon("processing") : t("confirmApprove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectDialogTitle")}</DialogTitle>
            <DialogDescription>{t("rejectDialogDescription")}</DialogDescription>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("refundNoLabel")}</span>
                  {selectedRefund.refundNo}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("companyLabel")}</span>
                  {selectedRefund.companyName}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("refundAmountLabel")}</span>
                  <span className="font-semibold">
                    NT$ {selectedRefund.refundAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              <Textarea
                placeholder={t("rejectReasonPlaceholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={rejectRefund}
              disabled={updating !== null || !rejectReason.trim()}
            >
              {updating ? tCommon("processing") : t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
