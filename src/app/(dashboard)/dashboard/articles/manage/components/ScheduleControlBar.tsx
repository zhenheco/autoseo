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
import { CalendarClock, Loader2, XCircle, Trash2 } from "lucide-react";
import { useScheduleContext } from "./ScheduleContext";
import {
  scheduleArticlesForPublish,
  cancelArticleSchedule,
  batchDeleteArticles,
} from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ScheduleControlBarProps {
  schedulableArticleIds: string[];
  cancellableArticleIds: string[];
  deletableArticleIds: string[];
}

export function ScheduleControlBar({
  schedulableArticleIds,
  cancellableArticleIds,
  deletableArticleIds,
}: ScheduleControlBarProps) {
  const t = useTranslations("articles");
  const tCommon = useTranslations("common");
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
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedCount = selectedArticleIds.size;

  // 計算選中的可取消文章數量（用於刪除對話框提示）
  const selectedCancellableCount = Array.from(selectedArticleIds).filter((id) =>
    cancellableArticleIds.includes(id),
  ).length;

  const handleSchedule = useCallback(async () => {
    if (selectedCount === 0) {
      toast.error(t("toasts.selectArticles"));
      return;
    }
    if (!websiteId) {
      toast.error(t("toasts.selectWebsite"));
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
        setError(result.error || t("toasts.scheduleFailed"));
        toast.error(result.error || t("toasts.scheduleFailed"));
        return;
      }

      toast.success(
        t("toasts.scheduleSuccess", { count: result.scheduledCount || 0 }),
      );
      router.refresh();
    } catch (err) {
      console.error("Schedule error:", err);
      const errorMessage =
        err instanceof Error ? err.message : t("toasts.scheduleError");
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
    t,
  ]);

  const handleCancelSchedule = useCallback(async () => {
    if (selectedCount === 0) {
      toast.error(t("toasts.selectCancelArticles"));
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
        toast.success(
          t("toasts.cancelScheduleSuccess", { count: cancelledCount }),
        );
        router.refresh();
      } else {
        toast.error(t("toasts.noCancelledArticles"));
      }
    } catch (err) {
      console.error("Cancel schedule error:", err);
      toast.error(t("toasts.cancelScheduleError"));
    } finally {
      setIsCancelling(false);
    }
  }, [selectedCount, selectedArticleIds, router, t]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedCount === 0) {
      toast.error(t("toasts.selectDeleteArticles"));
      return;
    }

    setIsDeleting(true);

    try {
      const result = await batchDeleteArticles(Array.from(selectedArticleIds));

      if (result.success) {
        let msg = t("toasts.deleteSuccess", {
          count: result.deletedCount || 0,
        });
        // 如果有退還 tokens，顯示退款訊息
        if (result.tokensRefunded && result.tokensRefunded > 0) {
          msg += t("toasts.refundTokens", {
            amount: result.tokensRefunded.toLocaleString(),
          });
        }
        toast.success(msg);
        clearSelection();
        router.refresh();
        // 如果有取消的文章，觸發餘額更新事件
        if (result.cancelledCount && result.cancelledCount > 0) {
          window.dispatchEvent(new CustomEvent("tokenReserved"));
        }
      } else {
        toast.error(result.error || t("toasts.deleteFailed"));
      }
    } catch (err) {
      console.error("Batch delete error:", err);
      toast.error(t("toasts.deleteError"));
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [selectedCount, selectedArticleIds, clearSelection, router, t]);

  // 如果沒有可管理的文章，不顯示控制欄
  if (
    schedulableArticleIds.length === 0 &&
    cancellableArticleIds.length === 0 &&
    deletableArticleIds.length === 0
  ) {
    return null;
  }

  return (
    <div className="border rounded-lg p-3 mb-4 bg-muted/30">
      {/* 手機版：垂直堆疊 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
        {/* 每日篇數設定 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {t("schedule.perDay")}
          </span>
          <Select
            value={articlesPerDay.toString()}
            onValueChange={(v) => setArticlesPerDay(parseInt(v))}
            disabled={isScheduling}
          >
            <SelectTrigger className="w-[70px] h-10 lg:h-8">
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
            {t("schedule.articles")}
          </span>
        </div>

        {/* 按鈕區域 - 手機版橫向滾動或換行 */}
        <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:gap-3">
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
            className="whitespace-nowrap h-10 px-4 lg:h-8 lg:px-3"
          >
            {isScheduling ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 lg:h-3 lg:w-3 animate-spin" />
                {t("schedule.scheduling")}
              </>
            ) : (
              <>
                <CalendarClock className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />
                {t("schedule.schedule")}
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
            className="whitespace-nowrap h-10 px-4 lg:h-8 lg:px-3"
          >
            {isCancelling ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 lg:h-3 lg:w-3 animate-spin" />
                {t("schedule.cancelling")}
              </>
            ) : (
              <>
                <XCircle className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />
                {t("schedule.cancelSchedule")}
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={
              isScheduling || isCancelling || isDeleting || selectedCount === 0
            }
            className="whitespace-nowrap h-10 px-4 lg:h-8 lg:px-3"
          >
            <Trash2 className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />
            {t("schedule.delete")}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogs.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCancellableCount > 0
                ? t("dialogs.deleteWithCancelWarning", {
                    total: selectedCount,
                    cancelling: selectedCancellableCount,
                  })
                : t("dialogs.deleteWarning", { count: selectedCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting
                ? t("dialogs.deleting")
                : t("dialogs.confirmDeleteBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
