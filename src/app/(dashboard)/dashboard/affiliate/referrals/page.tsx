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

interface Referral {
  id: string;
  company_name: string;
  registered_at: string;
  first_payment_at: string | null;
  first_payment_amount: number | null;
  total_payments: number;
  lifetime_value: number;
  total_commission_generated: number;
  is_active: boolean;
  last_payment_at: string | null;
  cancelled_at: string | null;
}

export default function AffiliateReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    fetchReferrals();
  }, [page, filter]);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/affiliate/referrals?page=${page}&limit=10&status=${filter}`,
      );

      if (!response.ok) {
        throw new Error("載入失敗");
      }

      const data = await response.json();
      setReferrals(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("載入推薦列表失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("zh-TW");
  };

  const getStatusBadge = (referral: Referral) => {
    if (referral.cancelled_at) {
      return (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">
          已取消
        </span>
      );
    }
    if (!referral.first_payment_at) {
      return (
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
          待轉換
        </span>
      );
    }
    if (referral.is_active) {
      return (
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
          活躍
        </span>
      );
    }
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-800">
        不活躍
      </span>
    );
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">推薦客戶</h1>
          <p className="text-gray-600">查看您推薦的客戶及其狀態</p>
        </div>
        <Link href="/dashboard/affiliate">
          <Button variant="outline">返回儀表板</Button>
        </Link>
      </div>

      {/* 篩選器 */}
      <Card>
        <CardHeader>
          <CardTitle>篩選</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => {
                setFilter("all");
                setPage(1);
              }}
            >
              全部
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              onClick={() => {
                setFilter("active");
                setPage(1);
              }}
            >
              活躍中
            </Button>
            <Button
              variant={filter === "inactive" ? "default" : "outline"}
              onClick={() => {
                setFilter("inactive");
                setPage(1);
              }}
            >
              不活躍
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <CardHeader>
          <CardTitle>推薦列表</CardTitle>
          <CardDescription>共 {referrals.length} 筆記錄</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">載入中...</div>
          ) : referrals.length === 0 ? (
            <div className="py-8 text-center text-gray-500">尚無推薦客戶</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>公司名稱</TableHead>
                      <TableHead>註冊日期</TableHead>
                      <TableHead>首次付款</TableHead>
                      <TableHead className="text-right">首次金額</TableHead>
                      <TableHead className="text-right">總付款次數</TableHead>
                      <TableHead className="text-right">終身價值</TableHead>
                      <TableHead className="text-right">累計佣金</TableHead>
                      <TableHead>狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">
                          {referral.company_name}
                        </TableCell>
                        <TableCell>
                          {formatDate(referral.registered_at)}
                        </TableCell>
                        <TableCell>
                          {formatDate(referral.first_payment_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          {referral.first_payment_amount
                            ? `NT$ ${referral.first_payment_amount.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {referral.total_payments}
                        </TableCell>
                        <TableCell className="text-right">
                          NT$ {referral.lifetime_value.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          NT${" "}
                          {referral.total_commission_generated.toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(referral)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分頁 */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    上一頁
                  </Button>
                  <span className="text-sm text-gray-600">
                    第 {page} / {totalPages} 頁
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    下一頁
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
