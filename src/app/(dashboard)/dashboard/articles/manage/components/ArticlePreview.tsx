"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Edit3,
  Eye,
  Save,
  X,
  ExternalLink,
  Copy,
  Check,
  FileText,
} from "lucide-react";

interface Article {
  id: string;
  title: string;
  html_content: string | null;
  markdown_content: string | null;
  status: string;
  word_count: number | null;
  reading_time: number | null;
  focus_keyword: string | null;
  seo_title: string | null;
  seo_description: string | null;
  featured_image_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  wordpress_post_url: string | null;
}

interface ArticlePreviewProps {
  article: Article | null;
  isEditing: boolean;
  onEditToggle: () => void;
  onSave: (updates: Partial<Article>) => Promise<void>;
}

export function ArticlePreview({
  article,
  isEditing,
  onEditToggle,
  onSave,
}: ArticlePreviewProps) {
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedSeoTitle, setEditedSeoTitle] = useState("");
  const [editedSeoDescription, setEditedSeoDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (article) {
      setEditedContent(article.html_content || "");
      setEditedTitle(article.title || "");
      setEditedSeoTitle(article.seo_title || "");
      setEditedSeoDescription(article.seo_description || "");
    }
  }, [article]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        title: editedTitle,
        html_content: editedContent,
        seo_title: editedSeoTitle,
        seo_description: editedSeoDescription,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyHtml = async () => {
    if (article?.html_content) {
      await navigator.clipboard.writeText(article.html_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center text-muted-foreground">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">選擇一篇文章來預覽</p>
          <p className="text-sm mt-1">從左側列表選擇文章</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between bg-background">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-lg font-semibold"
              placeholder="文章標題"
            />
          ) : (
            <h2 className="text-lg font-semibold truncate">{article.title}</h2>
          )}
          {article.wordpress_post_url && !isEditing && (
            <a
              href={article.wordpress_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
            >
              查看發布文章 <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={onEditToggle}>
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "儲存中..." : "儲存"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleCopyHtml}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    已複製
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    複製 HTML
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={onEditToggle}>
                <Edit3 className="h-4 w-4 mr-1" />
                編輯
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="preview" className="flex-1 flex flex-col">
        <div className="px-4 border-b">
          <TabsList className="h-10">
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="h-4 w-4" />
              預覽
            </TabsTrigger>
            <TabsTrigger value="html" className="gap-1">
              <FileText className="h-4 w-4" />
              HTML
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1">
              SEO
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="preview" className="flex-1 m-0">
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="p-6">
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <div
                  dangerouslySetInnerHTML={{
                    __html: isEditing
                      ? editedContent
                      : article.html_content || "<p>無內容</p>",
                  }}
                />
              </article>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="html" className="flex-1 m-0 p-4">
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="h-[calc(100vh-14rem)] font-mono text-sm"
              placeholder="HTML 內容..."
            />
          ) : (
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{article.html_content || "無內容"}</code>
              </pre>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="seo" className="flex-1 m-0 p-4">
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-4 max-w-2xl">
              <div className="space-y-2">
                <Label htmlFor="seo-title">SEO 標題</Label>
                {isEditing ? (
                  <Input
                    id="seo-title"
                    value={editedSeoTitle}
                    onChange={(e) => setEditedSeoTitle(e.target.value)}
                    placeholder="SEO 標題"
                  />
                ) : (
                  <p className="text-sm p-2 bg-muted rounded">
                    {article.seo_title || "未設定"}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  字數:{" "}
                  {(isEditing ? editedSeoTitle : article.seo_title)?.length ||
                    0}{" "}
                  / 60
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-description">SEO 描述</Label>
                {isEditing ? (
                  <Textarea
                    id="seo-description"
                    value={editedSeoDescription}
                    onChange={(e) => setEditedSeoDescription(e.target.value)}
                    placeholder="SEO 描述"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm p-2 bg-muted rounded">
                    {article.seo_description || "未設定"}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  字數:{" "}
                  {(isEditing ? editedSeoDescription : article.seo_description)
                    ?.length || 0}{" "}
                  / 160
                </p>
              </div>

              <div className="space-y-2">
                <Label>關鍵字</Label>
                <p className="text-sm p-2 bg-muted rounded">
                  {article.focus_keyword || "未設定"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-muted-foreground text-xs">字數</Label>
                  <p className="text-sm font-medium">
                    {article.word_count || 0} 字
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    閱讀時間
                  </Label>
                  <p className="text-sm font-medium">
                    {article.reading_time || 1} 分鐘
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
