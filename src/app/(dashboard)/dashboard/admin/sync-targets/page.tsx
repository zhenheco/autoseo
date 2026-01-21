"use client";

import { useState, useEffect } from "react";
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

interface SyncTarget {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  webhook_url: string;
  webhook_secret: string;
  sync_on_publish: boolean;
  sync_on_update: boolean;
  sync_on_unpublish: boolean;
  sync_translations: boolean;
  sync_languages: string[];
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
}

export default function AdminSyncTargetsPage() {
  const [targets, setTargets] = useState<SyncTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // 對話框狀態
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<SyncTarget | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // 表單狀態
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    webhook_url: "",
    sync_on_publish: true,
    sync_on_update: true,
    sync_on_unpublish: true,
    sync_translations: true,
  });

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      const response = await fetch("/api/admin/sync-targets");
      const data = await response.json();

      if (data.success) {
        setTargets(data.data);
      } else {
        toast.error(data.error || "無法載入同步目標");
      }
    } catch {
      toast.error("載入同步目標失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.slug || !formData.webhook_url) {
      toast.error("請填寫必填欄位");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/sync-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("同步目標已建立");
        setCreateDialogOpen(false);
        setNewSecret(data.data.webhook_secret);
        setSecretDialogOpen(true);
        resetForm();
        fetchTargets();
      } else {
        toast.error(data.error || "建立失敗");
      }
    } catch {
      toast.error("建立同步目標失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTarget) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/sync-targets/${selectedTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          webhook_url: formData.webhook_url,
          sync_on_publish: formData.sync_on_publish,
          sync_on_update: formData.sync_on_update,
          sync_on_unpublish: formData.sync_on_unpublish,
          sync_translations: formData.sync_translations,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("同步目標已更新");
        setEditDialogOpen(false);
        fetchTargets();
      } else {
        toast.error(data.error || "更新失敗");
      }
    } catch {
      toast.error("更新同步目標失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (target: SyncTarget) => {
    try {
      const response = await fetch(`/api/admin/sync-targets/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !target.is_active }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(target.is_active ? "已停用" : "已啟用");
        fetchTargets();
      } else {
        toast.error(data.error || "操作失敗");
      }
    } catch {
      toast.error("操作失敗");
    }
  };

  const handleRegenerateSecret = async (target: SyncTarget) => {
    if (!confirm("確定要重新生成 Webhook Secret？舊的 Secret 將立即失效。")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/sync-targets/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate_secret: true }),
      });

      const data = await response.json();

      if (data.success && data.new_webhook_secret) {
        setNewSecret(data.new_webhook_secret);
        setSecretDialogOpen(true);
        fetchTargets();
      } else {
        toast.error(data.error || "重新生成失敗");
      }
    } catch {
      toast.error("重新生成 Secret 失敗");
    }
  };

  const handleDelete = async (target: SyncTarget) => {
    if (!confirm(`確定要刪除「${target.name}」？此操作無法復原。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/sync-targets/${target.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("已刪除");
        fetchTargets();
      } else {
        toast.error(data.error || "刪除失敗");
      }
    } catch {
      toast.error("刪除失敗");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      webhook_url: "",
      sync_on_publish: true,
      sync_on_update: true,
      sync_on_unpublish: true,
      sync_translations: true,
    });
  };

  const openEditDialog = (target: SyncTarget) => {
    setSelectedTarget(target);
    setFormData({
      name: target.name,
      slug: target.slug,
      description: target.description || "",
      webhook_url: target.webhook_url,
      sync_on_publish: target.sync_on_publish,
      sync_on_update: target.sync_on_update,
      sync_on_unpublish: target.sync_on_unpublish,
      sync_translations: target.sync_translations,
    });
    setEditDialogOpen(true);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-TW");
  };

  // 同步設定切換元件
  const SyncSettingsToggles = () => (
    <div className="space-y-3">
      <Label>同步設定</Label>
      {[
        { key: "sync_on_publish" as const, label: "發布時同步" },
        { key: "sync_on_update" as const, label: "更新時同步" },
        { key: "sync_on_unpublish" as const, label: "取消發布時同步" },
        { key: "sync_translations" as const, label: "同步翻譯版本" },
      ].map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between">
          <span className="text-sm">{label}</span>
          <Switch
            checked={formData[key]}
            onCheckedChange={(checked) => setFormData({ ...formData, [key]: checked })}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">文章同步目標</h1>
          <p className="text-muted-foreground">
            管理需要同步文章的外部專案（如 onehand）
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增同步目標
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>同步目標列表</CardTitle>
          <CardDescription>
            文章發布後會自動同步到啟用的目標
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : targets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              尚未設定任何同步目標
            </div>
          ) : (
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
                {targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{target.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {target.slug}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                          {target.webhook_url}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => window.open(target.webhook_url, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={target.is_active}
                          onCheckedChange={() => handleToggleActive(target)}
                        />
                        {target.last_sync_status === "success" && (
                          <Badge variant="default">成功</Badge>
                        )}
                        {target.last_sync_status === "failed" && (
                          <Badge variant="destructive">失敗</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(target.last_synced_at)}
                      </div>
                      {target.last_sync_error && (
                        <div className="text-xs text-destructive truncate max-w-[150px]">
                          {target.last_sync_error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(target)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRegenerateSecret(target)}
                          title="重新生成 Secret"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(target)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 建立對話框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增同步目標</DialogTitle>
            <DialogDescription>
              設定要同步文章的外部專案
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">名稱 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="例如: onehand"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">識別碼 *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  })
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
                onChange={(e) =>
                  setFormData({ ...formData, webhook_url: e.target.value })
                }
                placeholder="https://example.com/api/webhooks/1wayseo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="選填"
              />
            </div>
            <SyncSettingsToggles />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯對話框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯同步目標</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">名稱</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>識別碼</Label>
              <Input value={formData.slug} disabled />
              <p className="text-xs text-muted-foreground">識別碼無法修改</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-webhook_url">Webhook URL</Label>
              <Input
                id="edit-webhook_url"
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">描述</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <SyncSettingsToggles />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret 顯示對話框 */}
      <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
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
                {newSecret}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(newSecret || "")}
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
              ONEWAYSEO_WEBHOOK_SECRET={newSecret}
            </code>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecretDialogOpen(false)}>
              我已保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
