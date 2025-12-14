"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Globe, Languages, Loader2, RefreshCw, Search } from "lucide-react";
import type {
  TranslationLocale,
  ArticleTranslationSummary,
} from "@/types/translations";
import {
  TRANSLATION_LANGUAGES,
  TRANSLATION_LOCALES,
} from "@/types/translations";

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
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(
    new Set(),
  );
  const [selectedLanguages, setSelectedLanguages] = useState<
    Set<TranslationLocale>
  >(new Set(["en-US"]));
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, [search]);

  const fetchArticles = async () => {
    try {
      const params = new URLSearchParams({
        limit: "50",
        offset: "0",
      });
      if (search) {
        params.set("search", search);
      }

      const response = await fetch(
        `/api/translations/articles?${params.toString()}`,
      );

      if (response.status === 403) {
        setAccessDenied(true);
        toast.error("翻譯功能目前為 Beta 版，僅開放給特定帳號使用");
        return;
      }

      if (!response.ok) {
        throw new Error("載入失敗");
      }

      const data = await response.json();
      setArticles(data.articles || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("載入文章失敗:", error);
      toast.error("載入失敗");
    } finally {
      setLoading(false);
    }
  };

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
      toast.success(
        `已建立 ${data.job_count} 個翻譯任務，將於 5 分鐘內開始處理`,
      );

      // 清空選擇
      setSelectedArticles(new Set());
    } catch (error) {
      console.error("建立翻譯任務失敗:", error);
      toast.error(error instanceof Error ? error.message : "建立翻譯任務失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (
    status: "draft" | "reviewed" | "published" | "archived" | "not_translated",
  ) => {
    switch (status) {
      case "published":
        return (
          <Badge variant="default" className="bg-green-500">
            已發布
          </Badge>
        );
      case "reviewed":
        return <Badge variant="secondary">已審核</Badge>;
      case "draft":
        return <Badge variant="outline">草稿</Badge>;
      case "not_translated":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            未翻譯
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
        <Button variant="outline" onClick={fetchArticles} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          重新整理
        </Button>
      </div>

      {/* 語言選擇 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">目標語言</CardTitle>
          <CardDescription>選擇要翻譯成的語言</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {TRANSLATION_LOCALES.map((locale) => {
              const lang = TRANSLATION_LANGUAGES[locale];
              const isSelected = selectedLanguages.has(locale);

              return (
                <Button
                  key={locale}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToggleLanguage(locale)}
                  className="gap-2"
                >
                  <span>{lang.flagEmoji}</span>
                  <span>{lang.nativeName}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 文章列表 */}
      <Card>
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
                  <TableHead>文章標題</TableHead>
                  {TRANSLATION_LOCALES.map((locale) => (
                    <TableHead key={locale} className="text-center w-24">
                      {TRANSLATION_LANGUAGES[locale].flagEmoji}
                    </TableHead>
                  ))}
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
                            checked === true,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {article.article_title}
                    </TableCell>
                    {article.translations.map((t) => (
                      <TableCell key={t.locale} className="text-center">
                        {getStatusBadge(t.status)}
                      </TableCell>
                    ))}
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
