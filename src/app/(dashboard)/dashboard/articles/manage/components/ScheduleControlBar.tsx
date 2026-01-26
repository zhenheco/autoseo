"use client";

import { useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
    scheduleType,
    setScheduleType,
    intervalDays,
    setIntervalDays,
    isScheduling,
    setIsScheduling,
    syncTargets,
    setSyncTargets,
    selectedSyncTargetIds,
    setSelectedSyncTargetIds,
    loadingSyncTargets,
    setLoadingSyncTargets,
  } = useScheduleContext();

  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedCount = selectedArticleIds.size;

  // 載入同步目標
  useEffect(() => {
    async function loadSyncTargets() {
      setLoadingSyncTargets(true);
      try {
        const response = await fetch("/api/sync-targets");
        if (response.ok) {
          const data = await response.json();
          setSyncTargets(data.targets || []);
          // 預設全選所有同步目標
          setSelectedSyncTargetIds(
            (data.targets || []).map((t: { id: string }) => t.id),
          );
        }
      } catch (err) {
        console.error("Failed to load sync targets:", err);
      } finally {
        setLoadingSyncTargets(false);
      }
    }
    loadSyncTargets();
  }, [setSyncTargets, setSelectedSyncTargetIds, setLoadingSyncTargets]);

  // 切換同步目標選取
  const toggleSyncTarget = useCallback(
    (targetId: string) => {
      if (selectedSyncTargetIds.includes(targetId)) {
        setSelectedSyncTargetIds(
          selectedSyncTargetIds.filter((id) => id !== targetId),
        );
      } else {
        setSelectedSyncTargetIds([...selectedSyncTargetIds, targetId]);
      }
    },
    [selectedSyncTargetIds, setSelectedSyncTargetIds],
  );

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
        scheduleType,
        intervalDays,
        selectedSyncTargetIds,
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
    scheduleType,
    intervalDays,
    selectedSyncTargetIds,
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
      {/* 第一列：模式選擇 + 設定 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* 排程模式下拉選單 */}
        <Select
          value={scheduleType}
          onValueChange={(v) => setScheduleType(v as "daily" | "interval")}
          disabled={isScheduling}
        >
          <SelectTrigger className="w-[120px] h-10 lg:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t("schedule.modeDaily")}</SelectItem>
            <SelectItem value="interval">
              {t("schedule.modeInterval")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* 每日篇數設定 - 僅 daily 模式顯示 */}
        {scheduleType === "daily" && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">
              {t("schedule.perDay")}
            </Label>
            <Select
              value={articlesPerDay.toString()}
              onValueChange={(v) => setArticlesPerDay(parseInt(v))}
              disabled={isScheduling}
            >
              <SelectTrigger className="w-[70px] h-10 lg:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-sm text-muted-foreground whitespace-nowrap">
              {t("schedule.articles")}
            </Label>
          </div>
        )}

        {/* 間隔天數設定 - 僅 interval 模式顯示 */}
        {scheduleType === "interval" && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">
              {t("schedule.intervalEvery")}
            </Label>
            <Select
              value={intervalDays.toString()}
              onValueChange={(v) => setIntervalDays(parseInt(v))}
              disabled={isScheduling}
            >
              <SelectTrigger className="w-[70px] h-10 lg:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-sm text-muted-foreground whitespace-nowrap">
              {t("schedule.intervalDays")}
            </Label>
          </div>
        )}
      </div>

      {/* 同步目標選擇（選填） */}
      {syncTargets.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 py-2 border-t border-border/50">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            {t("schedule.syncTargets")}
          </Label>
          {loadingSyncTargets ? (
            <span className="text-sm text-muted-foreground">
              {t("schedule.loadingSyncTargets")}
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {syncTargets.map((target) => (
                <div key={target.id} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`sync-target-${target.id}`}
                    checked={selectedSyncTargetIds.includes(target.id)}
                    onCheckedChange={() => toggleSyncTarget(target.id)}
                    disabled={isScheduling}
                  />
                  <Label
                    htmlFor={`sync-target-${target.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {target.website_name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 第二列：按鈕區域 */}
      <div className="flex flex-wrap gap-2">
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

        {error && <p className="text-sm text-destructive ml-2">{error}</p>}
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
