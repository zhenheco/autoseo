"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TiptapEditor } from "./TiptapEditor";
import { ArticleListItem } from "@/types/article.types";

interface InlineHtmlEditorProps {
  article: ArticleListItem | null;
  onSave: (html: string, title: string, contentJson?: object) => Promise<void>;
  onPublish: (article: ArticleListItem) => void;
}

export function InlineHtmlEditor({
  article,
  onSave,
  onPublish,
}: InlineHtmlEditorProps) {
  const [title, setTitle] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [contentJson, setContentJson] = useState<object | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setHtmlContent(article.html_content);
      setHasUnsavedChanges(false);
    }
  }, [article?.id]);

  useEffect(() => {
    if (!article) return;

    const hasChanges =
      title !== article.title || htmlContent !== article.html_content;

    setHasUnsavedChanges(hasChanges);

    if (!hasChanges) return;

    const timeoutId = setTimeout(() => {
      localStorage.setItem(
        `article-draft-${article.id}`,
        JSON.stringify({ title, htmlContent, contentJson }),
      );
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [title, htmlContent, contentJson, article]);

  const handleContentChange = useCallback((html: string, json: object) => {
    setHtmlContent(html);
    setContentJson(json);
  }, []);

  const handleSave = useCallback(async () => {
    if (!article || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      await onSave(htmlContent, title, contentJson || undefined);
      setHasUnsavedChanges(false);
      localStorage.removeItem(`article-draft-${article.id}`);
      toast.success("儲存成功");
    } catch (error) {
      toast.error(
        "儲存失敗：" + (error instanceof Error ? error.message : "未知錯誤"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [article, htmlContent, title, contentJson, hasUnsavedChanges, onSave]);

  const handlePublish = useCallback(() => {
    if (!article) return;
    if (hasUnsavedChanges) {
      toast.error("請先儲存變更");
      return;
    }
    onPublish(article);
  }, [article, hasUnsavedChanges, onPublish]);

  if (!article) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        請選擇一篇文章
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 text-lg font-semibold"
            placeholder="文章標題"
          />
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            variant="outline"
          >
            {isSaving ? "儲存中..." : "儲存"}
          </Button>
          <Button onClick={handlePublish} disabled={hasUnsavedChanges}>
            發布
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="h-full overflow-y-auto p-4">
          <TiptapEditor
            content={htmlContent}
            onChange={handleContentChange}
            editable={true}
          />
        </div>
      </div>
    </div>
  );
}
