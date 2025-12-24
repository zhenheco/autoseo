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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Calendar, Gift, Search } from "lucide-react";
import { toast } from "sonner";

interface Subscription {
  id: string;
  companyId: string;
  companyName: string;
  planName: string;
  planSlug: string;
  status: string;
  articlesPerMonth: number;
  subscriptionArticlesRemaining: number;
  purchasedArticlesRemaining: number;
  totalArticlesRemaining: number;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  isLifetime: boolean;
  createdAt: string;
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<
    Subscription[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");

  // 對話框狀態
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Subscription | null>(
    null,
  );
  const [days, setDays] = useState("");
  const [articles, setArticles] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    let result = subscriptions;

    // 搜尋過濾
    if (searchTerm) {
      result = result.filter(
        (sub) =>
          sub.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sub.planName.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // 狀態過濾
    if (statusFilter !== "all") {
      if (statusFilter === "lifetime") {
        result = result.filter((sub) => sub.isLifetime);
      } else {
        result = result.filter(
          (sub) => !sub.isLifetime && sub.status === statusFilter,
        );
      }
    }

    // 方案過濾
    if (planFilter !== "all") {
      result = result.filter((sub) => sub.planSlug === planFilter);
    }

    setFilteredSubscriptions(result);
  }, [searchTerm, statusFilter, planFilter, subscriptions]);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch("/api/admin/subscriptions");
      const data = await res.json();

      if (data.success) {
        setSubscriptions(data.data);
        setFilteredSubscriptions(data.data);
      } else {
        toast.error(data.error || "取得訂閱列表失敗");
      }
    } catch {
      toast.error("取得訂閱列表失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!selectedCompany || !days) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/subscriptions/${selectedCompany.companyId}/extend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: parseInt(days), reason }),
        },
      );

      const data = await res.json();

      if (data.success) {
        toast.success(
          `已延長 ${selectedCompany.companyName} 的訂閱 ${days} 天`,
        );
        setExtendDialogOpen(false);
        setDays("");
        setReason("");
        fetchSubscriptions();
      } else {
        toast.error(data.error || "延長訂閱失敗");
      }
    } catch {
      toast.error("延長訂閱失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedCompany || !articles) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/subscriptions/${selectedCompany.companyId}/grant-articles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articles: parseInt(articles), reason }),
        },
      );

      const data = await res.json();

      if (data.success) {
        toast.success(
          `已贈送 ${selectedCompany.companyName} ${articles} 篇文章`,
        );
        setGrantDialogOpen(false);
        setArticles("");
        setReason("");
        fetchSubscriptions();
      } else {
        toast.error(data.error || "贈送篇數失敗");
      }
    } catch {
      toast.error("贈送篇數失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("zh-TW");
  };

  const getStatusBadge = (status: string, isLifetime: boolean) => {
    if (isLifetime) {
      return <Badge variant="default">終身</Badge>;
    }
    switch (status) {
      case "active":
        return <Badge variant="default">有效</Badge>;
      case "past_due":
        return <Badge variant="destructive">已過期</Badge>;
      case "cancelled":
        return <Badge variant="secondary">已取消</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">會員訂閱管理</h1>
        <p className="text-muted-foreground">查看和管理所有會員的訂閱狀態</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>訂閱列表</CardTitle>
          <CardDescription>共 {subscriptions.length} 個訂閱</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 篩選區塊 */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋公司名稱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="全部狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="active">有效</SelectItem>
                <SelectItem value="past_due">已過期</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
                <SelectItem value="lifetime">終身</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="全部方案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方案</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
              </SelectContent>
            </Select>

            {(statusFilter !== "all" || planFilter !== "all" || searchTerm) && (
              <span className="text-sm text-muted-foreground">
                {filteredSubscriptions.length} / {subscriptions.length}
              </span>
            )}
          </div>

          {/* 表格 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">公司名稱</TableHead>
                  <TableHead className="w-[140px]">方案</TableHead>
                  <TableHead className="w-[80px]">狀態</TableHead>
                  <TableHead className="w-[100px] text-right">
                    剩餘篇數
                  </TableHead>
                  <TableHead className="w-[100px]">到期日</TableHead>
                  <TableHead className="w-[100px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.companyName}
                    </TableCell>
                    <TableCell>
                      {sub.planName}
                      {sub.billingCycle && (
                        <span className="text-muted-foreground ml-1">
                          ({sub.billingCycle === "yearly" ? "年繳" : "月繳"})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sub.status, sub.isLifetime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">
                        {sub.totalArticlesRemaining}
                      </span>
                      <span className="text-muted-foreground text-sm ml-1">
                        ({sub.subscriptionArticlesRemaining} +{" "}
                        {sub.purchasedArticlesRemaining})
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(sub.currentPeriodEnd)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="延長訂閱"
                          onClick={() => {
                            setSelectedCompany(sub);
                            setExtendDialogOpen(true);
                          }}
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="贈送篇數"
                          onClick={() => {
                            setSelectedCompany(sub);
                            setGrantDialogOpen(true);
                          }}
                        >
                          <Gift className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 延長訂閱對話框 */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>延長訂閱期限</DialogTitle>
            <DialogDescription>
              為 {selectedCompany?.companyName} 延長訂閱期限
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="days">延長天數</Label>
              <Input
                id="days"
                type="number"
                placeholder="例如：30"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">原因（選填）</Label>
              <Textarea
                id="reason"
                placeholder="例如：客戶要求延長、補償方案..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtendDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleExtend} disabled={submitting || !days}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              確認延長
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 贈送篇數對話框 */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>贈送文章篇數</DialogTitle>
            <DialogDescription>
              為 {selectedCompany?.companyName} 贈送額外文章篇數
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="articles">贈送篇數</Label>
              <Input
                id="articles"
                type="number"
                placeholder="例如：5"
                value={articles}
                onChange={(e) => setArticles(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-reason">原因（選填）</Label>
              <Textarea
                id="grant-reason"
                placeholder="例如：促銷活動、客戶補償..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleGrant} disabled={submitting || !articles}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              確認贈送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
