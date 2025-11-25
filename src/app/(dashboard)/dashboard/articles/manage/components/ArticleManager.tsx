"use client";

import { useState } from "react";
import { ArticleList } from "./ArticleList";
import { ArticlePreview } from "./ArticlePreview";

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

interface ArticleManagerProps {
  initialArticles: Article[];
}

export function ArticleManager({ initialArticles }: ArticleManagerProps) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(
    initialArticles[0] || null,
  );

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
  };

  const handleUpdateArticle = async (
    articleId: string,
    updates: Partial<Article>,
  ) => {
    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("更新失敗");
      }

      const updatedArticle = await response.json();

      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, ...updatedArticle } : a)),
      );

      if (selectedArticle?.id === articleId) {
        setSelectedArticle((prev) =>
          prev ? { ...prev, ...updatedArticle } : null,
        );
      }
    } catch (error) {
      console.error("更新文章失敗:", error);
      alert("更新失敗，請稍後再試");
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm("確定要刪除這篇文章嗎？此操作無法復原。")) {
      return;
    }

    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("刪除失敗");
      }

      setArticles((prev) => prev.filter((a) => a.id !== articleId));

      if (selectedArticle?.id === articleId) {
        setSelectedArticle(articles.find((a) => a.id !== articleId) || null);
      }
    } catch (error) {
      console.error("刪除文章失敗:", error);
      alert("刪除失敗，請稍後再試");
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      <ArticleList
        articles={articles}
        selectedId={selectedArticle?.id || null}
        onSelect={handleSelectArticle}
        onDelete={handleDeleteArticle}
      />
      <ArticlePreview
        article={selectedArticle}
        onSave={async (updates) => {
          if (selectedArticle) {
            await handleUpdateArticle(selectedArticle.id, updates);
          }
        }}
      />
    </div>
  );
}
