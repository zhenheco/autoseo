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

interface Commission {
  id: string;
  company_name: string;
  order_amount: number;
  commission_amount: number;
  tax_amount: number;
  net_commission: number;
  earned_at: string;
  unlock_at: string;
  status: "locked" | "available" | "withdrawn" | "cancelled";
  withdrawn_at: string | null;
}

interface Summary {
  total_locked: number;
  total_available: number;
  total_withdrawn: number;
}

export default function AffiliateCommissionsPage() {
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_locked: 0,
    total_available: 0,
    total_withdrawn: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<
    "all" | "locked" | "available" | "withdrawn"
  >("all");

  useEffect(() => {
    fetchCommissions();
  }, [page, filter]);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/affiliate/commissions?page=${page}&limit=10&status=${filter}`,
      );

      if (!response.ok) {
        throw new Error("載入失敗");
      }

      const data = await response.json();
      setCommissions(data.data);
      setSummary(data.summary);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("載入佣金列表失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getStatusBadge = (status: Commission["status"]) => {
    const statusMap = {
      locked: { label: "鎖定中", className: "bg-amber-500/20 text-amber-400" },
      available: {
        label: "可提領",
        className: "bg-emerald-500/20 text-emerald-400",
      },
      withdrawn: {
        label: "已提領",
        className: "bg-cyber-cyan-500/20 text-cyber-cyan-400",
      },
      cancelled: { label: "已取消", className: "bg-red-500/20 text-red-400" },
    };

    const { label, className } = statusMap[status];
    return (
      <span className={`rounded-full px-2 py-1 text-xs ${className}`}>
        {label}
      </span>
    );
  };

  const getDaysUntilUnlock = (unlockDate: string) => {
    const now = new Date();
    const unlock = new Date(unlockDate);
    const diffTime = unlock.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "已解鎖";
    if (diffDays === 1) return "明天解鎖";
    return `${diffDays} 天後解鎖`;
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">佣金明細</h1>
          <p className="text-slate-400">查看您的所有佣金記錄</p>
        </div>
        <Link href="/dashboard/affiliate">
          <Button variant="outline">返回儀表板</Button>
        </Link>
      </div>

      {/* 摘要卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              鎖定中佣金
            </CardDescription>
            <CardTitle className="text-2xl text-amber-400">
              NT$ {summary.total_locked.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">30天後可提領</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              可提領佣金
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-400">
              NT$ {summary.total_available.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/affiliate/withdraw">
              <Button size="sm" className="w-full">
                立即提領
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              已提領佣金
            </CardDescription>
            <CardTitle className="text-2xl text-cyber-cyan-400">
              NT$ {summary.total_withdrawn.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">歷史總計</p>
          </CardContent>
        </Card>
      </div>

      {/* 篩選器 */}
      <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">篩選</CardTitle>
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
              variant={filter === "locked" ? "default" : "outline"}
              onClick={() => {
                setFilter("locked");
                setPage(1);
              }}
            >
              鎖定中
            </Button>
            <Button
              variant={filter === "available" ? "default" : "outline"}
              onClick={() => {
                setFilter("available");
                setPage(1);
              }}
            >
              可提領
            </Button>
            <Button
              variant={filter === "withdrawn" ? "default" : "outline"}
              onClick={() => {
                setFilter("withdrawn");
                setPage(1);
              }}
            >
              已提領
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">佣金記錄</CardTitle>
          <CardDescription className="text-slate-400">
            共 {commissions.length} 筆記錄
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-400">載入中...</div>
          ) : commissions.length === 0 ? (
            <div className="py-8 text-center text-slate-400">尚無佣金記錄</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客戶</TableHead>
                      <TableHead className="text-right">訂單金額</TableHead>
                      <TableHead className="text-right">佣金 (20%)</TableHead>
                      <TableHead className="text-right">扣稅</TableHead>
                      <TableHead className="text-right">實際佣金</TableHead>
                      <TableHead>賺取時間</TableHead>
                      <TableHead>解鎖時間</TableHead>
                      <TableHead>狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((comm) => (
                      <TableRow key={comm.id}>
                        <TableCell className="font-medium text-white">
                          {comm.company_name}
                        </TableCell>
                        <TableCell className="text-right">
                          NT$ {comm.order_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          NT$ {comm.commission_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-400">
                          -NT$ {comm.tax_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-400">
                          NT$ {comm.net_commission.toLocaleString()}
                        </TableCell>
                        <TableCell>{formatDate(comm.earned_at)}</TableCell>
                        <TableCell>
                          {comm.status === "locked" ? (
                            <span className="text-sm text-slate-400">
                              {getDaysUntilUnlock(comm.unlock_at)}
                            </span>
                          ) : (
                            formatDate(comm.unlock_at)
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(comm.status)}</TableCell>
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
                  <span className="text-sm text-slate-400">
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
