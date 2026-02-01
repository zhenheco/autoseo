"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("articles");
  const tCommon = useTranslations("common");
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
      setErrorMessage(result.error || t("publish.failed"));
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
          {t("publish.title")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {publishState === "success" ? t("publish.success") : t("publish.title")}
          </DialogTitle>
          <DialogDescription>
            {publishState === "success"
              ? t("publish.successDesc")
              : t("publish.selectTargetAndPublish")}
          </DialogDescription>
        </DialogHeader>

        {publishState === "success" ? (
          <div className="py-6 flex flex-col items-center gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="text-sm text-muted-foreground">
              {t("publish.pageRefreshHint")}
            </p>
            {publishedUrl && (
              <Button variant="outline" asChild>
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("publish.viewArticle")}
                </a>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="website">{t("targetWebsite")}</Label>
                <WebsiteSelector
                  value={selectedWebsiteId}
                  onChange={setSelectedWebsiteId}
                  disabled={publishState === "publishing"}
                  placeholder={t("publish.selectWebsite")}
                />
              </div>
              {!selectedWebsiteId && (
                <p className="text-sm text-muted-foreground">
                  {t("publish.pleaseSelectWebsite")}
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
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handlePublish}
                disabled={!selectedWebsiteId || publishState === "publishing"}
              >
                {publishState === "publishing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("publish.publishing")}
                  </>
                ) : (
                  t("publish.confirmPublish")
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
