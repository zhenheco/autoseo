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

interface Withdrawal {
  id: string;
  withdrawal_amount: number;
  tax_amount: number;
  net_amount: number;
  status:
    | "pending"
    | "reviewing"
    | "approved"
    | "processing"
    | "completed"
    | "rejected"
    | "cancelled";
  created_at: string;
  processed_at: string | null;
  completed_at: string | null;
}

export default function AffiliateWithdrawalsPage() {
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch("/api/affiliate/withdraw");

      if (!response.ok) {
        throw new Error("載入失敗");
      }

      const data = await response.json();
      setWithdrawals(data.data);
    } catch (error) {
      console.error("載入提領記錄失敗:", error);
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: Withdrawal["status"]) => {
    const statusMap = {
      pending: { label: "待審核", className: "bg-amber-500/20 text-amber-400" },
      reviewing: {
        label: "審核中",
        className: "bg-cyber-cyan-500/20 text-cyber-cyan-400",
      },
      approved: {
        label: "已核准",
        className: "bg-emerald-500/20 text-emerald-400",
      },
      processing: {
        label: "處理中",
        className: "bg-cyber-violet-500/20 text-cyber-violet-400",
      },
      completed: {
        label: "已完成",
        className: "bg-emerald-500/20 text-emerald-400",
      },
      rejected: { label: "已拒絕", className: "bg-red-500/20 text-red-400" },
      cancelled: { label: "已取消", className: "bg-slate-700 text-slate-400" },
    };

    const { label, className } = statusMap[status];
    return (
      <span className={`rounded-full px-2 py-1 text-xs ${className}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">提領記錄</h1>
          <p className="text-slate-400">查看所有提領申請的狀態</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/affiliate/withdraw">
            <Button>申請提領</Button>
          </Link>
          <Link href="/dashboard/affiliate">
            <Button variant="outline">返回儀表板</Button>
          </Link>
        </div>
      </div>

      {/* 列表 */}
      <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">提領申請列表</CardTitle>
          <CardDescription className="text-slate-400">
            共 {withdrawals.length} 筆記錄
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-400">載入中...</div>
          ) : withdrawals.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-slate-400 mb-4">尚無提領記錄</p>
              <Link href="/dashboard/affiliate/withdraw">
                <Button>立即申請提領</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申請時間</TableHead>
                    <TableHead className="text-right">提領金額</TableHead>
                    <TableHead className="text-right">扣稅</TableHead>
                    <TableHead className="text-right">實際入帳</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>處理時間</TableHead>
                    <TableHead>完成時間</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>{formatDate(withdrawal.created_at)}</TableCell>
                      <TableCell className="text-right">
                        NT$ {withdrawal.withdrawal_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-400">
                        -NT$ {withdrawal.tax_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-400">
                        NT$ {withdrawal.net_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                      <TableCell>
                        {formatDate(withdrawal.processed_at)}
                      </TableCell>
                      <TableCell>
                        {formatDate(withdrawal.completed_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 說明 */}
      <Card className="border-cyber-violet-500/30 bg-cyber-violet-500/10">
        <CardContent className="pt-6">
          <h4 className="font-medium text-white mb-2">提領流程說明</h4>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex items-start gap-2">
              <span className="font-semibold min-w-24 text-white">
                待審核：
              </span>
              <span>系統已收到您的提領申請</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold min-w-24 text-white">
                審核中：
              </span>
              <span>管理員正在審核您的申請和證件</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold min-w-24 text-white">
                已核准：
              </span>
              <span>申請已核准，等待撥款</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold min-w-24 text-white">
                處理中：
              </span>
              <span>正在進行銀行轉帳</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold min-w-24 text-white">
                已完成：
              </span>
              <span>款項已撥付到您的銀行帳戶</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
