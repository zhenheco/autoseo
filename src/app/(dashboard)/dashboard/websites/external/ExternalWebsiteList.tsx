"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ExternalWebsiteListItem,
  CreateExternalWebsiteFormData,
} from "@/types/external-website.types";

const INITIAL_FORM_DATA: CreateExternalWebsiteFormData = {
  name: "",
  slug: "",
  description: "",
  webhook_url: "",
  sync_on_publish: true,
  sync_on_update: true,
  sync_on_unpublish: true,
  sync_translations: true,
};

export function ExternalWebsiteList(): React.ReactElement {
  const [websites, setWebsites] = useState<ExternalWebsiteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] =
    useState<CreateExternalWebsiteFormData>(INITIAL_FORM_DATA);

  const fetchWebsites = useCallback(async () => {
    try {
      const response = await fetch("/api/websites/external");
      const data = await response.json();

      if (data.success) {
        setWebsites(data.data);
      } else {
        toast.error(data.error || "無法載入外部網站");
      }
    } catch {
      toast.error("載入外部網站失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  async function handleCreate(): Promise<void> {
    if (!formData.name || !formData.slug || !formData.webhook_url) {
      toast.error("請填寫必填欄位");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/websites/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("外部網站已建立");
        setCreateDialogOpen(false);
        setNewSecret(data.data.webhook_secret);
        setSecretDialogOpen(true);
        setFormData(INITIAL_FORM_DATA);
        fetchWebsites();
      } else {
        toast.error(data.error || "建立失敗");
      }
    } catch {
      toast.error("建立外部網站失敗");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(
    website: ExternalWebsiteListItem,
  ): Promise<void> {
    try {
      const response = await fetch(`/api/websites/external/${website.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !website.is_active }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(website.is_active ? "已停用" : "已啟用");
        fetchWebsites();
      } else {
        toast.error(data.error || "操作失敗");
      }
    } catch {
      toast.error("操作失敗");
    }
  }

  async function handleRegenerateSecret(
    website: ExternalWebsiteListItem,
  ): Promise<void> {
    if (
      !confirm("確定要重新生成 Webhook Secret？舊的 Secret 將立即失效。")
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/websites/external/${website.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate_secret: true }),
      });

      const data = await response.json();

      if (data.success && data.new_webhook_secret) {
        setNewSecret(data.new_webhook_secret);
        setSecretDialogOpen(true);
        fetchWebsites();
      } else {
        toast.error(data.error || "重新生成失敗");
      }
    } catch {
      toast.error("重新生成 Secret 失敗");
    }
  }

  async function handleDelete(website: ExternalWebsiteListItem): Promise<void> {
    if (
      !confirm(`確定要刪除「${website.website_name}」？此操作無法復原。`)
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/websites/external/${website.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("已刪除");
        fetchWebsites();
      } else {
        toast.error(data.error || "刪除失敗");
      }
    } catch {
      toast.error("刪除失敗");
    }
  }

  async function copyToClipboard(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-TW");
  }

  function updateFormField<K extends keyof CreateExternalWebsiteFormData>(
    field: K,
    value: CreateExternalWebsiteFormData[K],
  ): void {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">外部網站管理</h1>
          <p className="text-muted-foreground">
            管理需要同步文章的外部專案（透過 Webhook 整合）
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增外部網站
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>外部網站列表</CardTitle>
          <CardDescription>
            文章發布後會自動透過 Webhook 同步到已啟用的外部網站
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebsiteTable
            websites={websites}
            loading={loading}
            onToggleActive={handleToggleActive}
            onRegenerateSecret={handleRegenerateSecret}
            onDelete={handleDelete}
            formatDate={formatDate}
          />
        </CardContent>
      </Card>

      {/* 建立對話框 */}
      <CreateWebsiteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        formData={formData}
        onUpdateField={updateFormField}
        onSubmit={handleCreate}
        submitting={submitting}
      />

      {/* Secret 顯示對話框 */}
      <SecretDialog
        open={secretDialogOpen}
        onOpenChange={setSecretDialogOpen}
        secret={newSecret}
        onCopy={copyToClipboard}
        copied={copied}
      />
    </div>
  );
}

// 網站列表表格元件
interface WebsiteTableProps {
  websites: ExternalWebsiteListItem[];
  loading: boolean;
  onToggleActive: (website: ExternalWebsiteListItem) => void;
  onRegenerateSecret: (website: ExternalWebsiteListItem) => void;
  onDelete: (website: ExternalWebsiteListItem) => void;
  formatDate: (dateString: string | null) => string;
}

function WebsiteTable({
  websites,
  loading,
  onToggleActive,
  onRegenerateSecret,
  onDelete,
  formatDate,
}: WebsiteTableProps): React.ReactElement {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (websites.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        尚未設定任何外部網站
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名稱</TableHead>
          <TableHead>Webhook URL</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>最後同步</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {websites.map((website) => (
          <TableRow key={website.id}>
            <TableCell>
              <div>
                <div className="font-medium">{website.website_name}</div>
                <div className="text-sm text-muted-foreground">
                  {website.external_slug}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                  {website.webhook_url}
                </code>
                {website.webhook_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => window.open(website.webhook_url!, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Switch
                  checked={website.is_active ?? false}
                  onCheckedChange={() => onToggleActive(website)}
                />
                <SyncStatusBadge status={website.last_sync_status} />
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">{formatDate(website.last_synced_at)}</div>
              {website.last_sync_error && (
                <div className="text-xs text-destructive truncate max-w-[150px]">
                  {website.last_sync_error}
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Link href={`/dashboard/websites/external/${website.id}/edit`}>
                  <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRegenerateSecret(website)}
                  title="重新生成 Secret"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(website)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// 同步狀態標籤
function SyncStatusBadge({
  status,
}: {
  status: string | null;
}): React.ReactElement | null {
  if (status === "success") {
    return <Badge variant="default">成功</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive">失敗</Badge>;
  }
  return null;
}

// 建立網站對話框
interface CreateWebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreateExternalWebsiteFormData;
  onUpdateField: <K extends keyof CreateExternalWebsiteFormData>(
    field: K,
    value: CreateExternalWebsiteFormData[K],
  ) => void;
  onSubmit: () => void;
  submitting: boolean;
}

function CreateWebsiteDialog({
  open,
  onOpenChange,
  formData,
  onUpdateField,
  onSubmit,
  submitting,
}: CreateWebsiteDialogProps): React.ReactElement {
  const syncSettings = [
    { key: "sync_on_publish" as const, label: "發布時同步" },
    { key: "sync_on_update" as const, label: "更新時同步" },
    { key: "sync_on_unpublish" as const, label: "取消發布時同步" },
    { key: "sync_translations" as const, label: "同步翻譯版本" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新增外部網站</DialogTitle>
          <DialogDescription>
            設定要透過 Webhook 同步文章的外部專案
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名稱 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onUpdateField("name", e.target.value)}
              placeholder="例如: onehand"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">識別碼 *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) =>
                onUpdateField(
                  "slug",
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
              placeholder="例如: onehand"
            />
            <p className="text-xs text-muted-foreground">
              只能包含小寫字母、數字和連字符
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook_url">Webhook URL *</Label>
            <Input
              id="webhook_url"
              value={formData.webhook_url}
              onChange={(e) => onUpdateField("webhook_url", e.target.value)}
              placeholder="https://example.com/api/webhooks/1wayseo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => onUpdateField("description", e.target.value)}
              placeholder="選填"
            />
          </div>
          <div className="space-y-3">
            <Label>同步設定</Label>
            {syncSettings.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={formData[key]}
                  onCheckedChange={(checked) => onUpdateField(key, checked)}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            建立
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Secret 顯示對話框
interface SecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: string | null;
  onCopy: (text: string) => void;
  copied: boolean;
}

function SecretDialog({
  open,
  onOpenChange,
  secret,
  onCopy,
  copied,
}: SecretDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Webhook Secret</DialogTitle>
          <DialogDescription>
            請妥善保存此 Secret，關閉後將不會再顯示完整值。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted p-3 rounded text-sm break-all">
              {secret}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onCopy(secret || "")}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            在外部專案中設定環境變數：
          </p>
          <code className="block bg-muted p-2 rounded text-xs">
            ONEWAYSEO_WEBHOOK_SECRET={secret}
          </code>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>我已保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
