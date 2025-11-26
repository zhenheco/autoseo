"use client";

import { useScheduleContext } from "./ScheduleContext";
import { ArticleWithWebsite } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface ArticlePreviewProps {
  articles: ArticleWithWebsite[];
}

export function ArticlePreview({ articles }: ArticlePreviewProps) {
  const { previewArticleId } = useScheduleContext();

  const article = articles.find((a) => a.id === previewArticleId);

  if (!article) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full min-h-[400px] flex-col items-center justify-center text-muted-foreground">
          <FileText className="mb-4 h-12 w-12" />
          <p>點擊文章以預覽</p>
        </CardContent>
      </Card>
    );
  }

  const generatedContent = article.generated_content as {
    title?: string;
    content?: string;
    meta_description?: string;
    featured_image?: string;
  } | null;

  const title =
    article.article_title ||
    generatedContent?.title ||
    article.keywords?.join(", ") ||
    "未命名文章";
  const content = generatedContent?.content || "";
  const metaDescription = generatedContent?.meta_description || "";
  const featuredImage = generatedContent?.featured_image || "";

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="h-full overflow-y-auto p-0">
        <div className="wordpress-preview">
          {featuredImage && (
            <div className="featured-image">
              <img src={featuredImage} alt={title} className="w-full" />
            </div>
          )}
          <article className="p-6">
            <header className="mb-6">
              <h1 className="mb-4 text-2xl font-bold leading-tight text-foreground lg:text-3xl">
                {title}
              </h1>
              {metaDescription && (
                <p className="text-sm italic text-muted-foreground">
                  {metaDescription}
                </p>
              )}
            </header>
            <div
              className="prose prose-sm max-w-none dark:prose-invert lg:prose-base"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </article>
        </div>
      </CardContent>
    </Card>
  );
}
