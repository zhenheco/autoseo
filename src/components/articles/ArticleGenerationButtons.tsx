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
import { Sparkles, Plus, Trash2, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ArticleGenerationButtonsProps {
  onBatchGenerate: (items: GenerationItem[]) => void;
}

interface TitleItem {
  id: string;
  keyword: string;
  title: string;
}

interface GenerationItem {
  keyword: string;
  title: string;
  targetLanguage: string;
  wordCount: string;
  imageCount: string;
}

export function ArticleGenerationButtons({
  onBatchGenerate,
}: ArticleGenerationButtonsProps) {
  const [keyword, setKeyword] = useState('');
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<Set<number>>(new Set());
  const [titleQueue, setTitleQueue] = useState<TitleItem[]>([]);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  // 批次設定選項
  const [targetLanguage, setTargetLanguage] = useState('zh-TW');
  const [wordCount, setWordCount] = useState('1500');
  const [imageCount, setImageCount] = useState('3');

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

    const items: GenerationItem[] = titleQueue.map(item => ({
      keyword: item.keyword,
      title: item.title,
      targetLanguage,
      wordCount,
      imageCount,
    }));

    onBatchGenerate(items);
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
            批次文章生成
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批次文章生成</DialogTitle>
            <DialogDescription>
              輸入關鍵字生成標題，選擇後批次生成文章
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-[1fr_300px] gap-6 py-4">
            {/* 左側：標題生成區 */}
            <div className="space-y-6">
              {/* 關鍵字輸入 */}
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
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>輸入關鍵字並點擊 Generate Ideas 開始</p>
                </div>
              )}
            </div>

            {/* 右側：生成選項 */}
            <div className="space-y-4 border-l pl-6">
              <div>
                <h3 className="font-semibold mb-4">生成選項</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="target-language">目標語言</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger id="target-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-TW">繁體中文 (Traditional Chinese)</SelectItem>
                      <SelectItem value="zh-CN">简体中文 (Simplified Chinese)</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">日本語 (Japanese)</SelectItem>
                      <SelectItem value="ko">한국어 (Korean)</SelectItem>
                      <SelectItem value="es">Español (Spanish)</SelectItem>
                      <SelectItem value="fr">Français (French)</SelectItem>
                      <SelectItem value="de">Deutsch (German)</SelectItem>
                      <SelectItem value="pt">Português (Portuguese)</SelectItem>
                      <SelectItem value="it">Italiano (Italian)</SelectItem>
                      <SelectItem value="ru">Русский (Russian)</SelectItem>
                      <SelectItem value="ar">العربية (Arabic)</SelectItem>
                      <SelectItem value="th">ไทย (Thai)</SelectItem>
                      <SelectItem value="vi">Tiếng Việt (Vietnamese)</SelectItem>
                      <SelectItem value="id">Bahasa Indonesia (Indonesian)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="word-count">文章字數</Label>
                  <Select value={wordCount} onValueChange={setWordCount}>
                    <SelectTrigger id="word-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="800">800 字</SelectItem>
                      <SelectItem value="1200">1200 字</SelectItem>
                      <SelectItem value="1500">1500 字</SelectItem>
                      <SelectItem value="2000">2000 字</SelectItem>
                      <SelectItem value="3000">3000 字</SelectItem>
                      <SelectItem value="5000">5000 字</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image-count">圖片數量</Label>
                  <Select value={imageCount} onValueChange={setImageCount}>
                    <SelectTrigger id="image-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">不使用圖片</SelectItem>
                      <SelectItem value="1">1 張圖片</SelectItem>
                      <SelectItem value="2">2 張圖片</SelectItem>
                      <SelectItem value="3">3 張圖片</SelectItem>
                      <SelectItem value="5">5 張圖片</SelectItem>
                      <SelectItem value="8">8 張圖片</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    圖片將插入在 H2 標題下方
                  </p>
                </div>

                <div className="pt-4 space-y-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    <p>• 批次生成模式</p>
                    <p>• 所有文章使用相同設定</p>
                    <p>• 生成後可在列表中查看</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
