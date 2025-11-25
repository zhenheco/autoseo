"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  Calendar,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useMemo, useState } from "react";
import type { ArticleJob } from "./ArticleManager";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type ListItem =
  | { type: "article"; data: Article }
  | { type: "job"; data: ArticleJob };

interface ArticleListProps {
  articles: Article[];
  jobs?: ArticleJob[];
  selectedId: string | null;
  onSelect: (article: Article) => void;
  onDelete: (id: string) => void;
  onSchedulePublish?: (
    websiteId: string,
    articlesPerDay: number,
  ) => Promise<void>;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType; animate?: boolean }
> = {
  pending: {
    label: "等待中",
    color: "text-gray-500 bg-gray-50",
    icon: Clock,
  },
  processing: {
    label: "生成中",
    color: "text-blue-500 bg-blue-50",
    icon: Loader2,
    animate: true,
  },
  generated: {
    label: "已生成",
    color: "text-blue-500 bg-blue-50",
    icon: FileText,
  },
  reviewed: {
    label: "已審核",
    color: "text-yellow-500 bg-yellow-50",
    icon: Eye,
  },
  published: {
    label: "已發布",
    color: "text-green-500 bg-green-50",
    icon: CheckCircle,
  },
  archived: {
    label: "已封存",
    color: "text-gray-500 bg-gray-50",
    icon: XCircle,
  },
};

export function ArticleList({
  articles,
  jobs = [],
  selectedId,
  onSelect,
  onDelete,
  onSchedulePublish,
}: ArticleListProps) {
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    null,
  );
  const [articlesPerDay, setArticlesPerDay] = useState<string>("1");
  const [isScheduling, setIsScheduling] = useState(false);

  const combinedList = useMemo<ListItem[]>(() => {
    const articleItems: ListItem[] = articles
      .filter((a) => a.title && a.title.trim() !== "")
      .map((a) => ({
        type: "article" as const,
        data: a,
      }));
    const jobItems: ListItem[] = jobs
      .filter((j) => j.metadata?.title)
      .map((j) => ({
        type: "job" as const,
        data: j,
      }));

    return [...articleItems, ...jobItems].sort(
      (a, b) =>
        new Date(b.data.created_at).getTime() -
        new Date(a.data.created_at).getTime(),
    );
  }, [articles, jobs]);

  const articlesWithTitle = articles.filter(
    (a) => a.title && a.title.trim() !== "",
  );
  const jobsWithTitle = jobs.filter((j) => j.metadata?.title);
  const totalCount = articlesWithTitle.length + jobsWithTitle.length;

  const publishableArticles = articlesWithTitle.filter(
    (a) => a.status === "generated" || a.status === "reviewed",
  );

  const handleSchedulePublish = async () => {
    if (!selectedWebsiteId || !onSchedulePublish) return;
    setIsScheduling(true);
    try {
      await onSchedulePublish(selectedWebsiteId, parseInt(articlesPerDay));
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="w-[400px] flex flex-col overflow-hidden">
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold">文章列表</h2>

        {onSchedulePublish && publishableArticles.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <WebsiteSelector
                  value={selectedWebsiteId}
                  onChange={setSelectedWebsiteId}
                  placeholder="選擇發布網站"
                  disabled={isScheduling}
                />
              </div>
              <Select
                value={articlesPerDay}
                onValueChange={setArticlesPerDay}
                disabled={isScheduling}
              >
                <SelectTrigger className="w-[100px]">
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
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={handleSchedulePublish}
              disabled={!selectedWebsiteId || isScheduling}
            >
              {isScheduling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  排程中...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-1" />
                  設定排程發布（{publishableArticles.length} 篇）
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="p-2 h-full overflow-y-auto">
          {combinedList.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>沒有找到文章</p>
            </div>
          ) : (
            combinedList.map((item) => {
              if (item.type === "job") {
                const job = item.data;
                const title =
                  job.metadata?.title ||
                  (job.keywords && job.keywords[0]) ||
                  "生成中的文章";
                const status = statusConfig[job.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={`job-${job.id}`}
                    className="p-3 rounded-lg mb-2 border border-dashed border-blue-200 bg-blue-50/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate text-muted-foreground">
                          {title}
                        </h3>
                        {job.current_step && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {job.current_step}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                          status.color,
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "h-3 w-3",
                            status.animate && "animate-spin",
                          )}
                        />
                        {status.label}
                        {job.progress != null && job.progress > 0 && (
                          <span className="ml-1">{job.progress}%</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(job.created_at), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </span>
                    </div>
                  </div>
                );
              }

              const article = item.data;
              const status =
                statusConfig[article.status] || statusConfig.generated;
              const StatusIcon = status.icon;

              return (
                <div
                  key={article.id}
                  className={cn(
                    "p-3 rounded-lg mb-2 cursor-pointer transition-colors group",
                    selectedId === article.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted border border-transparent",
                  )}
                  onClick={() => onSelect(article)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {article.title}
                      </h3>
                      {article.focus_keyword && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          關鍵字: {article.focus_keyword}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(article.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                        status.color,
                      )}
                    >
                      <StatusIcon
                        className={cn(
                          "h-3 w-3",
                          status.animate && "animate-spin",
                        )}
                      />
                      {status.label}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(article.created_at), {
                        addSuffix: true,
                        locale: zhTW,
                      })}
                      {article.word_count && ` · ${article.word_count} 字`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="p-3 bg-muted/50">
        <p className="text-xs text-muted-foreground text-center">
          共 {totalCount} 篇{jobs.length > 0 && `（${jobs.length} 篇生成中）`}
        </p>
      </div>
    </div>
  );
}
