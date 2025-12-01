"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { toast } from "sonner";

type WithdrawalStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "cancelled";

interface Withdrawal {
  id: string;
  affiliate_id: string;
  withdrawal_amount: number;
  tax_amount: number;
  net_amount: number;
  status: WithdrawalStatus;
  bank_code: string;
  bank_account: string;
  account_name: string;
  created_at: string;
  processed_at: string | null;
  completed_at: string | null;
  reject_reason: string | null;
  affiliates: {
    id: string;
    companies: {
      id: string;
      name: string;
    };
  };
}

export default function AdminWithdrawalsPage() {
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch("/api/admin/withdrawals");

      if (response.status === 403) {
        toast.error("您沒有權限存取此頁面");
        return;
      }

      if (!response.ok) {
        throw new Error("載入失敗");
      }

      const data = await response.json();
      setWithdrawals(data.data || []);
    } catch (error) {
      console.error("載入提領記錄失敗:", error);
      toast.error("載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: WithdrawalStatus) => {
    setUpdating(id);
    try {
      const response = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("更新失敗");
      }

      toast.success("狀態已更新");
      fetchWithdrawals();
    } catch (error) {
      console.error("更新狀態失敗:", error);
      toast.error("更新失敗");
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

  const getStatusBadge = (status: WithdrawalStatus) => {
    const statusMap = {
      pending: { label: "待審核", className: "bg-yellow-100 text-yellow-800" },
      reviewing: { label: "審核中", className: "bg-blue-100 text-blue-800" },
      approved: { label: "已核准", className: "bg-green-100 text-green-800" },
      processing: {
        label: "處理中",
        className: "bg-purple-100 text-purple-800",
      },
      completed: { label: "已完成", className: "bg-green-200 text-green-900" },
      rejected: { label: "已拒絕", className: "bg-red-100 text-red-800" },
      cancelled: { label: "已取消", className: "bg-muted text-foreground" },
    };

    const { label, className } = statusMap[status];
    return (
      <span className={`rounded-full px-2 py-1 text-xs ${className}`}>
        {label}
      </span>
    );
  };

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">提領審核管理</h1>
          <p className="text-muted-foreground">
            審核聯盟夥伴的提領申請
            {pendingCount > 0 && (
              <span className="ml-2 text-yellow-600">
                （{pendingCount} 筆待審核）
              </span>
            )}
          </p>
        </div>
        <Link href="/dashboard/admin/affiliates">
          <Button variant="outline">聯盟夥伴管理</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>提領申請列表</CardTitle>
          <CardDescription>共 {withdrawals.length} 筆記錄</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              載入中...
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              尚無提領申請
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申請時間</TableHead>
                    <TableHead>公司名稱</TableHead>
                    <TableHead className="text-right">提領金額</TableHead>
                    <TableHead className="text-right">實際入帳</TableHead>
                    <TableHead>銀行帳戶</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>{formatDate(withdrawal.created_at)}</TableCell>
                      <TableCell>
                        {withdrawal.affiliates?.companies?.name || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        NT$ {withdrawal.withdrawal_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        NT$ {withdrawal.net_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{withdrawal.bank_code}</div>
                        <div className="text-muted-foreground">
                          {withdrawal.bank_account}
                        </div>
                        <div className="text-muted-foreground">
                          {withdrawal.account_name}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                      <TableCell>
                        {withdrawal.status !== "completed" &&
                          withdrawal.status !== "rejected" &&
                          withdrawal.status !== "cancelled" && (
                            <Select
                              value={withdrawal.status}
                              onValueChange={(value) =>
                                updateStatus(
                                  withdrawal.id,
                                  value as WithdrawalStatus,
                                )
                              }
                              disabled={updating === withdrawal.id}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">待審核</SelectItem>
                                <SelectItem value="reviewing">
                                  審核中
                                </SelectItem>
                                <SelectItem value="approved">已核准</SelectItem>
                                <SelectItem value="processing">
                                  處理中
                                </SelectItem>
                                <SelectItem value="completed">
                                  已完成
                                </SelectItem>
                                <SelectItem value="rejected">已拒絕</SelectItem>
                              </SelectContent>
                            </Select>
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
    </div>
  );
}
