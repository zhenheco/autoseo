"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Eye, Send, Trash2, Globe } from "lucide-react";
import { ArticleWithWebsite, deleteArticle } from "../actions";
import { QuickPublishDialog } from "./QuickPublishDialog";

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
  published: { label: "已發布", variant: "default" },
  failed: { label: "失敗", variant: "destructive" },
};

export function ArticleList({ articles }: ArticleListProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] =
    useState<ArticleWithWebsite | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const openDeleteDialog = (article: ArticleWithWebsite) => {
    setSelectedArticle(article);
    setDeleteDialogOpen(true);
  };

  const openPublishDialog = (article: ArticleWithWebsite) => {
    setSelectedArticle(article);
    setPublishDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || {
      label: status,
      variant: "outline" as const,
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  const canPublish = (status: string) => {
    return status === "completed" || status === "draft";
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">標題</TableHead>
              <TableHead>目標網站</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>建立時間</TableHead>
              <TableHead className="w-[70px]">操作</TableHead>
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
                <TableRow key={article.id}>
                  <TableCell className="font-medium">
                    {article.article_title ||
                      article.keywords?.join(", ") ||
                      "未命名"}
                  </TableCell>
                  <TableCell>
                    {article.website_configs ? (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        <span className="text-sm">
                          {article.website_configs.site_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        未指定
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(article.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(article.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/dashboard/articles/${article.id}`)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看詳情
                        </DropdownMenuItem>
                        {canPublish(article.status) && (
                          <DropdownMenuItem
                            onClick={() => openPublishDialog(article)}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            發布文章
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => openDeleteDialog(article)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          刪除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              此操作無法復原。文章「{selectedArticle?.article_title || "未命名"}
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

      {selectedArticle && (
        <QuickPublishDialog
          open={publishDialogOpen}
          onOpenChange={setPublishDialogOpen}
          article={selectedArticle}
        />
      )}
    </>
  );
}
