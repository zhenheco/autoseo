"use client";

import { useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Globe, CalendarClock } from "lucide-react";
import { ArticleWithWebsite, deleteArticle } from "../actions";
import { useScheduleContext } from "./ScheduleContext";

interface ArticleListProps {
  articles: ArticleWithWebsite[];
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
};

export function ArticleList({ articles }: ArticleListProps) {
  const {
    toggleSelection,
    isSelected,
    isScheduling,
    previewArticleId,
    setPreviewArticleId,
  } = useScheduleContext();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] =
    useState<ArticleWithWebsite | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = (status: string) => {
    return (
      status === "completed" || status === "draft" || status === "scheduled"
    );
  };

  const formatScheduledDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleDelete = async () => {
    if (!selectedArticle) return;
    setIsDeleting(true);
    try {
      const result = await deleteArticle(selectedArticle.id);
      if (!result.success) {
        console.error("Delete failed:", result.error);
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSelectedArticle(null);
    }
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
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>標題</TableHead>
              <TableHead className="w-[100px]">目標網站</TableHead>
              <TableHead className="w-[80px]">狀態</TableHead>
              <TableHead className="w-[90px]">建立時間</TableHead>
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
                  <TableCell className="py-2">
                    {canManage(article.status) && (
                      <Checkbox
                        checked={isSelected(article.id)}
                        onCheckedChange={() => toggleSelection(article.id)}
                        disabled={isScheduling}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-sm font-medium">
                    {article.generated_articles?.[0]?.title ||
                      article.keywords?.join(", ") ||
                      "未命名"}
                  </TableCell>
                  <TableCell className="py-2">
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
                  <TableCell className="py-2">
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
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {formatDate(article.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除這篇文章嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。文章「
              {selectedArticle?.generated_articles?.[0]?.title ||
                selectedArticle?.keywords?.join(", ") ||
                "未命名"}
              」將被永久刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "刪除中..." : "刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
