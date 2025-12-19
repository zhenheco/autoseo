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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import {
  ArticleWithWebsite,
  publishArticle,
  assignWebsiteToArticle,
} from "../actions";
import { Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("articles");
  const tCommon = useTranslations("common");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    article.website_id,
  );
  const [publishStatus, setPublishStatus] = useState<"publish" | "draft">(
    "publish",
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

    const result = await publishArticle(
      article.id,
      selectedWebsiteId,
      publishStatus,
    );

    if (result.success) {
      setPublishState("success");
      setPublishedUrl(result.url || null);
    } else {
      setPublishState("error");
      setErrorMessage(result.error || t("publish.failed"));
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

  const articleTitle =
    article.generated_articles?.title ||
    article.keywords?.join(", ") ||
    t("table.untitled");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {publishState === "success"
              ? t("publish.success")
              : t("publish.title")}
          </DialogTitle>
          <DialogDescription>
            {publishState === "success"
              ? t("publish.successDesc")
              : t("publish.publishTo", { title: articleTitle })}
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
              <div className="space-y-2">
                <Label>{t("publish.statusLabel")}</Label>
                <RadioGroup
                  value={publishStatus}
                  onValueChange={(value) =>
                    setPublishStatus(value as "publish" | "draft")
                  }
                  disabled={publishState === "publishing"}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="publish" id="status-publish" />
                    <Label
                      htmlFor="status-publish"
                      className="font-normal cursor-pointer"
                    >
                      {t("publish.statusPublish")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="draft" id="status-draft" />
                    <Label
                      htmlFor="status-draft"
                      className="font-normal cursor-pointer"
                    >
                      {t("publish.statusDraft")}
                    </Label>
                  </div>
                </RadioGroup>
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
                onClick={handleClose}
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
