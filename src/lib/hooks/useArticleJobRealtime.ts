import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

type ArticleJob = Database['public']['Tables']['article_jobs']['Row'];

/**
 * 即時監聽文章生成任務狀態變更
 *
 * 使用方式：
 * ```tsx
 * const { jobs, isConnected } = useArticleJobRealtime({
 *   companyId: 'xxx',
 *   onCompleted: (job) => {
 *     console.log('文章完成！', job);
 *     // 重新載入列表或顯示通知
 *   }
 * });
 * ```
 */
export function useArticleJobRealtime(options: {
  companyId: string;
  onCompleted?: (job: ArticleJob) => void;
  onFailed?: (job: ArticleJob) => void;
  onStatusChange?: (job: ArticleJob) => void;
}) {
  const [jobs, setJobs] = useState<ArticleJob[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // 訂閱 article_jobs 表的變更
    const channel = supabase
      .channel(`article_jobs:company:${options.companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'article_jobs',
          filter: `company_id=eq.${options.companyId}`,
        },
        (payload) => {
          console.log('[Realtime] 文章任務狀態變更:', payload);

          const updatedJob = payload.new as ArticleJob;

          // 更新本地狀態
          setJobs((prev) => {
            const index = prev.findIndex((j) => j.id === updatedJob.id);
            if (index >= 0) {
              const newJobs = [...prev];
              newJobs[index] = updatedJob;
              return newJobs;
            }
            return [...prev, updatedJob];
          });

          // 觸發回調
          if (updatedJob.status === 'completed' && options.onCompleted) {
            options.onCompleted(updatedJob);
          } else if (updatedJob.status === 'failed' && options.onFailed) {
            options.onFailed(updatedJob);
          }

          if (options.onStatusChange) {
            options.onStatusChange(updatedJob);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'article_jobs',
          filter: `company_id=eq.${options.companyId}`,
        },
        (payload) => {
          console.log('[Realtime] 新文章任務:', payload);
          const newJob = payload.new as ArticleJob;
          setJobs((prev) => [...prev, newJob]);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] 訂閱狀態:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // 清理函數
    return () => {
      console.log('[Realtime] 取消訂閱');
      supabase.removeChannel(channel);
    };
  }, [options.companyId]);

  return {
    jobs,
    isConnected,
  };
}
