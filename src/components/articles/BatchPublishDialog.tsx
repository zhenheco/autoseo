"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { WebsiteSelector } from "./WebsiteSelector";
import { toast } from "sonner";
import { ArticleListItem } from "@/types/article.types";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

interface BatchPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: ArticleListItem[];
  onPublishSuccess: () => void;
}

export function BatchPublishDialog({
  open,
  onOpenChange,
  articles,
  onPublishSuccess,
}: BatchPublishDialogProps) {
  const t = useTranslations("articles.batchPublish");
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [websiteName, setWebsiteName] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("publish");
  const [isPublishing, setIsPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    async function fetchWebsiteName() {
      if (!websiteId) {
        setWebsiteName(null);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("website_configs")
        .select("website_name")
        .eq("id", websiteId)
        .single();

      if (!error && data) {
        setWebsiteName(data.website_name);
      }
    }

    fetchWebsiteName();
  }, [websiteId]);

  const handleBatchPublish = async () => {
    if (!websiteId) {
      toast.error(t("selectWebsiteError"));
      return;
    }

    setIsPublishing(true);
    setProgress(0);
    setStats(null);

    try {
      const articleIds = articles.map((a) => a.id);

      const res = await fetch("/api/articles/batch-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          article_ids: articleIds,
          website_id: websiteId,
          target: "wordpress",
          status,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t("publishFailed"));
      }

      const data = await res.json();
      setStats(data.stats);
      setProgress(100);

      if (data.stats.failed === 0) {
        toast.success(t("publishSuccess", { count: data.stats.success }));
      } else {
        toast.warning(
          t("publishPartial", {
            success: data.stats.success,
            failed: data.stats.failed,
          }),
        );
      }

      onPublishSuccess();
    } catch (error) {
      toast.error(
        t("publishError") +
          ": " +
          (error instanceof Error ? error.message : t("unknownError")),
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = () => {
    if (!isPublishing) {
      setStats(null);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title", { count: articles.length })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t("selectedArticles")}</Label>
            <div className="max-h-[200px] overflow-y-auto rounded-md border p-3">
              <ul className="space-y-1">
                {articles.map((article) => (
                  <li key={article.id} className="text-sm">
                    • {article.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="website">{t("targetWebsite")}</Label>
            <WebsiteSelector
              value={websiteId}
              onChange={setWebsiteId}
              placeholder={t("selectWebsite")}
              disabled={isPublishing}
            />
          </div>
          {websiteId && websiteName && !isPublishing && !stats && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t("confirmMessage", {
                  count: articles.length,
                  website: websiteName,
                })}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="status">{t("publishStatus")}</Label>
            <Select
              value={status}
              onValueChange={setStatus}
              disabled={isPublishing}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("statusDraft")}</SelectItem>
                <SelectItem value="publish">{t("statusPublished")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isPublishing && (
            <div className="grid gap-2">
              <Label>{t("progress")}</Label>
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  {t("publishing")}
                </span>
              </div>
            </div>
          )}
          {stats && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">{t("result")}</p>
              <div className="mt-2 space-y-1 text-sm">
                <p>{t("total", { count: stats.total })}</p>
                <p className="text-green-600">
                  {t("success", { count: stats.success })}
                </p>
                {stats.failed > 0 && (
                  <p className="text-red-600">
                    {t("failed", { count: stats.failed })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          {!stats ? (
            <Button
              onClick={handleBatchPublish}
              disabled={isPublishing || !websiteId}
            >
              {isPublishing ? t("publishing") : t("startPublish")}
            </Button>
          ) : (
            <Button onClick={handleClose}>{t("close")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
