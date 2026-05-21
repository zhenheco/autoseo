"use client";

import { useArticleJobStatus } from "@/hooks/useArticleJobStatus";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Loader2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

interface ArticleGenerationProgressProps {
  jobId: string;
  onComplete?: (resultUrl: string) => void;
  onError?: (error: string) => void;
}

export function ArticleGenerationProgress({
  jobId,
  onComplete,
  onError,
}: ArticleGenerationProgressProps) {
  const t = useTranslations("dashboard.progress");
  const locale = useLocale();
  const { job, loading, error } = useArticleJobStatus(jobId, {
    interval: 60000, // 每 60 秒檢查一次
  });

  // 當任務完成時觸發回調
  if (job?.status === "completed" && job.result_url && onComplete) {
    onComplete(job.result_url);
  }

  // 當任務失敗時觸發回調
  if (job?.status === "failed" && job.error_message && onError) {
    onError(job.error_message);
  }

  if (loading && !job) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {t("loadingStatus")}
          </span>
        </div>
        <Skeleton className="mt-4 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title={t("error")} message={error} />;
  }

  if (!job) {
    return null;
  }

  const getStatusColor = () => {
    switch (job.status) {
      case "pending":
      case "processing":
        return "text-primary";
      case "completed":
        return "text-success";
      case "failed":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case "pending":
        return t("generating");
      case "processing":
        return t("processing");
      case "completed":
        return t("completed");
      case "failed":
        return t("failed");
      default:
        return job.status;
    }
  };

  const getBorderColor = () => {
    switch (job.status) {
      case "pending":
      case "processing":
        return "border-primary/30 bg-primary/10";
      case "completed":
        return "border-success/30 bg-success/10";
      case "failed":
        return "border-destructive/30 bg-destructive/10";
      default:
        return "border-border bg-card";
    }
  };

  return (
    <div className={cn("rounded-lg border p-4", getBorderColor())}>
      <h3 className="font-semibold mb-3">{t("title")}</h3>

      {/* 任務資訊 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{t("jobId")}</span>
          <span className="text-sm font-mono text-foreground">
            {job.job_id.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("status")}</span>
          <span className={cn("text-sm font-semibold", getStatusColor())}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* 處理中的進度條 */}
      {job.status === "processing" && (
        <div className="mb-3">
          <div className="mb-2 h-2.5 w-full rounded-full bg-muted">
            <div
              className="h-2.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {job.current_step || t("processingProgress")} ({job.progress || 0}%)
          </p>
        </div>
      )}

      {/* 等待處理的提示 */}
      {job.status === "pending" && (
        <div className="mb-3">
          <p className="text-sm text-muted-foreground">{t("taskQueued")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("taskQueueHint")}
          </p>
        </div>
      )}

      {/* 完成結果 */}
      {job.status === "completed" && (
        <div className="mt-3">
          {job.result_url ? (
            <a
              href={job.result_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-primary hover:underline"
            >
              <ExternalLink className="mr-1 h-4 w-4" />
              {t("viewArticle")}
            </a>
          ) : (
            <p className="text-sm text-success">{t("articleGenerated")}</p>
          )}
        </div>
      )}

      {/* 錯誤訊息 */}
      {job.status === "failed" && job.error_message && (
        <div className="mt-3 rounded border border-destructive/30 bg-destructive/10 p-3">
          <p className="mb-1 text-sm font-semibold text-destructive">
            {t("errorMessage")}
          </p>
          <p className="text-sm text-destructive">{job.error_message}</p>
        </div>
      )}

      {/* 時間資訊 */}
      <div className="mt-3 border-t border-border pt-3">
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">{t("createdAt")}</span>
            <br />
            {new Date(job.created_at).toLocaleString(locale)}
          </div>
          {job.started_at && (
            <div>
              <span className="font-medium">{t("startedAt")}</span>
              <br />
              {new Date(job.started_at).toLocaleString(locale)}
            </div>
          )}
          {job.completed_at && (
            <div className="col-span-2">
              <span className="font-medium">{t("completedAt")}</span>
              <br />
              {new Date(job.completed_at).toLocaleString(locale)}
            </div>
          )}
        </div>
      </div>

      {/* 輪詢提示 */}
      {(job.status === "pending" || job.status === "processing") && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="flex items-center text-xs text-muted-foreground">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {t("autoRefreshHint")}
          </p>
        </div>
      )}
    </div>
  );
}
