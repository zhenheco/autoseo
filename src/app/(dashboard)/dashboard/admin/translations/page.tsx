"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
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
  ChevronLeft,
  ChevronRight,
  Globe,
  Languages,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Zap,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  TranslationLocale,
  ArticleTranslationSummary,
} from "@/types/translations";
import {
  TRANSLATION_LANGUAGES,
  TRANSLATION_LOCALES,
} from "@/types/translations";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";


/** 語言按鈕元件 Props */
interface LanguageButtonProps {
  locale: TranslationLocale;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/** 語言按鈕元件 */
function LanguageButton({ locale, isSelected, onClick, disabled }: LanguageButtonProps): React.ReactNode {
  const lang = TRANSLATION_LANGUAGES[locale];
  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="gap-1"
    >
      <span>{lang.flagEmoji}</span>
      <span className="hidden sm:inline">{lang.nativeName}</span>
    </Button>
  );
}

/** 網站自動翻譯設定類型 */
interface WebsiteAutoTranslateSettings {
  id: string;
  website_name: string;
  auto_translate_enabled: boolean;
  auto_translate_languages: string[];
  site_type: "platform" | "external";
}

/** 切換 Set 中的項目 */
function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
  const newSet = new Set(set);
  if (newSet.has(item)) {
    newSet.delete(item);
  } else {
    newSet.add(item);
  }
  return newSet;
}

/** 從 API 回應提取 data */
function extractData<T>(result: { data?: T } | T): T {
  return (result as { data?: T }).data ?? (result as T);
}

/**
 * 翻譯管理頁面
 *
 * 僅開放給特定帳號使用（acejou27@gmail.com）
 */
