"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ExternalLink,
  Key,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Code,
  FileText,
  Settings,
} from "lucide-react";
import Link from "next/link";
import {
  registerExternalSite,
  regenerateExternalSiteApiKey,
  deleteExternalSite,
} from "./actions";
import { WebsiteStatusToggle } from "./website-status-toggle";

interface ExternalSite {
  id: string;
  website_name: string;
  wordpress_url: string;
  api_key_created_at: string | null;
  is_active: boolean | null;
}

interface ExternalSitesSectionProps {
  sites: ExternalSite[];
  companyId: string;
}

export function ExternalSitesSection({
  sites,
  companyId,
}: ExternalSitesSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [regeneratedKey, setRegeneratedKey] = useState<{
    siteId: string;
    apiKey: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 處理新增外部網站
   */
  const handleAddSite = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);

    formData.append("companyId", companyId);

    const result = await registerExternalSite(formData);

    setIsLoading(false);

    if (result.success && result.apiKey) {
      setNewApiKey(result.apiKey);
    } else {
      setError(result.error || "新增失敗");
    }
  };

  /**
   * 處理重新生成 API Key
   */
  const handleRegenerateKey = async (websiteId: string) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("websiteId", websiteId);

    const result = await regenerateExternalSiteApiKey(formData);

    setIsLoading(false);

    if (result.success && result.apiKey) {
      setRegeneratedKey({ siteId: websiteId, apiKey: result.apiKey });
    } else {
      setError(result.error || "重新生成失敗");
    }
  };

  /**
   * 複製 API Key 到剪貼簿
   */
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  };

  /**
   * 關閉新增對話框並重置狀態
   */
  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
    setNewApiKey(null);
    setError(null);
  };

  /**
   * 關閉重新生成 Key 的對話框
   */
  const closeRegenerateDialog = () => {
    setRegeneratedKey(null);
  };

  return (
    <div className="space-y-4">
      {/* 區塊標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">外部網站（API 整合）</h2>
          <Badge variant="secondary" className="text-xs">
            {sites.length} 個網站
          </Badge>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              新增外部網站
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增外部網站</DialogTitle>
              <DialogDescription>
                註冊外部 Next.js 網站以透過 API 取得文章內容
              </DialogDescription>
            </DialogHeader>

            {newApiKey ? (
              // 顯示新生成的 API Key
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4 border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    網站已建立成功！請妥善保管 API Key，此金鑰只會顯示一次。
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 rounded border text-sm font-mono break-all">
                      {newApiKey}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(newApiKey)}
                    >
                      {copiedKey === newApiKey ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={closeAddDialog}>完成</Button>
                </DialogFooter>
              </div>
            ) : (
              // 顯示新增表單
              <form action={handleAddSite}>
                <div className="space-y-4">
                  {error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="websiteName">網站名稱</Label>
                    <Input
                      id="websiteName"
                      name="websiteName"
                      placeholder="例如：我的工具網站"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">網站網址</Label>
                    <Input
                      id="websiteUrl"
                      name="websiteUrl"
                      type="url"
                      placeholder="https://example.com"
                      required
                    />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeAddDialog}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "建立中..." : "建立網站"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* 錯誤訊息 */}
      {error && !isAddDialogOpen && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 網站列表 */}
      {sites.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Code className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-2">尚未註冊任何外部網站</p>
            <p className="text-sm text-muted-foreground">
              外部網站可以透過 API 取得發布到平台的文章
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card key={site.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {site.website_name}
                  </CardTitle>
                  <WebsiteStatusToggle
                    websiteId={site.id}
                    initialStatus={site.is_active ?? true}
                  />
                </div>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <a
                    href={site.wordpress_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline flex items-center gap-1"
                  >
                    {new URL(site.wordpress_url).hostname}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* API Key 狀態 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    API Key
                  </span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    sk_site_••••••••
                  </code>
                </div>

                {/* 顯示重新生成的 Key */}
                {regeneratedKey?.siteId === site.id && (
                  <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-3 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                      新的 API Key（只顯示一次）：
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded border break-all">
                        {regeneratedKey.apiKey}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard(regeneratedKey.apiKey)}
                      >
                        {copiedKey === regeneratedKey.apiKey ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full mt-2 text-xs"
                      onClick={closeRegenerateDialog}
                    >
                      關閉
                    </Button>
                  </div>
                )}

                {/* 建立時間 */}
                {site.api_key_created_at && (
                  <div className="text-xs text-muted-foreground">
                    API Key 建立於：
                    {new Date(site.api_key_created_at).toLocaleDateString(
                      "zh-TW",
                    )}
                  </div>
                )}

                {/* 操作按鈕 - 第一排：查看文章、編輯設定 */}
                <div className="flex gap-2 pt-2">
                  <Link href={`/dashboard/websites/${site.id}`} className="flex-1">
                    <Button size="sm" variant="default" className="w-full">
                      <FileText className="h-3 w-3 mr-1" />
                      查看文章
                    </Button>
                  </Link>
                  <Link href={`/dashboard/websites/${site.id}/edit`}>
                    <Button size="sm" variant="outline">
                      <Settings className="h-3 w-3 mr-1" />
                      設定
                    </Button>
                  </Link>
                </div>

                {/* 操作按鈕 - 第二排：API Key 管理、刪除 */}
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 text-muted-foreground"
                        disabled={isLoading}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        重新生成 Key
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>重新生成 API Key？</AlertDialogTitle>
                        <AlertDialogDescription>
                          這將會使舊的 API Key 立即失效。使用舊 Key
                          的服務將無法存取 API。 確定要繼續嗎？
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRegenerateKey(site.id)}
                        >
                          確定重新生成
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <form action={deleteExternalSite}>
                    <input type="hidden" name="websiteId" value={site.id} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          type="button"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>刪除外部網站？</AlertDialogTitle>
                          <AlertDialogDescription>
                            這將會刪除網站「{site.website_name}」並使其 API Key
                            失效。 此操作無法復原。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            type="submit"
                            formAction={deleteExternalSite}
                          >
                            確定刪除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* API 使用說明 */}
      {sites.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="text-sm space-y-2">
              <p className="font-medium">API 使用方式：</p>
              <code className="block bg-background p-3 rounded text-xs overflow-x-auto">
                curl -H &quot;Authorization: Bearer sk_site_xxx&quot; \<br />
                &nbsp;&nbsp;https://1wayseo.com/api/v1/sites/articles
              </code>
              <p className="text-muted-foreground text-xs">
                完整 API 文檔請參考開發者指南
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
