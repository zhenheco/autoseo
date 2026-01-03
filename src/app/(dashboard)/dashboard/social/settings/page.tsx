"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Facebook,
  Instagram,
  AtSign,
  Key,
  User,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

// 發文小助手系統 URL
const BAS_SYSTEM_URL = "https://bas.zhenhe-dm.com";

/**
 * 社群帳號設定
 */
interface SocialConfig {
  id: string;
  basUserId: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

/**
 * 已連結帳號
 */
interface SocialAccount {
  id: string;
  platform: "facebook" | "instagram" | "threads";
  account_id: string;
  account_name: string;
  page_name: string | null;
  followers_count: number | null;
  synced_at: string;
}

/**
 * 平台圖標對應
 */
const platformIcons = {
  facebook: Facebook,
  instagram: Instagram,
  threads: AtSign,
};

/**
 * 平台顏色對應
 */
const platformColors = {
  facebook: "bg-blue-500",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  threads: "bg-black",
};

/**
 * 社群帳號設定頁面
 */
export default function SocialSettingsPage() {
  const t = useTranslations("social");

  const [config, setConfig] = useState<SocialConfig | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 表單狀態
  const [basApiKey, setBasApiKey] = useState("");
  const [basUserId, setBasUserId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 載入設定和帳號
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [configRes, accountsRes] = await Promise.all([
        fetch("/api/social/config"),
        fetch("/api/social/accounts"),
      ]);

      // 處理 config API 回應
      if (configRes.ok) {
        const data = await configRes.json();
        if (data.config) {
          setConfig(data.config);
          setBasUserId(data.config.basUserId || "");
        }
      } else {
        const errorData = await configRes.json().catch(() => ({}));
        // 處理「沒有公司」的特殊錯誤
        if (errorData.code === "NO_COMPANY") {
          setError(
            "請先完成公司設定。前往「設定」頁面建立或加入公司後，即可使用社群發文功能。",
          );
          return; // 不繼續載入其他資料
        } else if (configRes.status !== 401) {
          // 忽略未登入錯誤（會被重定向）
          console.error("載入設定失敗:", errorData.error);
        }
      }

      // 處理 accounts API 回應
      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.accounts || []);
      } else {
        const errorData = await accountsRes.json().catch(() => ({}));
        if (errorData.code === "NO_COMPANY") {
          setError(
            "請先完成公司設定。前往「設定」頁面建立或加入公司後，即可使用社群發文功能。",
          );
        }
      }
    } catch (err) {
      console.error("載入資料失敗:", err);
      setError("載入資料時發生錯誤，請重新整理頁面");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 儲存設定
  const handleSaveConfig = async () => {
    if (!basApiKey.trim() || !basUserId.trim()) {
      setError("請填寫 API Key 和 User ID");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/social/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basApiKey, basUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "儲存失敗");
      }

      setSuccess("設定已儲存！正在同步帳號...");
      setShowForm(false);
      setBasApiKey("");

      // 重新載入資料
      await loadData();

      // 自動同步帳號
      await handleSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  // 同步帳號
  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch("/api/social/accounts/sync", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "同步失敗");
      }

      setSuccess(`同步完成！找到 ${data.accountsCount} 個帳號`);

      // 重新載入帳號
      const accountsRes = await fetch("/api/social/accounts");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.accounts || []);
      }

      // 重新載入設定（更新最後同步時間）
      const configRes = await fetch("/api/social/config");
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.config) {
          setConfig(configData.config);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失敗");
    } finally {
      setSyncing(false);
    }
  };

  // 清除訊息
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* 返回按鈕和標題 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/social">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToSocial") || "返回社群管理"}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8 text-primary" />
          {t("accountSettings") || "帳號設定"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("accountSettingsPageDesc") ||
            "設定發文小助手 API 並連接您的社群媒體帳號"}
        </p>
      </div>

      {/* 成功/錯誤訊息 */}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* API 設定卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t("apiSettings") || "API 設定"}
          </CardTitle>
          <CardDescription>
            {t("apiSettingsDesc") || "設定發文小助手的 API 金鑰"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config && !showForm ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">
                      {t("apiConnected") || "API 已連接"}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      User ID: {config.basUserId}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(true)}
                >
                  {t("updateApi") || "更新設定"}
                </Button>
              </div>
              {config.lastSyncedAt && (
                <p className="text-sm text-muted-foreground">
                  {t("lastSynced") || "最後同步時間"}:{" "}
                  {new Date(config.lastSyncedAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="basUserId"
                    className="flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    {t("basUserId") || "發文小助手 User ID"}
                  </Label>
                  <Input
                    id="basUserId"
                    placeholder="請輸入 User ID"
                    value={basUserId}
                    onChange={(e) => setBasUserId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="basApiKey"
                    className="flex items-center gap-2"
                  >
                    <Key className="h-4 w-4" />
                    {t("basApiKey") || "發文小助手 API Key"}
                  </Label>
                  <Input
                    id="basApiKey"
                    type="password"
                    placeholder="請輸入 API Key"
                    value={basApiKey}
                    onChange={(e) => setBasApiKey(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={saving}>
                  {saving
                    ? t("saving") || "儲存中..."
                    : t("saveSettings") || "儲存設定"}
                </Button>
                {config && (
                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    {t("cancel") || "取消"}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("apiKeyHelp") ||
                  "請至發文小助手 > 帳號管理 > API 設定頁面取得"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已連結帳號卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("connectedAccounts") || "已連結帳號"}</CardTitle>
              <CardDescription>
                {t("connectedAccountsDesc") ||
                  "以下是您在發文小助手中已連接的社群帳號"}
              </CardDescription>
            </div>
            {config && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing
                  ? t("syncing") || "同步中..."
                  : t("sync") || "同步帳號"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!config ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {t("noApiConfig") || "尚未設定 API"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("pleaseSetupApi") ||
                  "請先設定發文小助手 API Key 以連接社群帳號"}
              </p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {t("noAccounts") || "尚無連結帳號"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("pleaseConnectInBas") ||
                  "請先在發文小助手中連接您的社群帳號，然後點擊同步"}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing
                  ? t("syncing") || "同步中..."
                  : t("syncNow") || "立即同步"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => {
                const Icon = platformIcons[account.platform];
                const bgColor = platformColors[account.platform];

                return (
                  <div
                    key={account.id}
                    className="flex items-center gap-4 p-4 border rounded-lg"
                  >
                    <div
                      className={`h-12 w-12 rounded-full ${bgColor} flex items-center justify-center`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {account.account_name}
                        </p>
                        <Badge
                          variant="secondary"
                          className="capitalize text-xs"
                        >
                          {account.platform}
                        </Badge>
                      </div>
                      {account.page_name && (
                        <p className="text-sm text-muted-foreground truncate">
                          {account.page_name}
                        </p>
                      )}
                      {account.followers_count != null && (
                        <p className="text-xs text-muted-foreground">
                          {account.followers_count.toLocaleString()} followers
                        </p>
                      )}
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 發文小助手系統連結 */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-blue-600" />
            {t("basSystemManagement") || "發文小助手管理"}
          </CardTitle>
          <CardDescription>
            {t("basSystemManagementDesc") ||
              "前往發文小助手連接社群帳號、查看額度、購買發文點數"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href={BAS_SYSTEM_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("goToBas") || "前往發文小助手"}
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* 說明 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("setupGuide") || "設定指南"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </div>
            <div>
              <h4 className="font-medium">
                {t("guide1Title") || "取得 API 金鑰"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("guide1Desc") ||
                  "登入發文小助手，前往「帳號管理 > API 設定」取得 User ID 和 API Key"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              2
            </div>
            <div>
              <h4 className="font-medium">
                {t("guide2Title") || "連接社群帳號"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("guide2Desc") ||
                  "在發文小助手中連接您的 Facebook、Instagram 或 Threads 帳號"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              3
            </div>
            <div>
              <h4 className="font-medium">{t("guide3Title") || "同步帳號"}</h4>
              <p className="text-sm text-muted-foreground">
                {t("guide3Desc") ||
                  "點擊「同步帳號」按鈕，系統會自動取得您已連接的社群帳號"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
