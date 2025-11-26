"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, CheckCircle, ExternalLink } from "lucide-react";
import { publishArticle, assignWebsiteToArticle } from "../../manage/actions";

interface ArticleDetailPublishProps {
  articleId: string;
  currentWebsiteId: string | null;
}

type PublishState = "idle" | "publishing" | "success" | "error";

export function ArticleDetailPublish({
  articleId,
  currentWebsiteId,
}: ArticleDetailPublishProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    currentWebsiteId,
  );
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const handlePublish = async () => {
    if (!selectedWebsiteId) return;

    setPublishState("publishing");
    setErrorMessage(null);

    if (selectedWebsiteId !== currentWebsiteId) {
      await assignWebsiteToArticle(articleId, selectedWebsiteId);
    }

    const result = await publishArticle(articleId, selectedWebsiteId);

    if (result.success) {
      setPublishState("success");
      setPublishedUrl(result.url || null);
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } else {
      setPublishState("error");
      setErrorMessage(result.error || "發布失敗");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (publishState === "publishing") return;
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        setPublishState("idle");
        setErrorMessage(null);
        setPublishedUrl(null);
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Send className="mr-2 h-4 w-4" />
          發布文章
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {publishState === "success" ? "發布成功" : "發布文章"}
          </DialogTitle>
          <DialogDescription>
            {publishState === "success"
              ? "文章已成功發布至 WordPress"
              : "選擇目標網站並發布文章"}
          </DialogDescription>
        </DialogHeader>

        {publishState === "success" ? (
          <div className="py-6 flex flex-col items-center gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="text-sm text-muted-foreground">
              頁面將在 2 秒後自動重新整理
            </p>
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
                onClick={() => handleOpenChange(false)}
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
