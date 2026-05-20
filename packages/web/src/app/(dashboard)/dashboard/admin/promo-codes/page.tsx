"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Plus, Pencil, Trash2, Search } from "lucide-react";
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
  const t = useTranslations("admin.promoCodes");
  const tCommon = useTranslations("admin.common");
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [filteredPromoCodes, setFilteredPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  useEffect(() => {
    let result = promoCodes;

    // 搜尋過濾
    if (searchTerm) {
      result = result.filter(
        (code) =>
          code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          code.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // 狀態過濾
    if (statusFilter !== "all") {
      const isActiveFilter = statusFilter === "active";
      result = result.filter((code) => code.isActive === isActiveFilter);
    }

    setFilteredPromoCodes(result);
  }, [searchTerm, statusFilter, promoCodes]);

  const fetchPromoCodes = async () => {
    try {
      const res = await fetch("/api/admin/promo-codes");
      const data = await res.json();

      if (data.success) {
        setPromoCodes(data.data);
      } else {
        toast.error(data.error || t("loadFailed"));
      }
    } catch {
      toast.error(t("loadFailed"));
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
      toast.error(t("requiredFieldsError"));
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
        toast.success(t("createSuccess"));
        setCreateDialogOpen(false);
        resetForm();
        fetchPromoCodes();
      } else {
        toast.error(data.error || t("createFailed"));
      }
    } catch {
      toast.error(t("createFailed"));
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
        toast.success(t("updateSuccess"));
        setEditDialogOpen(false);
        resetForm();
        fetchPromoCodes();
      } else {
        toast.error(data.error || t("updateFailed"));
      }
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (promoCode: PromoCode) => {
    if (!confirm(t("confirmDeactivate", { code: promoCode.code }))) return;

    try {
      const res = await fetch(`/api/admin/promo-codes/${promoCode.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success(t("deactivateSuccess"));
        fetchPromoCodes();
      } else {
        toast.error(data.error || t("deactivateFailed"));
      }
    } catch {
      toast.error(t("deactivateFailed"));
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("createPromoCode")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription", { count: promoCodes.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 篩選區塊 */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder={t("filterStatusAll")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
                <SelectItem value="active">{t("filterStatusActive")}</SelectItem>
                <SelectItem value="inactive">{t("filterStatusInactive")}</SelectItem>
              </SelectContent>
            </Select>

            {(statusFilter !== "all" || searchTerm) && (
              <span className="text-sm text-muted-foreground">
                {filteredPromoCodes.length} / {promoCodes.length}
              </span>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">{t("columns.code")}</TableHead>
                  <TableHead>{t("columns.name")}</TableHead>
                  <TableHead className="w-[80px] text-right">{t("columns.bonus")}</TableHead>
                  <TableHead className="w-[90px] text-right">
                    {t("columns.usageCount")}
                  </TableHead>
                  <TableHead className="w-[100px]">{t("columns.expiresAt")}</TableHead>
                  <TableHead className="w-[70px]">{t("columns.status")}</TableHead>
                  <TableHead className="w-[80px] text-right">{t("columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromoCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-medium text-sm">
                      {code.code}
                    </TableCell>
                    <TableCell
                      className="truncate max-w-[150px]"
                      title={code.name}
                    >
                      {code.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      +{code.bonusArticles}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {code.currentUses}
                      {code.maxUses && `/${code.maxUses}`}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(code.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={code.isActive ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {code.isActive ? t("statusActive") : t("statusInactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={t("editButton")}
                          onClick={() => openEditDialog(code)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {code.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={t("deactivateButton")}
                            onClick={() => handleDeactivate(code)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
            <DialogTitle>{t("createDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("createDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">{t("form.codeRequired")}</Label>
                <Input
                  id="code"
                  placeholder={t("form.codePlaceholder")}
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
                <Label htmlFor="name">{t("form.nameRequired")}</Label>
                <Input
                  id="name"
                  placeholder={t("form.namePlaceholder")}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("form.descriptionOptional")}</Label>
              <Textarea
                id="description"
                placeholder={t("form.descriptionPlaceholder")}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bonusArticles">{t("form.bonusArticlesRequired")}</Label>
                <Input
                  id="bonusArticles"
                  type="number"
                  placeholder={t("form.bonusArticlesPlaceholder")}
                  value={formData.bonusArticles}
                  onChange={(e) =>
                    setFormData({ ...formData, bonusArticles: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">{t("form.maxUsesOptional")}</Label>
                <Input
                  id="maxUses"
                  type="number"
                  placeholder={t("form.maxUsesPlaceholder")}
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">{t("form.expiresAtOptional")}</Label>
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
              {tCommon("cancel")}
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
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯優惠碼對話框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("editDialogDescription", { code: selectedCode?.code ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("form.name")}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("form.description")}</Label>
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
                <Label htmlFor="edit-bonusArticles">{t("form.bonusArticles")}</Label>
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
                <Label htmlFor="edit-maxUses">{t("form.maxUses")}</Label>
                <Input
                  id="edit-maxUses"
                  type="number"
                  placeholder={t("form.maxUsesPlaceholder")}
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-expiresAt">{t("form.expiresAt")}</Label>
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
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