export default function AdminTranslationsPage() {
  const t = useTranslations("admin.translations");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [articles, setArticles] = useState<ArticleTranslationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "translated" | "not_translated">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
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
        throw new Error(t("loadSettingsFailed"));
      }
      const data = extractData(await response.json());
      setWebsiteSettings(data.websites || []);
    } catch (error) {
      console.error(t("loadAutoTranslateSettingsFailed"), error);
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
        throw new Error(data.error || t("updateFailed"));
      }

      // 更新本地 state
      setWebsiteSettings((prev) =>
        prev.map((w) =>
          w.id === websiteId
            ? { ...w, auto_translate_enabled: enabled, auto_translate_languages: languages }
            : w
        )
      );

      toast.success(t("settingsSaved"));
    } catch (error) {
      console.error(t("updateAutoTranslateSettingsFailed"), error);
      toast.error(error instanceof Error ? error.message : t("updateSettingsFailed"));
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
    const newLanguages = Array.from(
      toggleSetItem(new Set(website.auto_translate_languages), locale)
    );
    // 如果取消所有語言，也要關閉自動翻譯
    const newEnabled = newLanguages.length > 0 && website.auto_translate_enabled;
    updateSettings(website.id, newEnabled, newLanguages);
  };

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        filter,
      });
      if (search) params.set("search", search);
      if (websiteId) params.set("website_id", websiteId);

      const response = await fetch(`/api/translations/articles?${params}`);

      if (response.status === 403) {
        setAccessDenied(true);
        toast.error(t("accessDeniedToast"));
        return;
      }

      if (!response.ok) {
        throw new Error(t("loadFailed"));
      }

      const data = extractData(await response.json());
      setArticles(data.articles || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error(t("loadArticlesFailed"), error);
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, websiteId, filter, currentPage, pageSize]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedArticles(
      checked ? new Set(articles.map((a) => a.article_id)) : new Set()
    );
  };

  const handleSelectArticle = (articleId: string) => {
    setSelectedArticles(toggleSetItem(selectedArticles, articleId));
  };

  const handleToggleLanguage = (locale: TranslationLocale) => {
    setSelectedLanguages(toggleSetItem(selectedLanguages, locale));
  };

  const handleTranslate = async () => {
    if (selectedArticles.size === 0) {
      toast.error(t("selectAtLeastOneArticle"));
      return;
    }

    if (selectedLanguages.size === 0) {
      toast.error(t("selectAtLeastOneLanguage"));
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
        throw new Error(data.error || t("createTranslationJobFailed"));
      }

      const data = await response.json();

      // 根據結果顯示不同訊息
      if (data.job_count === 0 && data.skipped?.count > 0) {
        toast.info(
          t("allArticlesSkipped", { count: data.skipped.count })
        );
      } else if (data.skipped?.count > 0) {
        toast.success(
          t("jobsCreatedWithSkipped", { created: data.job_count, skipped: data.skipped.count })
        );
      } else {
        toast.success(
          t("jobsCreatedSuccess", { count: data.job_count })
        );
      }

      // 清空選擇
      setSelectedArticles(new Set());
    } catch (error) {
      console.error(t("createTranslationJobFailed"), error);
      toast.error(error instanceof Error ? error.message : t("createTranslationJobFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = () => {
    fetchArticles();
    fetchSettings();
  };

  // 切換篩選時重置頁碼
  const handleFilterChange = (newFilter: "all" | "translated" | "not_translated") => {
    setFilter(newFilter);
    setCurrentPage(1);
    setSelectedArticles(new Set());
  };

  // 分頁計算
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  // 產生頁碼按鈕
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  if (accessDenied) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Globe className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {t("accessDeniedTitle")}
            </h2>
            <p className="text-muted-foreground text-center">
              {t("accessDeniedDescription")}
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
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          {t("refresh")}
        </Button>
      </div>

      {/* 自動翻譯設定區塊 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle className="text-lg">{t("autoTranslateSettings")}</CardTitle>
          </div>
          <CardDescription>
            {t("autoTranslateDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : websiteSettings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {t("noWebsitesToConfigure")}
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
                          <Badge variant="outline" className="text-xs">
                            {t(`siteTypes.${website.site_type}`)}
                          </Badge>
                          {website.auto_translate_enabled && (
                            <Badge variant="secondary" className="gap-1">
                              <Zap className="h-3 w-3" />
                              {t("autoTranslate")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {website.auto_translate_enabled
                            ? t("autoTranslateEnabledInfo", { count: website.auto_translate_languages.length })
                            : t("autoTranslateDisabled")}
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
                      {TRANSLATION_LOCALES.map((locale) => (
                        <LanguageButton
                          key={locale}
                          locale={locale}
                          isSelected={website.auto_translate_languages.includes(locale)}
                          onClick={() => handleToggleAutoLanguage(website, locale)}
                          disabled={savingSettings === website.id}
                        />
                      ))}
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
            <CardTitle className="text-lg">{t("selectWebsite")}</CardTitle>
            <CardDescription>{t("selectWebsiteDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full max-w-sm">
              <WebsiteSelector
                value={websiteId}
                onChange={setWebsiteId}
                placeholder={t("allWebsites")}
                allowNoWebsite={false}
              />
            </div>
          </CardContent>
        </Card>

        {/* 語言選擇 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("targetLanguages")}</CardTitle>
            <CardDescription>
              {t("targetLanguagesDescription", { count: selectedLanguages.size })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TRANSLATION_LOCALES.map((locale) => (
                <LanguageButton
                  key={locale}
                  locale={locale}
                  isSelected={selectedLanguages.has(locale)}
                  onClick={() => handleToggleLanguage(locale)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 文章列表 */}
      <Card className="min-h-[80vh]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t("articleList")}</CardTitle>
              <CardDescription>
                {t("articleListDescription", { count: total })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
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
                {t("translateSelected")}
                {selectedArticles.size > 0 && ` (${selectedArticles.size})`}
              </Button>
            </div>
          </div>
          {/* 篩選 Tabs */}
          <Tabs value={filter} onValueChange={(v) => handleFilterChange(v as typeof filter)} className="mt-4">
            <TabsList>
              <TabsTrigger value="all">{t("filterAll")}</TabsTrigger>
              <TabsTrigger value="translated">{t("filterTranslated")}</TabsTrigger>
              <TabsTrigger value="not_translated">{t("filterNotTranslated")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t(`emptyState.${filter}`)}
            </div>
          ) : (
            <>
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
                    <TableHead>{t("articleInfo")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow key={article.article_id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedArticles.has(article.article_id)}
                          onCheckedChange={() =>
                            handleSelectArticle(article.article_id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{article.article_title}</span>
                          <span className="flex gap-0.5">
                            {article.translations
                              .filter((trans) => trans.status !== "not_translated")
                              .map((trans) => (
                                <span
                                  key={trans.locale}
                                  title={`${TRANSLATION_LANGUAGES[trans.locale].nativeName} (${trans.status})`}
                                  className="text-sm opacity-80"
                                >
                                  {TRANSLATION_LANGUAGES[trans.locale].flagEmoji}
                                </span>
                              ))}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分頁元件 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {t("paginationInfo", { start: startItem, end: endItem, total })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          disabled={loading}
                          className="min-w-[36px]"
                        >
                          {page}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || loading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
