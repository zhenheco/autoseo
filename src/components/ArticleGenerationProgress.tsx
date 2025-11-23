'use client';

import { useArticleJobStatus } from '@/hooks/useArticleJobStatus';

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
  const { job, loading, error } = useArticleJobStatus(jobId, {
    interval: 60000, // 每 60 秒檢查一次
  });

  // 當任務完成時觸發回調
  if (job?.status === 'completed' && job.result_url && onComplete) {
    onComplete(job.result_url);
  }

  // 當任務失敗時觸發回調
  if (job?.status === 'failed' && job.error_message && onError) {
    onError(job.error_message);
  }

  if (loading && !job) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-sm text-gray-600">載入任務狀態...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-300 rounded-lg p-4 bg-red-50">
        <h3 className="font-semibold text-red-800 mb-2">錯誤</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  const getStatusColor = () => {
    switch (job.status) {
      case 'pending':
        return 'text-yellow-600';
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case 'pending':
        return '等待處理';
      case 'processing':
        return '處理中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失敗';
      default:
        return job.status;
    }
  };

  const getBorderColor = () => {
    switch (job.status) {
      case 'pending':
        return 'border-yellow-300 bg-yellow-50';
      case 'processing':
        return 'border-blue-300 bg-blue-50';
      case 'completed':
        return 'border-green-300 bg-green-50';
      case 'failed':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getBorderColor()}`}>
      <h3 className="font-semibold mb-3">文章生成進度</h3>

      {/* 任務資訊 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">任務 ID:</span>
          <span className="text-sm font-mono text-gray-800">{job.job_id.slice(0, 8)}...</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">狀態:</span>
          <span className={`text-sm font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* 處理中的進度條 */}
      {job.status === 'processing' && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {job.current_step || '處理中...'} ({job.progress || 0}%)
          </p>
        </div>
      )}

      {/* 等待處理的提示 */}
      {job.status === 'pending' && (
        <div className="mb-3">
          <p className="text-sm text-gray-600">
            任務已排隊，等待處理...
          </p>
          <p className="text-xs text-gray-500 mt-1">
            每 5 分鐘會自動檢查並處理待處理的任務
          </p>
        </div>
      )}

      {/* 完成結果 */}
      {job.status === 'completed' && (
        <div className="mt-3">
          {job.result_url ? (
            <a
              href={job.result_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              查看文章
            </a>
          ) : (
            <p className="text-sm text-green-600">文章生成完成</p>
          )}
        </div>
      )}

      {/* 錯誤訊息 */}
      {job.status === 'failed' && job.error_message && (
        <div className="mt-3 p-3 bg-red-100 rounded border border-red-200">
          <p className="text-sm text-red-800 font-semibold mb-1">錯誤訊息:</p>
          <p className="text-sm text-red-700">{job.error_message}</p>
        </div>
      )}

      {/* 時間資訊 */}
      <div className="mt-3 pt-3 border-t border-gray-300">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
          <div>
            <span className="font-medium">建立時間:</span>
            <br />
            {new Date(job.created_at).toLocaleString('zh-TW')}
          </div>
          {job.started_at && (
            <div>
              <span className="font-medium">開始時間:</span>
              <br />
              {new Date(job.started_at).toLocaleString('zh-TW')}
            </div>
          )}
          {job.completed_at && (
            <div className="col-span-2">
              <span className="font-medium">完成時間:</span>
              <br />
              {new Date(job.completed_at).toLocaleString('zh-TW')}
            </div>
          )}
        </div>
      </div>

      {/* 輪詢提示 */}
      {(job.status === 'pending' || job.status === 'processing') && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <p className="text-xs text-gray-500 flex items-center">
            <svg
              className="w-3 h-3 mr-1 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            每 60 秒自動更新狀態
          </p>
        </div>
      )}
    </div>
  );
}
