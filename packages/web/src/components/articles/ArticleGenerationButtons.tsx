"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Plus, Trash2, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

interface ArticleGenerationButtonsProps {
  onBatchGenerate: (items: GenerationItem[]) => Promise<boolean>;
  buttonText?: string;
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
}

export function ArticleGenerationButtons({
  onBatchGenerate,
  buttonText,
}: ArticleGenerationButtonsProps) {
  const t = useTranslations("articles.batchDialog");
  const defaultButtonText = buttonText || t("title");
  const [keyword, setKeyword] = useState("");
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<Set<number>>(new Set());
  const [titleQueue, setTitleQueue] = useState<TitleItem[]>([]);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  // 批次設定選項
  const [targetLanguage, setTargetLanguage] = useState("zh-TW");
  const [wordCount, setWordCount] = useState("1500");

  const handleGenerateIdeas = async () => {
    if (!keyword.trim()) return;

    setIsGeneratingTitles(true);
    try {
      const response = await fetch("/api/articles/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, targetLanguage }),
      });

      if (!response.ok) throw new Error(t("generateTitlesFailed"));

      const data = await response.json();
      setGeneratedTitles(data.titles || []);
      setSelectedTitles(new Set());
    } catch (error) {
      console.error("生成標題錯誤:", error);
      alert(t("generateTitlesRetry"));
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
    const newTitles: TitleItem[] = Array.from(selectedTitles).map((index) => ({
      id: `${Date.now()}-${index}`,
      keyword: keyword,
      title: generatedTitles[index],
    }));

    setTitleQueue([...titleQueue, ...newTitles]);
    setGeneratedTitles([]);
    setSelectedTitles(new Set());
    setKeyword("");
  };

  const handleAddCustomTitle = () => {
    if (!keyword.trim() || !customTitle.trim()) return;

    const newTitle: TitleItem = {
      id: `${Date.now()}-custom`,
      keyword: keyword,
      title: customTitle,
    };

    setTitleQueue([...titleQueue, newTitle]);
    setCustomTitle("");
  };

  const handleRemoveTitle = (id: string) => {
    setTitleQueue(titleQueue.filter((item) => item.id !== id));
  };

  const handleStartGeneration = async () => {
    if (titleQueue.length === 0) {
      alert(t("addTitlesFirst"));
      return;
    }

    const items: GenerationItem[] = titleQueue.map((item) => ({
      keyword: item.keyword,
      title: item.title,
      targetLanguage,
      wordCount,
    }));

    setIsStartingGeneration(true);
    try {
      const success = await onBatchGenerate(items);
      if (success) {
        setTitleQueue([]);
        setDialogOpen(false);
      }
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsStartingGeneration(false);
    }
  };

  const handleTitleEdit = (id: string, newTitle: string) => {
    setTitleQueue(
      titleQueue.map((item) =>
        item.id === id ? { ...item, title: newTitle } : item,
      ),
    );
  };

  return (
    <div className="flex items-center gap-3">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="gap-2">
            <FileText className="h-4 w-4" />
            {defaultButtonText}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          {/* 步驟指示器 */}
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="flex items-center gap-2">
              <div
                className={`rounded-full w-8 h-8 flex items-center justify-center text-xs font-medium ${
                  keyword
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                1
              </div>
              <span className="text-sm">{t("steps.topicInput")}</span>
            </div>
            <div className="w-8 h-px bg-muted" />
            <div className="flex items-center gap-2">
              <div
                className={`rounded-full w-8 h-8 flex items-center justify-center text-xs font-medium ${
                  generatedTitles.length > 0 || titleQueue.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                2
              </div>
              <span className="text-sm">{t("steps.titleSelect")}</span>
            </div>
            <div className="w-8 h-px bg-muted" />
            <div className="flex items-center gap-2">
              <div
                className={`rounded-full w-8 h-8 flex items-center justify-center text-xs font-medium ${
                  titleQueue.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                3
              </div>
              <span className="text-sm">{t("steps.confirmGenerate")}</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_300px] gap-6 py-4">
            {/* 左側：標題生成區 */}
            <div className="space-y-6">
              {/* 關鍵字輸入 */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="keyword">{t("keywordLabel")}</Label>
                    <Input
                      id="keyword"
                      placeholder={t("keywordPlaceholder")}
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("keywordHint")}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleGenerateIdeas}
                      disabled={!keyword.trim() || isGeneratingTitles}
                      variant="secondary"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isGeneratingTitles
                        ? t("generating")
                        : t("generateIdeas")}
                    </Button>
                  </div>
                </div>

                {/* 自訂標題 */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="custom-title">
                      {t("customTitleLabel")}
                    </Label>
                    <Input
                      id="custom-title"
                      placeholder={t("customTitlePlaceholder")}
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
                      {t("add")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* 生成的標題選擇區 */}
              {generatedTitles.length > 0 && (
                <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <Label>{t("generatedTitlesLabel")}</Label>
                    <Button
                      onClick={handleAddTitles}
                      disabled={selectedTitles.size === 0}
                      size="sm"
                    >
                      {t("addTitles", { count: selectedTitles.size })}
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
                    <Label>
                      {t("pendingList", { count: titleQueue.length })}
                    </Label>
                    <Button
                      onClick={handleStartGeneration}
                      disabled={isStartingGeneration}
                      variant="default"
                    >
                      {isStartingGeneration
                        ? t("submitting")
                        : t("startGeneration")}
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
                            {t("topic")}: {item.keyword}
                          </div>
                          <Input
                            value={item.title}
                            onChange={(e) =>
                              handleTitleEdit(item.id, e.target.value)
                            }
                            className="text-sm"
                            placeholder={t("editTitlePlaceholder")}
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
                  <p>{t("emptyStateHint")}</p>
                </div>
              )}
            </div>

            {/* 右側：生成選項 */}
            <div className="space-y-4 border-l pl-6">
              <div>
                <h3 className="font-semibold mb-4">{t("options.title")}</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="target-language">
                    {t("options.targetLanguage")}
                  </Label>
                  <Select
                    value={targetLanguage}
                    onValueChange={setTargetLanguage}
                  >
                    <SelectTrigger id="target-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-TW">
                        繁體中文 (Traditional Chinese)
                      </SelectItem>
                      <SelectItem value="zh-CN">
                        简体中文 (Simplified Chinese)
                      </SelectItem>
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
                      <SelectItem value="vi">
                        Tiếng Việt (Vietnamese)
                      </SelectItem>
                      <SelectItem value="id">
                        Bahasa Indonesia (Indonesian)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="word-count">{t("options.wordCount")}</Label>
                  <Select value={wordCount} onValueChange={setWordCount}>
                    <SelectTrigger id="word-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="800">
                        {t("options.words", { count: 800 })}
                      </SelectItem>
                      <SelectItem value="1200">
                        {t("options.words", { count: 1200 })}
                      </SelectItem>
                      <SelectItem value="1500">
                        {t("options.words", { count: 1500 })}
                      </SelectItem>
                      <SelectItem value="2000">
                        {t("options.words", { count: 2000 })}
                      </SelectItem>
                      <SelectItem value="3000">
                        {t("options.words", { count: 3000 })}
                      </SelectItem>
                      <SelectItem value="5000">
                        {t("options.words", { count: 5000 })}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2 text-sm text-muted-foreground border-t">
                  <p className="font-medium mb-1">
                    {t("options.autoImageTitle")}
                  </p>
                  <p className="text-xs">{t("options.autoImageDesc")}</p>
                </div>

                <div className="pt-4 space-y-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    <p>• {t("options.hint1")}</p>
                    <p>• {t("options.hint2")}</p>
                    <p>• {t("options.hint3")}</p>
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
