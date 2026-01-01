"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Share2,
  Facebook,
  Instagram,
  AtSign,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";

// 巴斯系統 URL
const BAS_SYSTEM_URL = "https://bas.zhenhe-dm.com";

/**
 * 社群帳號
 */
interface SocialAccount {
  id: string;
  platform: "facebook" | "instagram" | "threads";
  account_id: string;
  account_name: string;
  page_name: string | null;
}

/**
 * 生成的文案
 */
interface GeneratedContent {
  professional: {
    content: string;
    hashtags: string[];
    characterCount: number;
  };
  catchy: {
    content: string;
    hashtags: string[];
    characterCount: number;
  };
  story: {
    content: string;
    hashtags: string[];
    characterCount: number;
  };
}

/**
 * 文案風格
 */
type ContentStyle = "professional" | "catchy" | "story";

/**
 * 風格設定
 */
const styleConfig: Record<
  ContentStyle,
  { label: string; description: string; color: string }
> = {
  professional: {
    label: "專業版",
    description: "數據導向、專業術語、適合 B2B",
    color: "bg-blue-500",
  },
  catchy: {
    label: "吸睛版",
    description: "問句開頭、製造好奇、病毒傳播",
    color: "bg-orange-500",
  },
  story: {
    label: "故事版",
    description: "第一人稱、情感連結、個人品牌",
    color: "bg-purple-500",
  },
};

/**
 * 平台圖標
 */
const platformIcons = {
  facebook: Facebook,
  instagram: Instagram,
  threads: AtSign,
};

/**
 * 平台顏色
 */
const platformColors = {
  facebook: "bg-blue-500",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  threads: "bg-black",
};

interface SocialShareDialogProps {
  articleId: string;
  articleTitle: string;
  featuredImageUrl?: string;
  trigger?: React.ReactNode;
}

