import { useState, useEffect, useCallback } from 'react';

interface ArticleJob {
  id: string;
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_step?: string;
  result_url?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
}

interface UseArticleJobStatusOptions {
  interval?: number;
  enabled?: boolean;
}

interface UseArticleJobStatusReturn {
  job: ArticleJob | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<boolean | void>;
}

/**
 * Hook 用於輪詢文章生成任務的狀態
 * @param jobId - 任務 ID
 * @param options - 配置選項
 * @param options.interval - 輪詢間隔（毫秒），預設 60000（60 秒）
 * @param options.enabled - 是否啟用輪詢，預設 true
 * @returns 任務狀態、載入狀態、錯誤訊息和手動重新獲取函數
 */
export function useArticleJobStatus(
  jobId: string | null,
  options?: UseArticleJobStatusOptions
): UseArticleJobStatusReturn {
  const [job, setJob] = useState<ArticleJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/articles/status/${jobId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('任務不存在');
        }
        if (response.status === 401) {
          throw new Error('未授權，請重新登入');
        }
        if (response.status === 403) {
          throw new Error('無權限查看此任務');
        }
        throw new Error('獲取任務狀態失敗');
      }

      const data: ArticleJob = await response.json();
      setJob(data);

      // 如果任務完成或失敗，停止輪詢
      if (data.status === 'completed' || data.status === 'failed') {
        return true; // 返回 true 表示停止輪詢
      }

      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知錯誤';
      setError(errorMessage);
      console.error('[useArticleJobStatus] Error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId || options?.enabled === false) {
      return;
    }

    // 立即執行一次
    fetchStatus();

    // 設置輪詢
    const intervalId = setInterval(async () => {
      const shouldStop = await fetchStatus();
      if (shouldStop) {
        clearInterval(intervalId);
      }
    }, options?.interval || 60000); // 預設 60 秒

    return () => {
      clearInterval(intervalId);
    };
  }, [jobId, fetchStatus, options?.interval, options?.enabled]);

  return { job, loading, error, refetch: fetchStatus };
}
