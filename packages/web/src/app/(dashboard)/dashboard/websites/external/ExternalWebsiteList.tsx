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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("externalWebsites");
  const tCommon = useTranslations("common");

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
        toast.error(data.error || t("loadFailed"));
      }
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  async function handleCreate(): Promise<void> {
    if (!formData.name || !formData.slug || !formData.webhook_url) {
      toast.error(t("fillRequiredFields"));
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
        toast.success(t("createSuccess"));
        setCreateDialogOpen(false);
        setNewSecret(data.data.webhook_secret);
        setSecretDialogOpen(true);
        setFormData(INITIAL_FORM_DATA);
        fetchWebsites();
      } else {
        toast.error(data.error || t("createFailed"));
      }
    } catch {
      toast.error(t("createFailed"));
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
        toast.success(website.is_active ? t("disabled") : t("enabled"));
        fetchWebsites();
      } else {
        toast.error(data.error || t("operationFailed"));
      }
    } catch {
      toast.error(t("operationFailed"));
    }
  }

  async function handleRegenerateSecret(
    website: ExternalWebsiteListItem,
  ): Promise<void> {
    if (!confirm(t("confirmRegenerateSecret"))) {
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
        toast.error(data.error || t("regenerateFailed"));
      }
    } catch {
      toast.error(t("regenerateFailed"));
    }
  }

  async function handleDelete(website: ExternalWebsiteListItem): Promise<void> {
    if (!confirm(t("confirmDelete", { name: website.website_name }))) {
      return;
    }

    try {
      const response = await fetch(`/api/websites/external/${website.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success(t("deleted"));
        fetchWebsites();
      } else {
        toast.error(data.error || t("deleteFailed"));
      }
    } catch {
      toast.error(t("deleteFailed"));
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
          <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">{t("pageDescription")}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("addWebsite")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <WebsiteTable
            websites={websites}
            loading={loading}
            onToggleActive={handleToggleActive}
            onRegenerateSecret={handleRegenerateSecret}
            onDelete={handleDelete}
            formatDate={formatDate}
            t={t}
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
        t={t}
        tCommon={tCommon}
      />

      {/* Secret 顯示對話框 */}
      <SecretDialog
        open={secretDialogOpen}
        onOpenChange={setSecretDialogOpen}
        secret={newSecret}
        onCopy={copyToClipboard}
        copied={copied}
        t={t}
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
  t: ReturnType<typeof useTranslations<"externalWebsites">>;
}

function WebsiteTable({
  websites,
  loading,
  onToggleActive,
  onRegenerateSecret,
  onDelete,
  formatDate,
  t,
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
        {t("noWebsites")}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("table.name")}</TableHead>
          <TableHead>{t("table.webhookUrl")}</TableHead>
          <TableHead>{t("table.status")}</TableHead>
          <TableHead>{t("table.lastSync")}</TableHead>
          <TableHead>{t("table.actions")}</TableHead>
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
                <SyncStatusBadge status={website.last_sync_status} t={t} />
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
                  title={t("regenerateSecret")}
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
  t,
}: {
  status: string | null;
  t: ReturnType<typeof useTranslations<"externalWebsites">>;
}): React.ReactElement | null {
  if (status === "success") {
    return <Badge variant="default">{t("status.success")}</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive">{t("status.failed")}</Badge>;
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
  t: ReturnType<typeof useTranslations<"externalWebsites">>;
  tCommon: ReturnType<typeof useTranslations<"common">>;
}

function CreateWebsiteDialog({
  open,
  onOpenChange,
  formData,
  onUpdateField,
  onSubmit,
  submitting,
  t,
  tCommon,
}: CreateWebsiteDialogProps): React.ReactElement {
  const syncSettings = [
    { key: "sync_on_publish" as const, labelKey: "syncSettings.syncOnPublish" },
    { key: "sync_on_update" as const, labelKey: "syncSettings.syncOnUpdate" },
    {
      key: "sync_on_unpublish" as const,
      labelKey: "syncSettings.syncOnUnpublish",
    },
    {
      key: "sync_translations" as const,
      labelKey: "syncSettings.syncTranslations",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription>{t("createDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("createDialog.name")} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onUpdateField("name", e.target.value)}
              placeholder={t("createDialog.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">{t("createDialog.slug")} *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) =>
                onUpdateField(
                  "slug",
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
              placeholder={t("createDialog.slugPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("createDialog.slugHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook_url">{t("createDialog.webhookUrl")} *</Label>
            <Input
              id="webhook_url"
              value={formData.webhook_url}
              onChange={(e) => onUpdateField("webhook_url", e.target.value)}
              placeholder="https://example.com/api/webhooks/1wayseo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("createDialog.description")}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => onUpdateField("description", e.target.value)}
              placeholder={tCommon("optional")}
            />
          </div>
          <div className="space-y-3">
            <Label>{t("syncSettingsTitle")}</Label>
            {syncSettings.map(({ key, labelKey }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{t(labelKey)}</span>
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
            {tCommon("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("create")}
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
  t: ReturnType<typeof useTranslations<"externalWebsites">>;
}

function SecretDialog({
  open,
  onOpenChange,
  secret,
  onCopy,
  copied,
  t,
}: SecretDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("secretDialog.title")}</DialogTitle>
          <DialogDescription>{t("secretDialog.description")}</DialogDescription>
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
            {t("secretDialog.envHint")}
          </p>
          <code className="block bg-muted p-2 rounded text-xs">
            ONEWAYSEO_WEBHOOK_SECRET={secret}
          </code>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t("secretDialog.saved")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
