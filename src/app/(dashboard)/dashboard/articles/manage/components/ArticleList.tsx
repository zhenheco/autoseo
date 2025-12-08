"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe, CalendarClock } from "lucide-react";
import { ArticleWithWebsite } from "../actions";
import { useScheduleContext } from "./ScheduleContext";
import { useTranslations, useLocale } from "next-intl";

interface ArticleListProps {
  articles: ArticleWithWebsite[];
  selectableArticleIds: string[];
}

// Status key to translation key mapping
const STATUS_KEYS: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  generating: "generating",
  draft: "draft",
  completed: "completed",
  scheduled: "scheduled",
  published: "published",
  failed: "failed",
  schedule_failed: "scheduleFailed",
  cancelled: "cancelled",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  processing: "secondary",
  generating: "secondary",
  draft: "outline",
  completed: "default",
  scheduled: "secondary",
  published: "default",
  failed: "destructive",
  schedule_failed: "destructive",
  cancelled: "outline",
};

export function ArticleList({
  articles,
  selectableArticleIds,
}: ArticleListProps) {
  const t = useTranslations("articles");
  const locale = useLocale();
  const {
    toggleSelection,
    isSelected,
    isScheduling,
    selectAll,
    selectedArticleIds,
    previewArticleId,
    setPreviewArticleId,
  } = useScheduleContext();

  const allSelected =
    selectableArticleIds.length > 0 &&
    selectableArticleIds.every((id) => selectedArticleIds.has(id));

  // 可以排程的狀態
  const canSchedule = (status: string) => {
    return (
      status === "completed" || status === "draft" || status === "scheduled"
    );
  };

  // 可以取消生成的狀態
  const canCancel = (status: string) => {
    return status === "pending" || status === "processing";
  };

  // 可以刪除的狀態
  const canDelete = (status: string) => {
    return (
      status === "cancelled" || status === "failed" || status === "published"
    );
  };

  // 可以勾選的狀態（排程、取消或刪除）
  const canSelect = (status: string) => {
    return canSchedule(status) || canCancel(status) || canDelete(status);
  };

  const formatScheduledDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString(locale, {
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const translationKey = STATUS_KEYS[status] || status;
    const variant = STATUS_VARIANTS[status] || "outline";
    return <Badge variant={variant}>{t(`status.${translationKey}`)}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // 手機版卡片
  const MobileCard = ({ article }: { article: ArticleWithWebsite }) => (
    <div
      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
        previewArticleId === article.id
          ? "bg-muted border-primary"
          : "hover:bg-muted/50"
      }`}
      onClick={() => setPreviewArticleId(article.id)}
    >
      <div className="flex items-start gap-3">
        {canSelect(article.status) && (
          <Checkbox
            checked={isSelected(article.id)}
            onCheckedChange={() => toggleSelection(article.id)}
            disabled={isScheduling}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-2">
            {article.generated_articles?.title ||
              article.keywords?.join(", ") ||
              t("table.untitled")}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {getStatusBadge(article.status)}
            {article.status === "scheduled" && article.scheduled_publish_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {formatScheduledDate(article.scheduled_publish_at)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{formatDate(article.created_at)}</span>
            {article.website_configs && (
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>{article.website_configs.website_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 手機版：卡片列表 */}
      <div className="lg:hidden space-y-2">
        {/* 全選 */}
        {selectableArticleIds.length > 0 && (
          <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => selectAll(selectableArticleIds)}
              disabled={isScheduling}
            />
            <span className="text-sm text-muted-foreground">
              {t("table.selectAll")}
            </span>
          </div>
        )}
        {articles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("table.noArticles")}
          </div>
        ) : (
          articles.map((article) => (
            <MobileCard key={article.id} article={article} />
          ))
        )}
      </div>

      {/* 桌面版：表格 */}
      <div className="hidden lg:block rounded-md border overflow-auto max-h-full">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[32px] px-2">
                {selectableArticleIds.length > 0 && (
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => selectAll(selectableArticleIds)}
                    disabled={isScheduling}
                  />
                )}
              </TableHead>
              <TableHead className="px-2">{t("table.title")}</TableHead>
              <TableHead className="w-[90px] px-2">
                {t("table.targetWebsite")}
              </TableHead>
              <TableHead className="w-[70px] px-2">
                {t("table.status")}
              </TableHead>
              <TableHead className="w-[85px] px-2">
                {t("table.createdAt")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {t("table.noArticles")}
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => (
                <TableRow
                  key={article.id}
                  className={`cursor-pointer transition-colors ${previewArticleId === article.id ? "bg-muted" : "hover:bg-muted/50"}`}
                  onClick={() => setPreviewArticleId(article.id)}
                >
                  <TableCell className="py-2 px-2">
                    {canSelect(article.status) && (
                      <Checkbox
                        checked={isSelected(article.id)}
                        onCheckedChange={() => toggleSelection(article.id)}
                        disabled={isScheduling}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </TableCell>
                  <TableCell className="py-2 px-2 text-sm font-medium">
                    {article.generated_articles?.title ||
                      article.keywords?.join(", ") ||
                      t("table.untitled")}
                  </TableCell>
                  <TableCell className="py-2 px-2">
                    {article.website_configs ? (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        <span className="text-xs">
                          {article.website_configs.website_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {t("table.unspecified")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 px-2">
                    <div className="flex flex-col gap-0.5">
                      {getStatusBadge(article.status)}
                      {article.status === "scheduled" &&
                        article.scheduled_publish_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {formatScheduledDate(article.scheduled_publish_at)}
                          </span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-2 text-xs text-muted-foreground">
                    {formatDate(article.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
