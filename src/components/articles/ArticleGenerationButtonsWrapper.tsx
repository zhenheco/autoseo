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

interface ArticleGenerationButtonsWrapperProps {
  buttonText?: string;
}

export function ArticleGenerationButtonsWrapper({ buttonText }: ArticleGenerationButtonsWrapperProps = {}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleBatchGenerate = async (items: GenerationItem[]): Promise<boolean> => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/articles/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            keyword: item.keyword,
            title: item.title,
          })),
          options: {
            targetLanguage: items[0]?.targetLanguage || 'zh-TW',
            wordCount: items[0]?.wordCount || '1500',
          }
        }),
      });

      const data = await response.json();

      if (response.status === 402) {
        toast.error('Token 餘額不足', {
          description: data.message || '無法生成文章',
          action: {
            label: '立即升級',
            onClick: () => router.push('/dashboard/billing/upgrade'),
          },
          duration: 10000,
        });
        setIsGenerating(false);
        return false;
      }

      if (!response.ok) {
        throw new Error(data.error || '批次生成失敗');
      }

      toast.success(`已提交 ${items.length} 篇文章生成任務`, {
        description: '文章正在生成中，請稍後查看列表',
      });

      window.dispatchEvent(new Event('articlesUpdated'));
      router.refresh();
      return true;
    } catch (error) {
      console.error('Batch generate error:', error);
      toast.error('批次生成失敗', {
        description: (error as Error).message,
      });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ArticleGenerationButtons
      onBatchGenerate={handleBatchGenerate}
      buttonText={buttonText}
    />
  );
}
