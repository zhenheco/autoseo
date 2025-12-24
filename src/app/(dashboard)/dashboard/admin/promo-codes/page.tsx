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
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PromoCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  bonusArticles: number;
  maxUses: number | null;
  currentUses: number;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdminPromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  // 對話框狀態
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<PromoCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 表單狀態
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    bonusArticles: "",
    maxUses: "",
    expiresAt: "",
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const res = await fetch("/api/admin/promo-codes");
      const data = await res.json();

      if (data.success) {
        setPromoCodes(data.data);
      } else {
        toast.error(data.error || "取得優惠碼列表失敗");
      }
    } catch {
      toast.error("取得優惠碼列表失敗");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      bonusArticles: "",
      maxUses: "",
      expiresAt: "",
    });
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name || !formData.bonusArticles) {
      toast.error("請填寫必要欄位");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          description: formData.description || undefined,
          bonusArticles: parseInt(formData.bonusArticles),
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
          expiresAt: formData.expiresAt || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("優惠碼建立成功");
        setCreateDialogOpen(false);
        resetForm();
        fetchPromoCodes();
      } else {
        toast.error(data.error || "建立優惠碼失敗");
      }
    } catch {
      toast.error("建立優惠碼失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedCode) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/promo-codes/${selectedCode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name || undefined,
          description: formData.description || undefined,
          bonusArticles: formData.bonusArticles
            ? parseInt(formData.bonusArticles)
            : undefined,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
          expiresAt: formData.expiresAt || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("優惠碼更新成功");
        setEditDialogOpen(false);
        resetForm();
        fetchPromoCodes();
      } else {
        toast.error(data.error || "更新優惠碼失敗");
      }
    } catch {
      toast.error("更新優惠碼失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (promoCode: PromoCode) => {
    if (!confirm(`確定要停用優惠碼「${promoCode.code}」嗎？`)) return;

    try {
      const res = await fetch(`/api/admin/promo-codes/${promoCode.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("優惠碼已停用");
        fetchPromoCodes();
      } else {
        toast.error(data.error || "停用優惠碼失敗");
      }
    } catch {
      toast.error("停用優惠碼失敗");
    }
  };

  const openEditDialog = (promoCode: PromoCode) => {
    setSelectedCode(promoCode);
    setFormData({
      code: promoCode.code,
      name: promoCode.name,
      description: promoCode.description || "",
      bonusArticles: promoCode.bonusArticles.toString(),
      maxUses: promoCode.maxUses?.toString() || "",
      expiresAt: promoCode.expiresAt
        ? new Date(promoCode.expiresAt).toISOString().split("T")[0]
        : "",
    });
    setEditDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("zh-TW");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">優惠碼管理</h1>
          <p className="text-muted-foreground">建立和管理優惠碼</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          建立優惠碼
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>優惠碼列表</CardTitle>
          <CardDescription>共 {promoCodes.length} 個優惠碼</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>優惠碼</TableHead>
                  <TableHead>名稱</TableHead>
                  <TableHead className="text-right">加送篇數</TableHead>
                  <TableHead className="text-right">使用次數</TableHead>
                  <TableHead>到期日</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-medium">
                      {code.code}
                    </TableCell>
                    <TableCell>{code.name}</TableCell>
                    <TableCell className="text-right">
                      +{code.bonusArticles} 篇
                    </TableCell>
                    <TableCell className="text-right">
                      {code.currentUses}
                      {code.maxUses && ` / ${code.maxUses}`}
                    </TableCell>
                    <TableCell>{formatDate(code.expiresAt)}</TableCell>
                    <TableCell>
                      {code.isActive ? (
                        <Badge variant="default">啟用中</Badge>
                      ) : (
                        <Badge variant="secondary">已停用</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(code)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {code.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(code)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 建立優惠碼對話框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>建立優惠碼</DialogTitle>
            <DialogDescription>
              建立新的優惠碼，每月可加送額外文章篇數
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">優惠碼 *</Label>
                <Input
                  id="code"
                  placeholder="例如：WELCOME2024"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">名稱 *</Label>
                <Input
                  id="name"
                  placeholder="例如：新用戶優惠"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述（選填）</Label>
              <Textarea
                id="description"
                placeholder="優惠碼描述..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bonusArticles">加送篇數 *</Label>
                <Input
                  id="bonusArticles"
                  type="number"
                  placeholder="例如：5"
                  value={formData.bonusArticles}
                  onChange={(e) =>
                    setFormData({ ...formData, bonusArticles: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">使用次數上限（選填）</Label>
                <Input
                  id="maxUses"
                  type="number"
                  placeholder="留空為無限制"
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">到期日（選填）</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                submitting ||
                !formData.code ||
                !formData.name ||
                !formData.bonusArticles
              }
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯優惠碼對話框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯優惠碼</DialogTitle>
            <DialogDescription>
              編輯優惠碼 {selectedCode?.code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">名稱</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">描述</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bonusArticles">加送篇數</Label>
                <Input
                  id="edit-bonusArticles"
                  type="number"
                  value={formData.bonusArticles}
                  onChange={(e) =>
                    setFormData({ ...formData, bonusArticles: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maxUses">使用次數上限</Label>
                <Input
                  id="edit-maxUses"
                  type="number"
                  placeholder="留空為無限制"
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-expiresAt">到期日</Label>
              <Input
                id="edit-expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
