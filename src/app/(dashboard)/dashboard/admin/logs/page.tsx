"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface AdminLog {
  id: string;
  adminEmail: string;
  actionType: string;
  actionTypeText: string;
  targetType: string;
  targetTypeText: string;
  targetId: string;
  targetName: string | null;
  actionDetails: Record<string, unknown>;
  createdAt: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");

  const limit = 20;

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, actionTypeFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (actionTypeFilter !== "all") {
        params.set("actionType", actionTypeFilter);
      }

      const res = await fetch(`/api/admin/logs?${params}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.data);
        setTotal(data.pagination.total);
      } else {
        toast.error(data.error || "取得操作記錄失敗");
      }
    } catch {
      toast.error("取得操作記錄失敗");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDetails = (details: Record<string, unknown>) => {
    const entries = Object.entries(details).filter(
      ([key]) => key !== "previous_values" && key !== "new_values",
    );

    if (entries.length === 0) return "-";

    return entries
      .map(([key, value]) => {
        const label =
          {
            days_extended: "延長天數",
            articles_granted: "贈送篇數",
            previous_remaining: "原有篇數",
            new_remaining: "新篇數",
            previous_end_date: "原到期日",
            new_end_date: "新到期日",
            reason: "原因",
            bonus_articles: "加送篇數",
            max_uses: "使用上限",
          }[key] || key;

        return `${label}: ${value}`;
      })
      .join(", ");
  };

  const getActionBadgeVariant = (actionType: string) => {
    switch (actionType) {
      case "extend_subscription":
      case "grant_articles":
        return "default";
      case "create_promo_code":
        return "secondary";
      case "deactivate_promo_code":
        return "destructive";
      default:
        return "outline";
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">操作記錄</h1>
        <p className="text-muted-foreground">查看所有管理員操作記錄</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>操作記錄</CardTitle>
              <CardDescription>共 {total} 筆記錄</CardDescription>
            </div>
            <Select
              value={actionTypeFilter}
              onValueChange={(value) => {
                setActionTypeFilter(value);
                setOffset(0);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="篩選操作類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部類型</SelectItem>
                <SelectItem value="extend_subscription">延長訂閱</SelectItem>
                <SelectItem value="grant_articles">贈送篇數</SelectItem>
                <SelectItem value="create_promo_code">建立優惠碼</SelectItem>
                <SelectItem value="update_promo_code">更新優惠碼</SelectItem>
                <SelectItem value="deactivate_promo_code">
                  停用優惠碼
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>時間</TableHead>
                      <TableHead>管理員</TableHead>
                      <TableHead>操作類型</TableHead>
                      <TableHead>目標</TableHead>
                      <TableHead>詳情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>{log.adminEmail}</TableCell>
                        <TableCell>
                          <Badge
                            variant={getActionBadgeVariant(log.actionType)}
                          >
                            {log.actionTypeText}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">
                            {log.targetTypeText}:
                          </span>{" "}
                          {log.targetName || log.targetId.slice(0, 8)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {formatDetails(log.actionDetails)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分頁 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    第 {currentPage} 頁，共 {totalPages} 頁
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      上一頁
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + limit >= total}
                      onClick={() => setOffset(offset + limit)}
                    >
                      下一頁
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
