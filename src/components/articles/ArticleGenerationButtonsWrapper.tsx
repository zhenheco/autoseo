'use client';

import { useRouter } from 'next/navigation';
import { ArticleGenerationButtons } from './ArticleGenerationButtons';
import { useState } from 'react';
import { toast } from 'sonner';

export function ArticleGenerationButtonsWrapper() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSingleGenerate = async (keyword: string, selectedTitle?: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          title: selectedTitle,
          mode: 'single',
        }),
      });

      if (!response.ok) {
        throw new Error('生成文章失敗');
      }

      const data = await response.json();

      toast.success('文章生成已開始', {
        description: '請稍後查看文章列表',
      });

      router.refresh();
    } catch (error) {
      console.error('Single generate error:', error);
      toast.error('生成失敗', {
        description: (error as Error).message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBatchGenerate = async (keywords: string[]) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/articles/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });

      if (!response.ok) {
        throw new Error('批次生成失敗');
      }

      const data = await response.json();

      toast.success(`已提交 ${keywords.length} 篇文章生成任務`, {
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
      onSingleGenerate={handleSingleGenerate}
      onBatchGenerate={handleBatchGenerate}
    />
  );
}
