"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useScheduleContext } from "./ScheduleContext";
import {
  ArticleWithWebsite,
  updateArticleContent,
  getArticleHtml,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Save, Check, Loader2 } from "lucide-react";
import { TiptapEditor } from "@/components/articles/TiptapEditor";
import { marked } from "marked";

interface ArticlePreviewProps {
  articles: ArticleWithWebsite[];
}

function containsMarkdown(content: string): boolean {
  if (!content) return false;
  const markdownPatterns = [
    /^#{1,6}\s/m,
    /\*\*[^*]+\*\*/,
    /\*[^*]+\*/,
    /```[\s\S]*?```/,
    /^\s*[-*+]\s/m,
    /^\s*\d+\.\s/m,
  ];
  return markdownPatterns.some((pattern) => pattern.test(content));
}

async function ensureHtml(content: string): Promise<string> {
  if (!content) return "";
  if (containsMarkdown(content)) {
    return await marked.parse(content);
  }
  return content;
}

export function ArticlePreview({ articles }: ArticlePreviewProps) {
  const { previewArticleId } = useScheduleContext();
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const prevArticleIdRef = useRef<string | null>(null);

  const article = articles.find((a) => a.id === previewArticleId);

  const generatedArticle = article?.generated_articles || null;

  // 標題從列表資料取得（不需要額外請求）
  const originalTitle =
    generatedArticle?.title || article?.keywords?.join(", ") || "未命名文章";

  // 當選擇的文章改變時，從快取或 API 獲取 HTML 內容
  useEffect(() => {
    if (article && article.id !== prevArticleIdRef.current) {
      prevArticleIdRef.current = article.id;

      const loadContent = async () => {
        setIsLoading(true);
        setEditedTitle(originalTitle);
        setEditedContent(""); // 先清空
        setHasChanges(false);
        setSaveSuccess(false);

        try {
          // 使用新的 API 獲取 HTML 內容（帶快取）
          const result = await getArticleHtml(article.id);

          if (result.error) {
            console.error("Failed to load article HTML:", result.error);
            setEditedContent("<p>無法載入文章內容</p>");
          } else {
            const processedContent = await ensureHtml(result.html || "");
            setEditedContent(processedContent);
            setLoadedFromCache(result.fromCache);
          }
        } catch (err) {
          console.error("Error loading article:", err);
          setEditedContent("<p>載入失敗</p>");
        } finally {
          setIsLoading(false);
        }
      };

      loadContent();
    }
  }, [article, originalTitle]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditedTitle(e.target.value);
      setHasChanges(true);
      setSaveSuccess(false);
    },
    [],
  );

  const handleContentChange = useCallback((html: string) => {
    setEditedContent(html);
    setHasChanges(true);
    setSaveSuccess(false);
  }, []);

  const handleSave = async () => {
    if (!article || !hasChanges) return;

    setIsSaving(true);
    const result = await updateArticleContent(
      article.id,
      editedTitle,
      editedContent,
    );
    setIsSaving(false);

    if (result.success) {
      setSaveSuccess(true);
      setHasChanges(false);
      setLoadedFromCache(false); // 儲存後快取已失效
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  if (!article) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <FileText className="mb-4 h-12 w-12" />
        <p>點擊文章以預覽</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="mb-4 shrink-0 bg-background pb-2">
        <div className="flex items-center gap-2">
          <Input
            value={editedTitle}
            onChange={handleTitleChange}
            className="text-xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto lg:text-2xl"
            placeholder="輸入標題..."
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges || isLoading}
            variant={saveSuccess ? "outline" : "default"}
          >
            {isSaving ? (
              "儲存中..."
            ) : saveSuccess ? (
              <>
                <Check className="mr-1 h-4 w-4" />
                已儲存
              </>
            ) : (
              <>
                <Save className="mr-1 h-4 w-4" />
                儲存
              </>
            )}
          </Button>
          {loadedFromCache && (
            <span className="text-xs text-muted-foreground">⚡ 快取</span>
          )}
        </div>
      </header>
      <div className="flex-1 min-h-0 wordpress-preview">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">載入中...</span>
          </div>
        ) : (
          <TiptapEditor
            content={editedContent}
            onChange={handleContentChange}
            editable={true}
          />
        )}
      </div>
    </div>
  );
}
