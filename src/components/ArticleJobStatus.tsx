"use client";

import { useArticleJobRealtime } from "@/lib/hooks/useArticleJobRealtime";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface ArticleJobStatusProps {
  companyId: string;
}

/**
 * 文章生成任務狀態顯示組件
 *
 * 功能：
 * - 即時監聽任務狀態變更（Supabase Realtime）
 * - pending → 轉圈圈
 * - completed → 打勾
 * - failed → 叉叉
 */
export function ArticleJobStatus({ companyId }: ArticleJobStatusProps) {
  const { jobs, isConnected } = useArticleJobRealtime({
    companyId,
    onCompleted: (job) => {
      console.log("✅ 文章完成:", job.id);
      // 可選：顯示通知
      // toast.success(`文章「${job.metadata?.title}」已完成！`);
    },
    onFailed: (job) => {
      console.log("❌ 文章失敗:", job.id);
      // toast.error(`文章生成失敗: ${job.error_message}`);
    },
  });

  return (
    <div className="space-y-4">
      {/* Realtime 連接狀態 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-gray-400"
          }`}
        />
        {isConnected ? "即時更新已連接" : "連接中..."}
      </div>

      {/* 任務列表 */}
      <div className="space-y-2">
        {jobs.map((job) => {
          const metadata = job.metadata as any;
          const title = metadata?.title || job.keywords?.[0] || "Untitled";

          return (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              {/* 標題 */}
              <div className="flex-1">
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(job.created_at).toLocaleString("zh-TW")}
                </p>
              </div>

              {/* 狀態圖示 */}
              <div className="flex items-center gap-2">
                {job.status === "pending" && (
                  <div className="flex items-center gap-2 text-blue-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">生成中</span>
                  </div>
                )}

                {job.status === "processing" && (
                  <div className="flex items-center gap-2 text-blue-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">生成中...</span>
                  </div>
                )}

                {job.status === "completed" && (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm">完成</span>
                  </div>
                )}

                {job.status === "failed" && (
                  <div className="flex items-center gap-2 text-red-500">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm">失敗</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {jobs.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">尚無文章生成任務</p>
          </div>
        )}
      </div>
    </div>
  );
}
