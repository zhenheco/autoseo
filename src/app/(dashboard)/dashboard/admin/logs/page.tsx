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
  const t = useTranslations("admin.logs");
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
        toast.error(data.error || t("loadFailed"));
      }
    } catch {
      toast.error(t("loadFailed"));
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

    const labelMap: Record<string, string> = {
      days_extended: t("detailLabels.daysExtended"),
      articles_granted: t("detailLabels.articlesGranted"),
      previous_remaining: t("detailLabels.previousRemaining"),
      new_remaining: t("detailLabels.newRemaining"),
      previous_end_date: t("detailLabels.previousEndDate"),
      new_end_date: t("detailLabels.newEndDate"),
      reason: t("detailLabels.reason"),
      bonus_articles: t("detailLabels.bonusArticles"),
      max_uses: t("detailLabels.maxUses"),
    };

    return entries
      .map(([key, value]) => {
        const label = labelMap[key] || key;
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
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("listTitle")}</CardTitle>
              <CardDescription>{t("listDescription", { count: total })}</CardDescription>
            </div>
            <Select
              value={actionTypeFilter}
              onValueChange={(value) => {
                setActionTypeFilter(value);
                setOffset(0);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("filterActionType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("actionTypeAll")}</SelectItem>
                <SelectItem value="extend_subscription">{t("actionTypeExtendSubscription")}</SelectItem>
                <SelectItem value="grant_articles">{t("actionTypeGrantArticles")}</SelectItem>
                <SelectItem value="create_promo_code">{t("actionTypeCreatePromoCode")}</SelectItem>
                <SelectItem value="update_promo_code">{t("actionTypeUpdatePromoCode")}</SelectItem>
                <SelectItem value="deactivate_promo_code">
                  {t("actionTypeDeactivatePromoCode")}
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
                      <TableHead>{t("columns.time")}</TableHead>
                      <TableHead>{t("columns.admin")}</TableHead>
                      <TableHead>{t("columns.actionType")}</TableHead>
                      <TableHead>{t("columns.target")}</TableHead>
                      <TableHead>{t("columns.details")}</TableHead>
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
                    {t("paginationInfo", { current: currentPage, total: totalPages })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t("prevPage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + limit >= total}
                      onClick={() => setOffset(offset + limit)}
                    >
                      {t("nextPage")}
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
