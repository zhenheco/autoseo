"use client";

import { useState } from "react";
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
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import {
  ArticleWithWebsite,
  publishArticle,
  assignWebsiteToArticle,
} from "../actions";
import { Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QuickPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: ArticleWithWebsite;
}

type PublishState = "idle" | "publishing" | "success" | "error";

export function QuickPublishDialog({
  open,
  onOpenChange,
  article,
}: QuickPublishDialogProps) {
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    article.website_id,
  );
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const handlePublish = async () => {
    if (!selectedWebsiteId) return;

    setPublishState("publishing");
    setErrorMessage(null);

    if (selectedWebsiteId !== article.website_id) {
      await assignWebsiteToArticle(article.id, selectedWebsiteId);
    }

    const result = await publishArticle(article.id, selectedWebsiteId);

    if (result.success) {
      setPublishState("success");
      setPublishedUrl(result.url || null);
    } else {
      setPublishState("error");
      setErrorMessage(result.error || "發布失敗");
    }
  };

  const handleClose = () => {
    if (publishState === "publishing") return;
    onOpenChange(false);
    setTimeout(() => {
      setPublishState("idle");
      setErrorMessage(null);
      setPublishedUrl(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {publishState === "success" ? "發布成功" : "發布文章"}
          </DialogTitle>
          <DialogDescription>
            {publishState === "success"
              ? "文章已成功發布至 WordPress"
              : `將「${article.article_title || "未命名"}」發布到指定網站`}
          </DialogDescription>
        </DialogHeader>

        {publishState === "success" ? (
          <div className="py-6 flex flex-col items-center gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            {publishedUrl && (
              <Button variant="outline" asChild>
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  查看文章
                </a>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="website">目標網站</Label>
                <WebsiteSelector
                  value={selectedWebsiteId}
                  onChange={setSelectedWebsiteId}
                  disabled={publishState === "publishing"}
                  placeholder="選擇要發布的網站"
                />
              </div>
              {!selectedWebsiteId && (
                <p className="text-sm text-muted-foreground">
                  請選擇要發布的目標網站
                </p>
              )}
              {errorMessage && (
                <Alert className="border-destructive text-destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={publishState === "publishing"}
              >
                取消
              </Button>
              <Button
                onClick={handlePublish}
                disabled={!selectedWebsiteId || publishState === "publishing"}
              >
                {publishState === "publishing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    發布中...
                  </>
                ) : (
                  "確認發布"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
