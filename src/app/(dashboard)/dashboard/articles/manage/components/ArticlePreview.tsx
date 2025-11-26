"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useScheduleContext } from "./ScheduleContext";
import { ArticleWithWebsite, updateArticleContent } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Save, Check } from "lucide-react";
import { TiptapEditor } from "@/components/articles/TiptapEditor";

interface ArticlePreviewProps {
  articles: ArticleWithWebsite[];
}

export function ArticlePreview({ articles }: ArticlePreviewProps) {
  const { previewArticleId } = useScheduleContext();
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const prevArticleIdRef = useRef<string | null>(null);

  const article = articles.find((a) => a.id === previewArticleId);

  const generatedArticle = article?.generated_articles?.[0] || null;

  const originalTitle =
    generatedArticle?.title || article?.keywords?.join(", ") || "未命名文章";
  const originalContent = generatedArticle?.html_content || "";

  useEffect(() => {
    if (article && article.id !== prevArticleIdRef.current) {
      prevArticleIdRef.current = article.id;
      setTimeout(() => {
        setEditedTitle(originalTitle);
        setEditedContent(originalContent);
        setHasChanges(false);
        setSaveSuccess(false);
      }, 0);
    }
  }, [article, originalTitle, originalContent]);

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
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  if (!article) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-muted-foreground">
        <FileText className="mb-4 h-12 w-12" />
        <p>點擊文章以預覽</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="wordpress-preview">
        <article>
          <header className="mb-4">
            <div className="flex items-center gap-2">
              <Input
                value={editedTitle}
                onChange={handleTitleChange}
                className="text-xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto lg:text-2xl"
                placeholder="輸入標題..."
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
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
            </div>
          </header>
          <TiptapEditor
            content={editedContent}
            onChange={handleContentChange}
            editable={true}
          />
        </article>
      </div>
    </div>
  );
}
