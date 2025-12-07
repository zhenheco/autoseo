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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Users,
  Link2,
  Zap,
  Clock,
} from "lucide-react";
import type {
  ReviewStatus,
  SuspicionType,
  SeverityLevel,
  SuspiciousReferralWithDetails,
} from "@/types/fraud.types";

// 可疑類型的標籤
const suspicionTypeLabels: Record<SuspicionType, string> = {
  same_device: "同裝置多帳號",
  referral_loop: "推薦環路",
  rapid_referrals: "快速推薦",
  quick_cancel: "快速取消",
};

// 可疑類型的圖示
const suspicionTypeIcons: Record<SuspicionType, React.ReactNode> = {
  same_device: <Users className="h-4 w-4" />,
  referral_loop: <Link2 className="h-4 w-4" />,
  rapid_referrals: <Zap className="h-4 w-4" />,
  quick_cancel: <Clock className="h-4 w-4" />,
};

// 嚴重程度的顏色
const severityColors: Record<SeverityLevel, string> = {
  low: "bg-yellow-100 text-yellow-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800",
  critical: "bg-purple-100 text-purple-800",
};

// 狀態的標籤
const statusLabels: Record<ReviewStatus, string> = {
  pending: "待審核",
  reviewing: "審核中",
  confirmed_fraud: "確認詐騙",
  false_positive: "誤判",
  dismissed: "已忽略",
};

export default function SuspiciousReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SuspiciousReferralWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // 詳情對話框
  const [selectedItem, setSelectedItem] =
    useState<SuspiciousReferralWithDetails | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);

      const response = await fetch(
        `/api/admin/suspicious-referrals?${params.toString()}`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "載入失敗");
      }

      setData(result.data || []);
      setTotal(result.total || 0);
    } catch (error) {
      toast.error("載入可疑推薦失敗");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, statusFilter, typeFilter, severityFilter]);

  const handleUpdateStatus = async (
    newStatus: ReviewStatus,
    actionTaken?: string,
  ) => {
    if (!selectedItem) return;

    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/suspicious-referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedItem.id,
          status: newStatus,
          review_notes: reviewNotes,
          action_taken: actionTaken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "更新失敗");
      }

      toast.success("更新成功");
      setSelectedItem(null);
      setReviewNotes("");
      fetchData();
    } catch (error) {
      toast.error("更新失敗");
      console.error(error);
    } finally {
      setIsUpdating(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">可疑推薦審核</h1>
          <p className="text-muted-foreground">
            審核系統自動偵測的可疑推薦行為
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          重新整理
        </Button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              待審核
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">
                {data.filter((d) => d.status === "pending").length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              確認詐騙
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">
                {data.filter((d) => d.status === "confirmed_fraud").length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              誤判
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {data.filter((d) => d.status === "false_positive").length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              總計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{total}</span>
          </CardContent>
        </Card>
      </div>

      {/* 篩選器 */}
      <Card>
        <CardHeader>
          <CardTitle>篩選條件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="pending">待審核</SelectItem>
                <SelectItem value="reviewing">審核中</SelectItem>
                <SelectItem value="confirmed_fraud">確認詐騙</SelectItem>
                <SelectItem value="false_positive">誤判</SelectItem>
                <SelectItem value="dismissed">已忽略</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部類型</SelectItem>
                <SelectItem value="same_device">同裝置多帳號</SelectItem>
                <SelectItem value="referral_loop">推薦環路</SelectItem>
                <SelectItem value="rapid_referrals">快速推薦</SelectItem>
                <SelectItem value="quick_cancel">快速取消</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="嚴重程度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部程度</SelectItem>
                <SelectItem value="low">低</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="critical">嚴重</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 資料表格 */}
      <Card>
        <CardHeader>
          <CardTitle>可疑推薦列表</CardTitle>
          <CardDescription>共 {total} 筆記錄</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>類型</TableHead>
                <TableHead>嚴重程度</TableHead>
                <TableHead>推薦人</TableHead>
                <TableHead>被推薦人</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>偵測時間</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    載入中...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    沒有可疑推薦記錄
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {suspicionTypeIcons[item.suspicion_type]}
                        <span>{suspicionTypeLabels[item.suspicion_type]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={severityColors[item.severity]}>
                        {item.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(item.referrer_company as { name: string } | null)
                        ?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {(item.referred_company as { name: string } | null)
                        ?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {statusLabels[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(item.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setReviewNotes(item.review_notes || "");
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分頁 */}
          {total > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                上一頁
              </Button>
              <span className="flex items-center px-4">
                第 {page} 頁，共 {Math.ceil(total / 20)} 頁
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage(page + 1)}
              >
                下一頁
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 詳情對話框 */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>可疑推薦詳情</DialogTitle>
            <DialogDescription>審核此可疑行為並決定處理方式</DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              {/* 基本資訊 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">類型</p>
                  <div className="flex items-center gap-2 mt-1">
                    {suspicionTypeIcons[selectedItem.suspicion_type]}
                    <span className="font-medium">
                      {suspicionTypeLabels[selectedItem.suspicion_type]}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">嚴重程度</p>
                  <Badge
                    className={`mt-1 ${severityColors[selectedItem.severity]}`}
                  >
                    {selectedItem.severity}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">推薦人</p>
                  <p className="font-medium">
                    {(selectedItem.referrer_company as { name: string } | null)
                      ?.name || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">被推薦人</p>
                  <p className="font-medium">
                    {(selectedItem.referred_company as { name: string } | null)
                      ?.name || "-"}
                  </p>
                </div>
              </div>

              {/* 證據 */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">偵測證據</p>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedItem.evidence, null, 2)}
                </pre>
              </div>

              {/* 審核備註 */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">審核備註</p>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="輸入審核備註..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleUpdateStatus("dismissed")}
              disabled={isUpdating}
            >
              忽略
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleUpdateStatus("false_positive")}
              disabled={isUpdating}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              標記為誤判
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                handleUpdateStatus("confirmed_fraud", "reward_cancelled")
              }
              disabled={isUpdating}
            >
              <XCircle className="h-4 w-4 mr-1" />
              確認詐騙並取消獎勵
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
