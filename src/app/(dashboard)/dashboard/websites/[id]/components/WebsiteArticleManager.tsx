"use client";

import { useState, useEffect, useCallback } from "react";
import { WebsiteArticleList, ArticleJob } from "./WebsiteArticleList";
import { WebsiteArticlePreview } from "./WebsiteArticlePreview";
import { useArticleJobRealtime } from "@/lib/hooks/useArticleJobRealtime";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Loader2, Plus } from "lucide-react";
import Link from "next/link";

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

interface WebsiteArticleManagerProps {
  initialArticles: Article[];
  initialJobs?: ArticleJob[];
  websiteId: string;
  companyId: string;
}

export function WebsiteArticleManager({
  initialArticles,
  initialJobs = [],
  websiteId,
  companyId,
}: WebsiteArticleManagerProps) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [jobs, setJobs] = useState<ArticleJob[]>(initialJobs);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(
    initialArticles[0] || null,
  );
  const [articlesPerDay, setArticlesPerDay] = useState<string>("1");
  const [isScheduling, setIsScheduling] = useState(false);

  const handleJobCompleted = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleJobStatusChange = useCallback(
    (job: {
      id: string;
      status: string;
      progress: number | null;
      current_step: string | null;
    }) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: job.status,
                progress: job.progress ?? j.progress,
                current_step: job.current_step ?? j.current_step,
              }
            : j,
        ),
      );
    },
    [],
  );

  useArticleJobRealtime({
    companyId: companyId,
    onCompleted: handleJobCompleted,
    onFailed: handleJobCompleted,
    onStatusChange: handleJobStatusChange,
  });

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    setArticles(initialArticles);
    if (initialArticles.length > 0 && !selectedArticle) {
      setSelectedArticle(initialArticles[0]);
    }
  }, [initialArticles, selectedArticle]);

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

      toast.success("文章已儲存");
    } catch (error) {
      console.error("更新文章失敗:", error);
      toast.error("更新失敗，請稍後再試");
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

      toast.success("文章已刪除");
    } catch (error) {
      console.error("刪除文章失敗:", error);
      toast.error("刪除失敗，請稍後再試");
    }
  };

  const handleSchedulePublish = async () => {
    setIsScheduling(true);
    try {
      const response = await fetch("/api/articles/schedule-batch-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          articles_per_day: parseInt(articlesPerDay),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "排程發布失敗");
      }

      const result = await response.json();
      toast.success(`成功排程 ${result.scheduled_count} 篇文章發布`);
      router.refresh();
    } catch (error) {
      console.error("排程發布失敗:", error);
      toast.error(
        "排程發布失敗: " +
          (error instanceof Error ? error.message : "未知錯誤"),
      );
    } finally {
      setIsScheduling(false);
    }
  };

  const publishableArticles = articles.filter(
    (a) => a.status === "generated" || a.status === "reviewed",
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          {publishableArticles.length > 0 && (
            <>
              <Select
                value={articlesPerDay}
                onValueChange={setArticlesPerDay}
                disabled={isScheduling}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      每天 {n} 篇
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleSchedulePublish}
                disabled={isScheduling}
                variant="outline"
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    排程中...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    設定排程發布（{publishableArticles.length} 篇）
                  </>
                )}
              </Button>
            </>
          )}
        </div>
        <Link href={`/dashboard/articles?website=${websiteId}`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增文章
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <WebsiteArticleList
          articles={articles}
          jobs={jobs}
          selectedId={selectedArticle?.id || null}
          onSelect={handleSelectArticle}
          onDelete={handleDeleteArticle}
        />
        <WebsiteArticlePreview
          article={selectedArticle}
          onSave={async (updates) => {
            if (selectedArticle) {
              await handleUpdateArticle(selectedArticle.id, updates);
            }
          }}
        />
      </div>
    </div>
  );
}
