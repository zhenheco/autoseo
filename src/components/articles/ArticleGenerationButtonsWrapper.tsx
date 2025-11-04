'use client';

import { useRouter } from 'next/navigation';
import { ArticleGenerationButtons } from './ArticleGenerationButtons';
import { useState } from 'react';
import { toast } from 'sonner';

interface GenerationItem {
  keyword: string;
  title: string;
  targetLanguage: string;
  wordCount: string;
}

export function ArticleGenerationButtonsWrapper() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleBatchGenerate = async (items: GenerationItem[]) => {
    setIsGenerating(true);
    try {
      // 將 items 轉換為 batch API 需要的格式
      const keywords = items.map(item => item.keyword);

      const response = await fetch('/api/articles/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          // 可以將其他設定也傳給 API（未來擴展用）
          options: {
            targetLanguage: items[0]?.targetLanguage || 'zh-TW',
            wordCount: items[0]?.wordCount || '1500',
          }
        }),
      });

      if (!response.ok) {
        throw new Error('批次生成失敗');
      }

      const data = await response.json();

      toast.success(`已提交 ${items.length} 篇文章生成任務`, {
        description: '請稍後查看文章列表',
      });

      router.refresh();
    } catch (error) {
      console.error('Batch generate error:', error);
      toast.error('批次生成失敗', {
        description: (error as Error).message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ArticleGenerationButtons
      onBatchGenerate={handleBatchGenerate}
    />
  );
}
