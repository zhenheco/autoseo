"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  CalendarClock,
  Loader2,
  XCircle,
  Trash2,
  StopCircle,
} from "lucide-react";
import { useScheduleContext } from "./ScheduleContext";
import {
  scheduleArticlesForPublish,
  cancelArticleSchedule,
  batchDeleteArticles,
  batchCancelArticleGeneration,
} from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ScheduleControlBarProps {
  schedulableArticleIds: string[];
  cancellableArticleIds: string[];
}

export function ScheduleControlBar({
  schedulableArticleIds,
  cancellableArticleIds,
}: ScheduleControlBarProps) {
  const router = useRouter();
  const {
    selectedArticleIds,
    clearSelection,
    websiteId,
    setWebsiteId,
    articlesPerDay,
    setArticlesPerDay,
    isScheduling,
    setIsScheduling,
  } = useScheduleContext();

  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelGenerationDialogOpen, setCancelGenerationDialogOpen] =
    useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancellingGeneration, setIsCancellingGeneration] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedCount = selectedArticleIds.size;

  const handleSchedule = useCallback(async () => {
    if (selectedCount === 0) {
      toast.error("請先選擇要排程的文章");
      return;
    }
    if (!websiteId) {
      toast.error("請選擇發布網站");
      return;
    }

    setError(null);
    setIsScheduling(true);

    try {
      const result = await scheduleArticlesForPublish(
        Array.from(selectedArticleIds),
        websiteId,
        articlesPerDay,
      );

      if (!result.success) {
        setError(result.error || "排程失敗");
        toast.error(result.error || "排程失敗");
        return;
      }

      toast.success(`已排程 ${result.scheduledCount} 篇文章`);
      router.refresh();
    } catch (err) {
      console.error("Schedule error:", err);
      const errorMessage = err instanceof Error ? err.message : "排程發生錯誤";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsScheduling(false);
    }
  }, [
    selectedCount,
    websiteId,
    selectedArticleIds,
    articlesPerDay,
    setIsScheduling,
    router,
  ]);

  const handleCancelSchedule = useCallback(async () => {
    if (selectedCount === 0) {
      toast.error("請先選擇要取消排程的文章");
      return;
    }

    setIsCancelling(true);
    let cancelledCount = 0;

    try {
      for (const articleId of selectedArticleIds) {
        const result = await cancelArticleSchedule(articleId);
        if (result.success) {
          cancelledCount++;
        }
      }

      if (cancelledCount > 0) {
        toast.success(`已取消 ${cancelledCount} 篇文章的排程`);
        router.refresh();
      } else {
        toast.error("沒有文章被取消排程");
      }
    } catch (err) {
      console.error("Cancel schedule error:", err);
      toast.error("取消排程發生錯誤");
    } finally {
      setIsCancelling(false);
    }
  }, [selectedCount, selectedArticleIds, router]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedCount === 0) {
      toast.error("請先選擇要刪除的文章");
      return;
    }

    setIsDeleting(true);

    try {
      const result = await batchDeleteArticles(Array.from(selectedArticleIds));

      if (result.success) {
        toast.success(`已刪除 ${result.deletedCount} 篇文章`);
        clearSelection();
        router.refresh();
      } else {
        toast.error(result.error || "刪除失敗");
      }
    } catch (err) {
      console.error("Batch delete error:", err);
      toast.error("刪除發生錯誤");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [selectedCount, selectedArticleIds, clearSelection, router]);

  // 計算選中的可取消文章數量
  const selectedCancellableIds = Array.from(selectedArticleIds).filter((id) =>
    cancellableArticleIds.includes(id),
  );

  const handleCancelGeneration = useCallback(async () => {
    if (selectedCancellableIds.length === 0) {
      toast.error("沒有選中可取消的生成中文章");
      return;
    }

    setIsCancellingGeneration(true);

    try {
      const result = await batchCancelArticleGeneration(selectedCancellableIds);

      if (result.success) {
        const refundMsg =
          result.totalRefunded && result.totalRefunded > 0
            ? `，已退還 ${result.totalRefunded.toLocaleString()} tokens`
            : "";
        toast.success(
          `已取消 ${result.cancelledCount} 篇文章的生成${refundMsg}`,
        );
        clearSelection();
        router.refresh();
        // 觸發餘額更新事件
        window.dispatchEvent(new CustomEvent("tokenReserved"));
      } else {
        toast.error(result.error || "取消失敗");
      }
    } catch (err) {
      console.error("Cancel generation error:", err);
      toast.error("取消生成發生錯誤");
    } finally {
      setIsCancellingGeneration(false);
      setCancelGenerationDialogOpen(false);
    }
  }, [selectedCancellableIds, clearSelection, router]);

  // 如果沒有可管理的文章，不顯示控制欄
  if (
    schedulableArticleIds.length === 0 &&
    cancellableArticleIds.length === 0
  ) {
    return null;
  }

  return (
    <div className="border rounded-lg p-3 mb-4 bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            每日
          </span>
          <Select
            value={articlesPerDay.toString()}
            onValueChange={(v) => setArticlesPerDay(parseInt(v))}
            disabled={isScheduling}
          >
            <SelectTrigger className="w-[60px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            篇
          </span>
        </div>

        <Button
          size="sm"
          onClick={handleSchedule}
          disabled={
            isScheduling ||
            isCancelling ||
            isDeleting ||
            selectedCount === 0 ||
            !websiteId
          }
          className="whitespace-nowrap"
        >
          {isScheduling ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              排程中...
            </>
          ) : (
            <>
              <CalendarClock className="mr-1 h-3 w-3" />
              排程
            </>
          )}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleCancelSchedule}
          disabled={
            isScheduling || isCancelling || isDeleting || selectedCount === 0
          }
          className="whitespace-nowrap"
        >
          {isCancelling ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              取消中...
            </>
          ) : (
            <>
              <XCircle className="mr-1 h-3 w-3" />
              取消排程
            </>
          )}
        </Button>

        {selectedCancellableIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCancelGenerationDialogOpen(true)}
            disabled={
              isScheduling ||
              isCancelling ||
              isCancellingGeneration ||
              isDeleting
            }
            className="whitespace-nowrap border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            {isCancellingGeneration ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                取消中...
              </>
            ) : (
              <>
                <StopCircle className="mr-1 h-3 w-3" />
                取消生成 ({selectedCancellableIds.length})
              </>
            )}
          </Button>
        )}

        <Button
          size="sm"
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={
            isScheduling || isCancelling || isDeleting || selectedCount === 0
          }
          className="whitespace-nowrap"
        >
          <Trash2 className="mr-1 h-3 w-3" />
          刪除
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除選中的文章嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。將永久刪除 {selectedCount} 篇文章。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "刪除中..." : "確定刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cancelGenerationDialogOpen}
        onOpenChange={setCancelGenerationDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要取消這些文章的生成嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              將取消 {selectedCancellableIds.length} 篇文章的生成。已使用的
              tokens 會按進度扣除，未使用的部分會退還。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingGeneration}>
              返回
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelGeneration}
              disabled={isCancellingGeneration}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {isCancellingGeneration ? "取消中..." : "確定取消"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
