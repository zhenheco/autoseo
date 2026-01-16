"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Globe,
  Languages,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Zap,
} from "lucide-react";
import type {
  TranslationLocale,
  ArticleTranslationSummary,
} from "@/types/translations";
import {
  TRANSLATION_LANGUAGES,
  TRANSLATION_LOCALES,
} from "@/types/translations";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";

// 網站自動翻譯設定類型
interface WebsiteAutoTranslateSettings {
  id: string;
  website_name: string;
  auto_translate_enabled: boolean;
  auto_translate_languages: string[];
}

/**
 * 翻譯管理頁面
 *
 * 僅開放給特定帳號使用（acejou27@gmail.com）
 */
export default function AdminTranslationsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [articles, setArticles] = useState<ArticleTranslationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(
    new Set()
  );
  const [selectedLanguages, setSelectedLanguages] = useState<
    Set<TranslationLocale>
  >(new Set(["en-US"]));
  const [accessDenied, setAccessDenied] = useState(false);

  // 自動翻譯設定 state
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [websiteSettings, setWebsiteSettings] = useState<
    WebsiteAutoTranslateSettings[]
  >([]);
  const [savingSettings, setSavingSettings] = useState<string | null>(null);

  // 載入自動翻譯設定
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/translations/settings");
      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!response.ok) {
        throw new Error("載入設定失敗");
      }
      const result = await response.json();
      // successResponse 包裝在 data 欄位中
      const data = result.data || result;
      setWebsiteSettings(data.websites || []);
    } catch (error) {
      console.error("載入自動翻譯設定失敗:", error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // 更新單一網站的自動翻譯設定
  const updateSettings = async (
    websiteId: string,
    enabled: boolean,
    languages: string[]
  ) => {
    setSavingSettings(websiteId);
    try {
      const response = await fetch("/api/translations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          auto_translate_enabled: enabled,
          auto_translate_languages: languages,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "更新失敗");
      }

      // 更新本地 state
      setWebsiteSettings((prev) =>
        prev.map((w) =>
          w.id === websiteId
            ? { ...w, auto_translate_enabled: enabled, auto_translate_languages: languages }
            : w
        )
      );

      toast.success("設定已儲存");
    } catch (error) {
      console.error("更新自動翻譯設定失敗:", error);
      toast.error(error instanceof Error ? error.message : "更新設定失敗");
    } finally {
      setSavingSettings(null);
    }
  };

  // 切換網站的自動翻譯開關
  const handleToggleAutoTranslate = (website: WebsiteAutoTranslateSettings) => {
    const newEnabled = !website.auto_translate_enabled;
    // 如果啟用但沒有選擇語言，預設選擇英文
    const languages =
      newEnabled && website.auto_translate_languages.length === 0
        ? ["en-US"]
        : website.auto_translate_languages;
    updateSettings(website.id, newEnabled, languages);
  };

  // 切換網站的目標語言
  const handleToggleAutoLanguage = (
    website: WebsiteAutoTranslateSettings,
    locale: TranslationLocale
  ) => {
    const currentLanguages = new Set(website.auto_translate_languages);
    if (currentLanguages.has(locale)) {
      currentLanguages.delete(locale);
    } else {
      currentLanguages.add(locale);
    }
    const newLanguages = Array.from(currentLanguages);
    // 如果取消所有語言，也要關閉自動翻譯
    const newEnabled =
      newLanguages.length > 0 ? website.auto_translate_enabled : false;
    updateSettings(website.id, newEnabled, newLanguages);
  };

  const fetchArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: "50",
        offset: "0",
      });
      if (search) {
        params.set("search", search);
      }
      if (websiteId) {
        params.set("website_id", websiteId);
      }

      const response = await fetch(
        `/api/translations/articles?${params.toString()}`
      );

      if (response.status === 403) {
        setAccessDenied(true);
        toast.error("翻譯功能目前為 Beta 版，僅開放給特定帳號使用");
        return;
      }

      if (!response.ok) {
        throw new Error("載入失敗");
      }

      const result = await response.json();
      // successResponse 包裝在 data 欄位中
      const data = result.data || result;
      setArticles(data.articles || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("載入文章失敗:", error);
      toast.error("載入失敗");
    } finally {
      setLoading(false);
    }
  }, [search, websiteId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArticles(new Set(articles.map((a) => a.article_id)));
    } else {
      setSelectedArticles(new Set());
    }
  };

  const handleSelectArticle = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedArticles);
    if (checked) {
      newSelected.add(articleId);
    } else {
      newSelected.delete(articleId);
    }
    setSelectedArticles(newSelected);
  };

  const handleToggleLanguage = (locale: TranslationLocale) => {
    const newSelected = new Set(selectedLanguages);
    if (newSelected.has(locale)) {
      newSelected.delete(locale);
    } else {
      newSelected.add(locale);
    }
    setSelectedLanguages(newSelected);
  };

  const handleTranslate = async () => {
    if (selectedArticles.size === 0) {
      toast.error("請選擇至少一篇文章");
      return;
    }

    if (selectedLanguages.size === 0) {
      toast.error("請選擇至少一種目標語言");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/translations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          article_ids: Array.from(selectedArticles),
          target_languages: Array.from(selectedLanguages),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "建立翻譯任務失敗");
      }

      const data = await response.json();

      // 根據結果顯示不同訊息
      if (data.job_count === 0 && data.skipped?.count > 0) {
        toast.info(
          `所有選中的文章已有該語言的翻譯，已跳過 ${data.skipped.count} 個`
        );
      } else if (data.skipped?.count > 0) {
        toast.success(
          `已建立 ${data.job_count} 個翻譯任務，跳過 ${data.skipped.count} 個已有翻譯`
        );
      } else {
        toast.success(
          `已建立 ${data.job_count} 個翻譯任務，將於 5 分鐘內開始處理`
        );
      }

      // 清空選擇
      setSelectedArticles(new Set());
    } catch (error) {
      console.error("建立翻譯任務失敗:", error);
      toast.error(error instanceof Error ? error.message : "建立翻譯任務失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = () => {
    fetchArticles();
    fetchSettings();
  };

  if (accessDenied) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Globe className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              翻譯功能目前為 Beta 版
            </h2>
            <p className="text-muted-foreground text-center">
              此功能僅開放給特定帳號使用，
              <br />
              如需開通權限請聯繫客服。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Languages className="h-8 w-8" />
            多語系翻譯管理
          </h1>
          <p className="text-muted-foreground mt-1">
            將已發布的文章翻譯成多種語言，擴展國際 SEO 覆蓋範圍
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          重新整理
        </Button>
      </div>

      {/* 自動翻譯設定區塊 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle className="text-lg">自動翻譯設定</CardTitle>
          </div>
          <CardDescription>
            啟用後，當文章排程發布時會自動觸發翻譯任務
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : websiteSettings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              沒有可設定的網站
            </p>
          ) : (
            <div className="space-y-4">
              {websiteSettings.map((website) => (
                <div
                  key={website.id}
                  className="flex flex-col gap-3 p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={website.auto_translate_enabled}
                        onCheckedChange={() =>
                          handleToggleAutoTranslate(website)
                        }
                        disabled={savingSettings === website.id}
                      />
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {website.website_name}
                          {website.auto_translate_enabled && (
                            <Badge variant="secondary" className="gap-1">
                              <Zap className="h-3 w-3" />
                              自動翻譯
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {website.auto_translate_enabled
                            ? `排程發布時自動翻譯成 ${website.auto_translate_languages.length} 種語言`
                            : "未啟用自動翻譯"}
                        </p>
                      </div>
                    </div>
                    {savingSettings === website.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>

                  {/* 目標語言選擇 - 只有啟用時才顯示 */}
                  {website.auto_translate_enabled && (
                    <div className="flex flex-wrap gap-2 pl-12">
                      {TRANSLATION_LOCALES.map((locale) => {
                        const lang = TRANSLATION_LANGUAGES[locale];
                        const isSelected =
                          website.auto_translate_languages.includes(locale);

                        return (
                          <Button
                            key={locale}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              handleToggleAutoLanguage(website, locale)
                            }
                            disabled={savingSettings === website.id}
                            className="gap-1"
                          >
                            <span>{lang.flagEmoji}</span>
                            <span className="hidden sm:inline">
                              {lang.nativeName}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 篩選區：網站選擇 + 目標語言 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 網站選擇 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">選擇網站</CardTitle>
            <CardDescription>篩選特定網站的已發布文章</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full max-w-sm">
              <WebsiteSelector
                value={websiteId}
                onChange={setWebsiteId}
                placeholder="全部網站"
                allowNoWebsite={false}
              />
            </div>
          </CardContent>
        </Card>

        {/* 語言選擇 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">目標語言</CardTitle>
            <CardDescription>
              選擇要翻譯成的語言（{selectedLanguages.size} 種已選）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TRANSLATION_LOCALES.map((locale) => {
                const lang = TRANSLATION_LANGUAGES[locale];
                const isSelected = selectedLanguages.has(locale);

                return (
                  <Button
                    key={locale}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleLanguage(locale)}
                    className="gap-1"
                  >
                    <span>{lang.flagEmoji}</span>
                    <span className="hidden sm:inline">{lang.nativeName}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 文章列表 */}
      <Card className="min-h-[80vh]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">文章列表</CardTitle>
              <CardDescription>
                選擇要翻譯的文章（共 {total} 篇已發布文章）
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜尋文章..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button
                onClick={handleTranslate}
                disabled={
                  submitting ||
                  selectedArticles.size === 0 ||
                  selectedLanguages.size === 0
                }
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Languages className="h-4 w-4 mr-2" />
                )}
                翻譯選中文章
                {selectedArticles.size > 0 && ` (${selectedArticles.size})`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              沒有已發布的文章可供翻譯
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedArticles.size === articles.length &&
                        articles.length > 0
                      }
                      onCheckedChange={(checked) =>
                        handleSelectAll(checked === true)
                      }
                    />
                  </TableHead>
                  <TableHead>文章資訊</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow key={article.article_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedArticles.has(article.article_id)}
                        onCheckedChange={(checked) =>
                          handleSelectArticle(
                            article.article_id,
                            checked === true
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{article.article_title}</span>
                        <span className="flex gap-0.5">
                          {article.translations
                            .filter((t) => t.status !== "not_translated")
                            .map((t) => (
                              <span
                                key={t.locale}
                                title={`${TRANSLATION_LANGUAGES[t.locale].nativeName} (${t.status})`}
                                className="text-sm opacity-80"
                              >
                                {TRANSLATION_LANGUAGES[t.locale].flagEmoji}
                              </span>
                            ))}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
