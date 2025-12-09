"use client";

import { useEffect, useState } from "react";
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

const reasonCategoryMap: Record<string, string> = {
  product_issue: "產品功能問題",
  service_unsatisfied: "服務不滿意",
  billing_error: "帳務問題",
  change_of_mind: "改變心意",
  other: "其他",
};

const paymentTypeMap: Record<string, string> = {
  lifetime: "終身方案",
  token_package: "Token 包",
  subscription: "月繳訂閱",
};

export default function AdminRefundsPage() {
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
        toast.error("您沒有權限存取此頁面");
        return;
      }

      if (!response.ok) {
        throw new Error("載入失敗");
      }

      const data = await response.json();
      setRefunds(data.data || []);
    } catch (error) {
      console.error("載入退款記錄失敗:", error);
      toast.error("載入失敗");
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
        throw new Error(data.error || "核准失敗");
      }

      toast.success("退款已核准並執行");
      setApproveDialogOpen(false);
      fetchRefunds();
    } catch (error) {
      console.error("核准退款失敗:", error);
      toast.error(error instanceof Error ? error.message : "核准失敗");
    } finally {
      setUpdating(null);
    }
  };

  const rejectRefund = async () => {
    if (!selectedRefund) return;

    if (!rejectReason.trim()) {
      toast.error("請填寫拒絕原因");
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
        throw new Error(data.error || "拒絕失敗");
      }

      toast.success("退款申請已拒絕");
      setRejectDialogOpen(false);
      fetchRefunds();
    } catch (error) {
      console.error("拒絕退款失敗:", error);
      toast.error(error instanceof Error ? error.message : "拒絕失敗");
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
          <h1 className="text-3xl font-bold">退款審核管理</h1>
          <p className="text-muted-foreground">
            審核用戶的退款申請
            {pendingReviewCount > 0 && (
              <span className="ml-2 text-orange-600">
                （{pendingReviewCount} 筆待審核）
              </span>
            )}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="篩選狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="pending">待處理</SelectItem>
            <SelectItem value="pending_review">待審核</SelectItem>
            <SelectItem value="retention_accepted">已接受慰留</SelectItem>
            <SelectItem value="auto_processing">自動處理中</SelectItem>
            <SelectItem value="approved">已核准</SelectItem>
            <SelectItem value="processing">處理中</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
            <SelectItem value="rejected">已拒絕</SelectItem>
            <SelectItem value="failed">失敗</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>退款申請列表</CardTitle>
          <CardDescription>共 {refunds.length} 筆記錄</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              載入中...
            </div>
          ) : refunds.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              尚無退款申請
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申請時間</TableHead>
                    <TableHead>退款編號</TableHead>
                    <TableHead>公司名稱</TableHead>
                    <TableHead>訂單類型</TableHead>
                    <TableHead className="text-right">退款金額</TableHead>
                    <TableHead>退款原因</TableHead>
                    <TableHead>購買天數</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>操作</TableHead>
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
                          {refund.daysSincePurchase} 天
                        </span>
                        {refund.isAutoEligible && (
                          <span className="ml-1 text-xs text-green-600">
                            (自動)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(refund.status, refund.statusText)}
                        {refund.retentionAccepted && (
                          <div className="mt-1 text-xs text-green-600">
                            已接受 {refund.retentionCredits} credits
                          </div>
                        )}
                        {refund.rejectReason && (
                          <div className="mt-1 text-xs text-red-600">
                            拒絕原因: {refund.rejectReason}
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
                              核准
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectClick(refund)}
                              disabled={updating === refund.id}
                            >
                              拒絕
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
            <DialogTitle>確認核准退款</DialogTitle>
            <DialogDescription>
              確定要核准此退款申請嗎？核准後將自動執行退款。
            </DialogDescription>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">退款編號：</span>
                {selectedRefund.refundNo}
              </div>
              <div>
                <span className="text-muted-foreground">公司：</span>
                {selectedRefund.companyName}
              </div>
              <div>
                <span className="text-muted-foreground">退款金額：</span>
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
              取消
            </Button>
            <Button onClick={approveRefund} disabled={updating !== null}>
              {updating ? "處理中..." : "確認核准"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒絕退款申請</DialogTitle>
            <DialogDescription>請填寫拒絕此退款申請的原因。</DialogDescription>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">退款編號：</span>
                  {selectedRefund.refundNo}
                </div>
                <div>
                  <span className="text-muted-foreground">公司：</span>
                  {selectedRefund.companyName}
                </div>
                <div>
                  <span className="text-muted-foreground">退款金額：</span>
                  <span className="font-semibold">
                    NT$ {selectedRefund.refundAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              <Textarea
                placeholder="請輸入拒絕原因..."
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
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={rejectRefund}
              disabled={updating !== null || !rejectReason.trim()}
            >
              {updating ? "處理中..." : "確認拒絕"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
