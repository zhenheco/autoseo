'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function ArticleGeneratorExample() {
  const [title, setTitle] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<any>(null);
  const t = useTranslations('articleGenerator');

  // 1. 觸發文章生成
  const generateArticle = async () => {
    if (!title) {
      alert(t('enterTitleAlert'));
      return;
    }

    setLoading(true);
    setStatus(t('submitting'));

    try {
      const response = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          mode: 'single',
        }),
      });

      const data = await response.json();

      if (data.success && data.articleJobId) {
        setJobId(data.articleJobId);
        setStatus(t('submitted'));
        // 開始輪詢狀態
        pollStatus(data.articleJobId);
      } else {
        setStatus(t('submitFailed') + ': ' + (data.error || t('unknownError')));
      }
    } catch (error) {
      setStatus(t('submitFailed') + ': ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 2. 輪詢任務狀態
  const pollStatus = async (jobId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/articles/status?jobId=${jobId}`);
        const data = await response.json();

        setStatus(data.message || data.status);
        setProgress(data.progress || 0);

        if (data.status === 'completed') {
          setArticle(data.article);
          clearInterval(intervalId);
        } else if (data.status === 'failed') {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    };

    // 立即檢查一次
    await checkStatus();

    // 然後每 5 秒檢查一次
    const intervalId = setInterval(checkStatus, 5000);

    // 10 分鐘後停止輪詢
    setTimeout(() => {
      clearInterval(intervalId);
    }, 600000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">{t('title')}</h2>

      {/* 輸入區 */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          {t('articleTitle')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 生成按鈕 */}
      <button
        onClick={generateArticle}
        disabled={loading || !title}
        className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t('processing') : t('generateButton')}
      </button>

      {/* 任務資訊 */}
      {jobId && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600">{t('jobId')}: {jobId}</p>
        </div>
      )}

      {/* 狀態顯示 */}
      {status && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">{t('status')}: {status}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{progress}%</p>
        </div>
      )}

      {/* 文章預覽 */}
      {article && (
        <div className="mt-6 p-6 bg-white border rounded-lg">
          <h3 className="text-xl font-bold mb-2">{article.title}</h3>
          <p className="text-gray-600 mb-4">{article.meta_description}</p>
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>
      )}
    </div>
  );
}