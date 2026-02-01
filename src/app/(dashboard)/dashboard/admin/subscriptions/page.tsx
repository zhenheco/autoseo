"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.subscriptions");
  const tCommon = useTranslations("admin.common");
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
        toast.error(data.error || t("loadFailed"));
      }
    } catch {
      toast.error(t("loadFailed"));
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
          t("extendSuccess", { companyName: selectedCompany.companyName, days }),
        );
        setExtendDialogOpen(false);
        setDays("");
        setReason("");
        fetchSubscriptions();
      } else {
        toast.error(data.error || t("extendFailed"));
      }
    } catch {
      toast.error(t("extendFailed"));
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
          t("grantSuccess", { companyName: selectedCompany.companyName, articles }),
        );
        setGrantDialogOpen(false);
        setArticles("");
        setReason("");
        fetchSubscriptions();
      } else {
        toast.error(data.error || t("grantFailed"));
      }
    } catch {
      toast.error(t("grantFailed"));
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
      return <Badge variant="default">{t("statusLifetime")}</Badge>;
    }
    switch (status) {
      case "active":
        return <Badge variant="default">{t("statusActive")}</Badge>;
      case "past_due":
        return <Badge variant="destructive">{t("statusPastDue")}</Badge>;
      case "cancelled":
        return <Badge variant="secondary">{t("statusCancelled")}</Badge>;
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
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription", { count: subscriptions.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 篩選區塊 */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder={t("filterStatusAll")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
                <SelectItem value="active">{t("filterStatusActive")}</SelectItem>
                <SelectItem value="past_due">{t("filterStatusPastDue")}</SelectItem>
                <SelectItem value="cancelled">{t("filterStatusCancelled")}</SelectItem>
                <SelectItem value="lifetime">{t("filterStatusLifetime")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder={t("filterPlanAll")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterPlanAll")}</SelectItem>
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
                  <TableHead className="w-[180px]">{t("columns.companyName")}</TableHead>
                  <TableHead className="w-[140px]">{t("columns.plan")}</TableHead>
                  <TableHead className="w-[80px]">{t("columns.status")}</TableHead>
                  <TableHead className="w-[100px] text-right">
                    {t("columns.remainingArticles")}
                  </TableHead>
                  <TableHead className="w-[100px]">{t("columns.expiresAt")}</TableHead>
                  <TableHead className="w-[100px] text-right">{t("columns.actions")}</TableHead>
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
                          ({sub.billingCycle === "yearly" ? t("billingCycleYearly") : t("billingCycleMonthly")})
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
                          title={t("extendButton")}
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
                          title={t("grantButton")}
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
            <DialogTitle>{t("extendDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("extendDialogDescription", { companyName: selectedCompany?.companyName ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="days">{t("form.days")}</Label>
              <Input
                id="days"
                type="number"
                placeholder={t("form.daysPlaceholder")}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">{t("form.reason")}</Label>
              <Textarea
                id="reason"
                placeholder={t("form.reasonPlaceholder")}
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
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleExtend} disabled={submitting || !days}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("confirmExtend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 贈送篇數對話框 */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("grantDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("grantDialogDescription", { companyName: selectedCompany?.companyName ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="articles">{t("form.articles")}</Label>
              <Input
                id="articles"
                type="number"
                placeholder={t("form.articlesPlaceholder")}
                value={articles}
                onChange={(e) => setArticles(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-reason">{t("form.reason")}</Label>
              <Textarea
                id="grant-reason"
                placeholder={t("form.grantReasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleGrant} disabled={submitting || !articles}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("confirmGrant")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