export function SocialShareDialog({
  articleId,
  articleTitle,
  featuredImageUrl,
  trigger,
}: SocialShareDialogProps) {
  const t = useTranslations("social");
  const [open, setOpen] = useState(false);

  // 狀態
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] =
    useState<GeneratedContent | null>(null);
  const [selectedStyle, setSelectedStyle] =
    useState<ContentStyle>("professional");
  const [editedContent, setEditedContent] = useState("");
  const [editedHashtags, setEditedHashtags] = useState<string[]>([]);

  // 載入狀態
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // 訊息狀態
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isInsufficientCredits, setIsInsufficientCredits] = useState(false);

  // 載入帳號
  const loadData = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const accountsRes = await fetch("/api/social/accounts");

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error("載入資料失敗:", err);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadData();
      // 重置錯誤狀態
      setError(null);
      setIsInsufficientCredits(false);
    }
  }, [open, loadData]);

  // 生成文案
  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch("/api/social/ai/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          platform: "instagram", // 預設以 Instagram 的字數為基準
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "生成失敗");
      }

      setGeneratedContent(data.content);
      // 預設選擇專業版
      setEditedContent(data.content.professional.content);
      setEditedHashtags(data.content.professional.hashtags);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失敗");
    } finally {
      setGenerating(false);
    }
  };

  // 切換風格
  const handleStyleChange = (style: ContentStyle) => {
    setSelectedStyle(style);
    if (generatedContent) {
      setEditedContent(generatedContent[style].content);
      setEditedHashtags(generatedContent[style].hashtags);
    }
  };

  // 切換帳號選擇
  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId],
    );
  };

  // 發布
  const handlePublish = async () => {
    if (selectedAccounts.length === 0) {
      setError("請選擇至少一個發布帳號");
      return;
    }

    if (!editedContent.trim()) {
      setError("請輸入文案內容");
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      setIsInsufficientCredits(false);

      const selectedAccountsData = accounts
        .filter((acc) => selectedAccounts.includes(acc.account_id))
        .map((acc) => ({
          platform: acc.platform,
          accountId: acc.account_id,
          accountName: acc.account_name,
        }));

      const response = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          selectedAccounts: selectedAccountsData,
          content: editedContent,
          contentStyle: selectedStyle,
          mediaUrl: featuredImageUrl,
          hashtags: editedHashtags,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 檢查是否為額度不足錯誤
        if (
          data.error?.includes("額度不足") ||
          data.error?.includes("insufficient") ||
          data.error?.includes("credit") ||
          data.code === "INSUFFICIENT_CREDITS"
        ) {
          setIsInsufficientCredits(true);
          setError(
            t("insufficientCreditsError") ||
              "巴斯系統額度不足，請至巴斯系統購買額度後再試",
          );
        } else {
          throw new Error(data.error || "發布失敗");
        }
        return;
      }

      setSuccess(t("publishSuccess") || "發布成功！");

      // 3 秒後關閉對話框
      setTimeout(() => {
        setOpen(false);
        setSuccess(null);
        // 重置狀態
        setGeneratedContent(null);
        setSelectedAccounts([]);
        setEditedContent("");
        setEditedHashtags([]);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發布失敗");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            {t("shareToSocial") || "分享到社群"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t("shareToSocial") || "分享到社群"}
          </DialogTitle>
          <DialogDescription>{articleTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 錯誤/成功訊息 */}
          {error && (
            <div className="flex flex-col gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              {isInsufficientCredits && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="self-start"
                >
                  <a
                    href={BAS_SYSTEM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("goToBas") || "前往巴斯系統購買額度"}
                  </a>
                </Button>
              )}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              {success}
            </div>
          )}

          {/* 帳號選擇 */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              {t("selectAccounts") || "選擇發布帳號"}
            </Label>
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{t("noAccountsConnected") || "尚未連接社群帳號"}</p>
                <p className="text-sm">
                  {t("pleaseConnectFirst") || "請先在帳號設定中連接帳號"}
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {accounts.map((account) => {
                  const Icon = platformIcons[account.platform];
                  const bgColor = platformColors[account.platform];
                  const isSelected = selectedAccounts.includes(
                    account.account_id,
                  );

                  return (
                    <div
                      key={account.account_id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                      onClick={() => handleAccountToggle(account.account_id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          handleAccountToggle(account.account_id)
                        }
                      />
                      <div
                        className={`h-8 w-8 rounded-full ${bgColor} flex items-center justify-center`}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {account.account_name}
                        </p>
                        {account.page_name && (
                          <p className="text-xs text-muted-foreground truncate">
                            {account.page_name}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="capitalize text-xs">
                        {account.platform}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI 生成文案 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                {t("postContent") || "貼文內容"}
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {generating
                  ? t("generating") || "生成中..."
                  : t("aiGenerate") || "AI 生成文案"}
              </Button>
            </div>

            {/* 風格選擇 */}
            {generatedContent && (
              <div className="flex gap-2">
                {(Object.keys(styleConfig) as ContentStyle[]).map((style) => {
                  const config = styleConfig[style];
                  const isSelected = selectedStyle === style;

                  return (
                    <button
                      key={style}
                      className={`flex-1 p-3 border rounded-lg text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                      onClick={() => handleStyleChange(style)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`h-2 w-2 rounded-full ${config.color}`}
                        />
                        <span className="font-medium text-sm">
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {config.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 文案編輯 */}
            <Textarea
              placeholder={
                t("enterContent") || "請輸入或使用 AI 生成貼文內容..."
              }
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[150px]"
            />

            {/* 字數統計 */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{editedContent.length} 字</span>
              {editedHashtags.length > 0 && (
                <span>{editedHashtags.length} 個標籤</span>
              )}
            </div>

            {/* Hashtag */}
            {editedHashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editedHashtags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 發布按鈕 */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              {t("cancel") || "取消"}
            </Button>
            <Button
              onClick={handlePublish}
              disabled={
                publishing ||
                selectedAccounts.length === 0 ||
                !editedContent.trim()
              }
              className="flex-1"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              {publishing
                ? t("publishing") || "發布中..."
                : t("publish") || "發布"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
