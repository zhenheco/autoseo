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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import {
  ArticleWithWebsite,
  publishArticle,
  assignWebsiteToArticle,
} from "../actions";
import { Loader2, CheckCircle, ExternalLink, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

// 同步目標類型（對應 website_configs 的外部網站）
interface SyncTarget {
  id: string;
  website_name: string;
  external_slug: string | null;
}

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

  // 同步目標相關 state
  const [syncTargets, setSyncTargets] = useState<SyncTarget[]>([]);
  const [selectedSyncTargets, setSelectedSyncTargets] = useState<string[]>([]);
  const [loadingSyncTargets, setLoadingSyncTargets] = useState(false);

  // 獲取同步目標列表
  useEffect(() => {
    if (!open) return;

    setLoadingSyncTargets(true);
    fetch("/api/sync-targets")
      .then((res) => res.json())
      .then((data) => {
        // API 返回格式：{ success: true, data: [...] } 或直接陣列
        const targets: SyncTarget[] = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
        setSyncTargets(targets);
        // 預設全選
        setSelectedSyncTargets(targets.map((t) => t.id));
      })
      .catch((error) => {
        console.error("[QuickPublishDialog] 獲取同步目標失敗:", error);
      })
      .finally(() => {
        setLoadingSyncTargets(false);
      });
  }, [open]);

  // 切換同步目標選擇
  const toggleSyncTarget = (targetId: string) => {
    setSelectedSyncTargets((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId],
    );
  };

  const handlePublish = async () => {
    if (!selectedWebsiteId) return;

    setPublishState("publishing");
    setErrorMessage(null);

    if (selectedWebsiteId !== article.website_id) {
      await assignWebsiteToArticle(article.id, selectedWebsiteId);
    }

    // 傳入選擇的同步目標
    const result = await publishArticle(
      article.id,
      selectedWebsiteId,
      publishStatus,
      selectedSyncTargets, // 傳入同步目標 ID 列表
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
      // 不重置同步目標選擇，讓用戶保持上次的選擇
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

              {/* 同步目標選擇 */}
              {syncTargets.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("publish.syncTargets")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("publish.syncTargetsDesc")}
                  </p>
                  <div className="space-y-2 rounded-md border p-3">
                    {loadingSyncTargets ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t("publish.loadingSyncTargets")}
                      </div>
                    ) : (
                      syncTargets.map((target) => (
                        <div
                          key={target.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`sync-${target.id}`}
                            checked={selectedSyncTargets.includes(target.id)}
                            onCheckedChange={() => toggleSyncTarget(target.id)}
                            disabled={publishState === "publishing"}
                          />
                          <Label
                            htmlFor={`sync-${target.id}`}
                            className="font-normal cursor-pointer"
                          >
                            {target.website_name}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

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
