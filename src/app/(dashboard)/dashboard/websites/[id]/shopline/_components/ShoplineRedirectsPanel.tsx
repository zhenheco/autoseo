"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ShoplineRedirectEntityType = "product" | "collection" | "page";

type ShoplineRedirect = {
  id: string;
  entity_type: ShoplineRedirectEntityType;
  entity_id?: string | null;
  handle_from: string;
  handle_to: string;
  created_at: string;
  last_hit_at?: string | null;
  hit_count: number;
};

type RedirectsResponse = {
  redirects?: ShoplineRedirect[];
};

type ShoplineRedirectsPanelProps = {
  websiteId: string;
};

export function ShoplineRedirectsPanel({
  websiteId,
}: ShoplineRedirectsPanelProps) {
  const t = useTranslations("shopline.seo");
  const saveErrorMessage = t("toast.saveError");
  const [redirects, setRedirects] = useState<ShoplineRedirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [entityType, setEntityType] =
    useState<ShoplineRedirectEntityType>("product");
  const [handleFrom, setHandleFrom] = useState("");
  const [handleTo, setHandleTo] = useState("");

  const loadRedirects = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/shopline/${websiteId}/redirects`);
      if (!response.ok) throw new Error("shopline_redirects_fetch_failed");

      const data = (await response.json()) as RedirectsResponse;
      setRedirects(data.redirects ?? []);
    } catch {
      toast.error(saveErrorMessage);
    } finally {
      setLoading(false);
    }
  }, [saveErrorMessage, websiteId]);

  useEffect(() => {
    void loadRedirects();
  }, [loadRedirects]);

  function resetAddForm() {
    setEntityType("product");
    setHandleFrom("");
    setHandleTo("");
  }

  async function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!handleFrom || !handleTo) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/shopline/${websiteId}/redirects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          handleFrom,
          handleTo,
        }),
      });

      if (!response.ok) throw new Error("shopline_redirect_create_failed");

      await loadRedirects();
      setAddOpen(false);
      resetAddForm();
      toast.success(t("toast.saveSuccess"));
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(redirectId: string) {
    setSaving(true);

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/redirects/${redirectId}`,
        { method: "DELETE" },
      );

      if (!response.ok) throw new Error("shopline_redirect_delete_failed");

      await loadRedirects();
      toast.success(t("toast.saveSuccess"));
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t("redirects.title")}</CardTitle>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            resetAddForm();
            setAddOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t("redirects.add")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("redirects.warning.autoCreated")}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("redirects.empty")}
          </p>
        ) : redirects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("redirects.empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("redirects.column.entityType")}</TableHead>
                <TableHead>{t("redirects.column.handleFrom")}</TableHead>
                <TableHead>{t("redirects.column.handleTo")}</TableHead>
                <TableHead>{t("redirects.column.createdAt")}</TableHead>
                <TableHead>{t("redirects.column.hitCount")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {redirects.map((redirect) => (
                <TableRow key={redirect.id}>
                  <TableCell>
                    {t(`redirects.entityType.${redirect.entity_type}`)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {redirect.handle_from}
                  </TableCell>
                  <TableCell>{redirect.handle_to}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(redirect.created_at)}
                  </TableCell>
                  <TableCell>{redirect.hit_count}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        void handleDelete(redirect.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("redirects.delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("redirects.add")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopline-redirect-entity-type">
                {t("redirects.column.entityType")}
              </Label>
              <select
                id="shopline-redirect-entity-type"
                value={entityType}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) =>
                  setEntityType(
                    event.target.value as ShoplineRedirectEntityType,
                  )
                }
              >
                <option value="product">
                  {t("redirects.entityType.product")}
                </option>
                <option value="collection">
                  {t("redirects.entityType.collection")}
                </option>
                <option value="page">{t("redirects.entityType.page")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopline-redirect-handle-from">
                {t("redirects.column.handleFrom")}
              </Label>
              <Input
                id="shopline-redirect-handle-from"
                value={handleFrom}
                onChange={(event) => setHandleFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopline-redirect-handle-to">
                {t("redirects.column.handleTo")}
              </Label>
              <Input
                id="shopline-redirect-handle-to"
                value={handleTo}
                onChange={(event) => setHandleTo(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                <X className="h-4 w-4" />
                {t("edit.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving || !handleFrom || !handleTo}
              >
                <Save className="h-4 w-4" />
                {t("edit.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
