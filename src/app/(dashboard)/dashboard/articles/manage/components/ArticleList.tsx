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

interface ArticleListProps {
  articles: ArticleWithWebsite[];
  selectableArticleIds: string[];
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "生成中", variant: "secondary" },
  processing: { label: "生成中", variant: "secondary" },
  draft: { label: "草稿", variant: "outline" },
  completed: { label: "待發布", variant: "default" },
  scheduled: { label: "已排程", variant: "secondary" },
  published: { label: "已發布", variant: "default" },
  failed: { label: "失敗", variant: "destructive" },
  schedule_failed: { label: "排程失敗", variant: "destructive" },
  cancelled: { label: "已取消", variant: "outline" },
};

export function ArticleList({
  articles,
  selectableArticleIds,
}: ArticleListProps) {
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

  // 可以排程/刪除的狀態
  const canManage = (status: string) => {
    return (
      status === "completed" || status === "draft" || status === "scheduled"
    );
  };

  // 可以取消生成的狀態
  const canCancel = (status: string) => {
    return status === "pending" || status === "processing";
  };

  // 可以勾選的狀態（排程或取消）
  const canSelect = (status: string) => {
    return canManage(status) || canCancel(status);
  };

  const formatScheduledDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || {
      label: status,
      variant: "outline" as const,
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
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
            <TableHead className="px-2">標題</TableHead>
            <TableHead className="w-[90px] px-2">目標網站</TableHead>
            <TableHead className="w-[70px] px-2">狀態</TableHead>
            <TableHead className="w-[85px] px-2">建立時間</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                尚無文章
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
                  {article.generated_articles?.[0]?.title ||
                    article.keywords?.join(", ") ||
                    "未命名"}
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
                      未指定
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
  );
}
