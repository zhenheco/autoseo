"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2 } from "lucide-react";
import { useScheduleContext } from "./ScheduleContext";
import { scheduleArticlesForPublish } from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ScheduleControlBarProps {
  schedulableArticleIds: string[];
}

export function ScheduleControlBar({
  schedulableArticleIds,
}: ScheduleControlBarProps) {
  const router = useRouter();
  const {
    selectedArticleIds,
    selectAll,
    websiteId,
    setWebsiteId,
    articlesPerDay,
    setArticlesPerDay,
    isScheduling,
    setIsScheduling,
  } = useScheduleContext();

  const [error, setError] = useState<string | null>(null);

  const selectedCount = selectedArticleIds.size;
  const allSelected =
    schedulableArticleIds.length > 0 &&
    schedulableArticleIds.every((id) => selectedArticleIds.has(id));

  const handleSelectAll = useCallback(() => {
    selectAll(schedulableArticleIds);
  }, [selectAll, schedulableArticleIds]);

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

  if (schedulableArticleIds.length === 0) {
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

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            disabled={isScheduling}
          />
          <span className="text-sm whitespace-nowrap">
            全選
            {selectedCount > 0 && (
              <span className="text-muted-foreground ml-1">
                ({selectedCount})
              </span>
            )}
          </span>
        </label>

        <Button
          size="sm"
          onClick={handleSchedule}
          disabled={isScheduling || selectedCount === 0 || !websiteId}
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

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
