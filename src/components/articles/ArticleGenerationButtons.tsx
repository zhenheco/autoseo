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
import { FileText, Plus, Trash2, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ArticleGenerationButtonsProps {
  onSingleGenerate: (keyword: string, selectedTitle?: string) => void;
  onBatchGenerate: (keywords: string[]) => void;
}

interface TitleItem {
  id: string;
  keyword: string;
  title: string;
}

export function ArticleGenerationButtons({
  onSingleGenerate,
  onBatchGenerate,
}: ArticleGenerationButtonsProps) {
  const [keyword, setKeyword] = useState('');
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<Set<number>>(new Set());
  const [titleQueue, setTitleQueue] = useState<TitleItem[]>([]);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  const handleGenerateIdeas = async () => {
    if (!keyword.trim()) return;

    setIsGeneratingTitles(true);
    try {
      const response = await fetch('/api/articles/generate-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });

      if (!response.ok) throw new Error('生成標題失敗');

      const data = await response.json();
      setGeneratedTitles(data.titles || []);
      setSelectedTitles(new Set());
    } catch (error) {
      console.error('生成標題錯誤:', error);
      alert('生成標題失敗，請重試');
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  const handleToggleTitle = (index: number) => {
    const newSelected = new Set(selectedTitles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTitles(newSelected);
  };

  const handleAddTitles = () => {
    const newTitles: TitleItem[] = Array.from(selectedTitles).map(index => ({
      id: `${Date.now()}-${index}`,
      keyword: keyword,
      title: generatedTitles[index],
    }));

    setTitleQueue([...titleQueue, ...newTitles]);
    setGeneratedTitles([]);
    setSelectedTitles(new Set());
    setKeyword('');
  };

  const handleAddCustomTitle = () => {
    if (!keyword.trim() || !customTitle.trim()) return;

    const newTitle: TitleItem = {
      id: `${Date.now()}-custom`,
      keyword: keyword,
      title: customTitle,
    };

    setTitleQueue([...titleQueue, newTitle]);
    setCustomTitle('');
  };

  const handleRemoveTitle = (id: string) => {
    setTitleQueue(titleQueue.filter(item => item.id !== id));
  };

  const handleStartGeneration = () => {
    if (titleQueue.length === 0) {
      alert('請先添加要生成的標題');
      return;
    }

    titleQueue.forEach(item => {
      onSingleGenerate(item.keyword, item.title);
    });

    setTitleQueue([]);
    setDialogOpen(false);
  };

  const handleTitleEdit = (id: string, newTitle: string) => {
    setTitleQueue(titleQueue.map(item =>
      item.id === id ? { ...item, title: newTitle } : item
    ));
  };

  return (
    <div className="flex items-center gap-3">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="gap-2">
            <FileText className="h-4 w-4" />
            文章生成
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>文章生成器</DialogTitle>
            <DialogDescription>
              輸入關鍵字生成標題，或自行輸入標題
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 關鍵字輸入區 */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="keyword">關鍵字</Label>
                  <Input
                    id="keyword"
                    placeholder="例如：SEO 優化技巧"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleGenerateIdeas}
                    disabled={!keyword.trim() || isGeneratingTitles}
                    variant="secondary"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isGeneratingTitles ? '生成中...' : 'Generate Ideas'}
                  </Button>
                </div>
              </div>

              {/* 自訂標題 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="custom-title">或自行輸入標題</Label>
                  <Input
                    id="custom-title"
                    placeholder="輸入自訂標題"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddCustomTitle}
                    disabled={!keyword.trim() || !customTitle.trim()}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    添加
                  </Button>
                </div>
              </div>
            </div>

            {/* 生成的標題選擇區 */}
            {generatedTitles.length > 0 && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div className="flex justify-between items-center">
                  <Label>生成的標題（選擇要添加的）</Label>
                  <Button
                    onClick={handleAddTitles}
                    disabled={selectedTitles.size === 0}
                    size="sm"
                  >
                    Add Titles ({selectedTitles.size})
                  </Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {generatedTitles.map((title, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-background rounded border hover:border-primary/50 cursor-pointer"
                      onClick={() => handleToggleTitle(index)}
                    >
                      <Checkbox
                        checked={selectedTitles.has(index)}
                        onCheckedChange={() => handleToggleTitle(index)}
                      />
                      <span className="flex-1 text-sm">{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 待生成列表 */}
            {titleQueue.length > 0 && (
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <Label>待生成列表 ({titleQueue.length})</Label>
                  <Button
                    onClick={handleStartGeneration}
                    variant="default"
                  >
                    Start Generation
                  </Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {titleQueue.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-background rounded border"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="text-xs text-muted-foreground">
                          關鍵字: {item.keyword}
                        </div>
                        <Input
                          value={item.title}
                          onChange={(e) => handleTitleEdit(item.id, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTitle(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {titleQueue.length === 0 && generatedTitles.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                輸入關鍵字並點擊 Generate Ideas 開始
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
