'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileText, Files } from 'lucide-react';

interface ArticleGenerationButtonsProps {
  onSingleGenerate: (keyword: string, selectedTitle?: string) => void;
  onBatchGenerate: (keywords: string[]) => void;
}

export function ArticleGenerationButtons({
  onSingleGenerate,
  onBatchGenerate,
}: ArticleGenerationButtonsProps) {
  const [singleKeyword, setSingleKeyword] = useState('');
  const [batchKeywords, setBatchKeywords] = useState('');
  const [titles, setTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [showTitleSelection, setShowTitleSelection] = useState(false);
  const [singleDialogOpen, setSingleDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  const handleGenerateTitles = async () => {
    if (!singleKeyword.trim()) return;

    setIsGeneratingTitles(true);
    try {
      const response = await fetch('/api/articles/generate-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: singleKeyword }),
      });

      if (!response.ok) throw new Error('生成標題失敗');

      const data = await response.json();
      setTitles(data.titles || []);
      setShowTitleSelection(true);
    } catch (error) {
      console.error('生成標題錯誤:', error);
      alert('生成標題失敗，請重試');
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  const handleSingleConfirm = () => {
    if (!singleKeyword.trim()) {
      alert('請輸入關鍵字');
      return;
    }

    if (showTitleSelection && !selectedTitle) {
      alert('請選擇一個標題');
      return;
    }

    onSingleGenerate(singleKeyword, selectedTitle || undefined);
    setSingleDialogOpen(false);
    setSingleKeyword('');
    setTitles([]);
    setSelectedTitle('');
    setShowTitleSelection(false);
  };

  const handleBatchConfirm = () => {
    if (!batchKeywords.trim()) {
      alert('請輸入關鍵字');
      return;
    }

    const keywordList = batchKeywords
      .split(/[\n,]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywordList.length === 0) {
      alert('請輸入至少一個有效關鍵字');
      return;
    }

    onBatchGenerate(keywordList);
    setBatchDialogOpen(false);
    setBatchKeywords('');
  };

  return (
    <div className="flex items-center gap-3">
      <Dialog open={singleDialogOpen} onOpenChange={setSingleDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="gap-2">
            <FileText className="h-4 w-4" />
            單一文章生成
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>單一文章生成</DialogTitle>
            <DialogDescription>
              輸入關鍵字，系統將為您生成 10 個標題供選擇
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!showTitleSelection ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="single-keyword">關鍵字</Label>
                  <Input
                    id="single-keyword"
                    placeholder="例如：SEO 優化技巧"
                    value={singleKeyword}
                    onChange={(e) => setSingleKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleGenerateTitles();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleGenerateTitles}
                  disabled={!singleKeyword.trim() || isGeneratingTitles}
                  className="w-full"
                >
                  {isGeneratingTitles ? '生成標題中...' : '生成標題'}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>選擇標題</Label>
                  <RadioGroup value={selectedTitle} onValueChange={setSelectedTitle}>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {titles.map((title, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <RadioGroupItem value={title} id={`title-${index}`} />
                          <Label
                            htmlFor={`title-${index}`}
                            className="font-normal cursor-pointer flex-1"
                          >
                            {title}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTitleSelection(false);
                      setTitles([]);
                      setSelectedTitle('');
                    }}
                    className="flex-1"
                  >
                    返回
                  </Button>
                  <Button
                    onClick={handleSingleConfirm}
                    disabled={!selectedTitle}
                    className="flex-1"
                  >
                    確認生成
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Files className="h-4 w-4" />
            批次文章生成
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>批次文章生成</DialogTitle>
            <DialogDescription>
              輸入多個關鍵字，每行一個或用逗號分隔
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-keywords">關鍵字列表</Label>
              <Textarea
                id="batch-keywords"
                placeholder="關鍵字1&#10;關鍵字2&#10;關鍵字3&#10;&#10;或&#10;&#10;關鍵字1, 關鍵字2, 關鍵字3"
                value={batchKeywords}
                onChange={(e) => setBatchKeywords(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                支援換行或逗號分隔，系統將自動解析關鍵字列表
              </p>
            </div>
            <Button
              onClick={handleBatchConfirm}
              disabled={!batchKeywords.trim()}
              className="w-full"
            >
              開始批次生成
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
