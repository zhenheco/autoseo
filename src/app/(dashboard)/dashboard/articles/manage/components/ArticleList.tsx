"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

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

interface ArticleListProps {
  articles: Article[];
  selectedId: string | null;
  onSelect: (article: Article) => void;
  onDelete: (id: string) => void;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
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
  selectedId,
  onSelect,
  onDelete,
}: ArticleListProps) {
  return (
    <div className="w-[400px] border-r border-black flex flex-col overflow-hidden">
      <div className="p-4">
        <h2 className="text-lg font-semibold">文章列表</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {articles.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>沒有找到文章</p>
            </div>
          ) : (
            articles.map((article) => {
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
                      <StatusIcon className="h-3 w-3" />
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
      </ScrollArea>

      <div className="p-3 bg-muted/50">
        <p className="text-xs text-muted-foreground text-center">
          共 {articles.length} 篇文章
        </p>
      </div>
    </div>
  );
}
