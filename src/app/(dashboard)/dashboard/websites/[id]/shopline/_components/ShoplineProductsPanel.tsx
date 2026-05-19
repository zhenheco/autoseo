"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Save, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ShoplineProduct = {
  id: string;
  title: string;
  handle: string;
  seo?: {
    title?: string;
    description?: string;
  };
};

type ProductsResponse = {
  products?: ShoplineProduct[];
  nextCursor?: string;
};

type ShoplineProductsPanelProps = {
  websiteId: string;
};

export function ShoplineProductsPanel({
  websiteId,
}: ShoplineProductsPanelProps) {
  const t = useTranslations("shopline.seo");
  const saveErrorMessage = t("toast.saveError");
  const [products, setProducts] = useState<ShoplineProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [selectedProduct, setSelectedProduct] =
    useState<ShoplineProduct | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [handle, setHandle] = useState("");
  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
  const currentPageNumber = cursorStack.length;

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);

      try {
        const requestUrl =
          currentCursor === null
            ? `/api/shopline/${websiteId}/products`
            : `/api/shopline/${websiteId}/products?cursor=${encodeURIComponent(
                currentCursor,
              )}`;
        const response = await fetch(requestUrl);
        if (!response.ok) throw new Error("shopline_products_fetch_failed");

        const data = (await response.json()) as ProductsResponse;
        if (!cancelled) {
          setProducts(data.products ?? []);
          setNextCursor(data.nextCursor);
        }
      } catch {
        if (!cancelled) toast.error(saveErrorMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [currentCursor, saveErrorMessage, websiteId]);

  const selectedTitleLength = useMemo(() => seoTitle.length, [seoTitle]);
  const selectedDescriptionLength = useMemo(
    () => seoDescription.length,
    [seoDescription],
  );
  const isDescriptionTooLong = selectedDescriptionLength > 160;
  const isHandleChanged =
    selectedProduct !== null && handle !== selectedProduct.handle;

  function openEditor(product: ShoplineProduct) {
    setSelectedProduct(product);
    setSeoTitle(product.seo?.title ?? "");
    setSeoDescription(product.seo?.description ?? "");
    setHandle(product.handle);
  }

  function goToNextPage() {
    if (!nextCursor) return;
    setCursorStack((currentStack) => [...currentStack, nextCursor]);
  }

  function goToPreviousPage() {
    setCursorStack((currentStack) =>
      currentStack.length > 1 ? currentStack.slice(0, -1) : currentStack,
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct || isDescriptionTooLong) return;

    setSaving(true);

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/products/${selectedProduct.id}/seo`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seo: { title: seoTitle, description: seoDescription },
            handle,
          }),
        },
      );

      if (!response.ok) throw new Error("shopline_product_update_failed");

      const updatedProduct = (await response.json()) as ShoplineProduct;
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === updatedProduct.id ? updatedProduct : product,
        ),
      );
      setSelectedProduct(null);
      toast.success(t("toast.saveSuccess"));
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("products.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("products.empty")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("products.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.column.title")}</TableHead>
                <TableHead>{t("products.column.handle")}</TableHead>
                <TableHead>{t("products.column.seoTitle")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditor(product)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEditor(product);
                    }
                  }}
                >
                  <TableCell className="font-medium">{product.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.handle}
                  </TableCell>
                  <TableCell>
                    {product.seo?.title || t("products.column.notSet")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || cursorStack.length === 1}
            onClick={goToPreviousPage}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("pagination.prev")}
          </Button>
          <span
            className="min-w-8 text-center text-sm text-muted-foreground"
            aria-label={`Page ${currentPageNumber}`}
          >
            {currentPageNumber}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !nextCursor}
            onClick={goToNextPage}
          >
            {t("pagination.next")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      <Dialog
        open={selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("edit.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="shopline-seo-title">
                  {t("edit.seoTitleLabel")}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {t("edit.charCount", { count: selectedTitleLength })}
                </span>
              </div>
              <Input
                id="shopline-seo-title"
                value={seoTitle}
                maxLength={70}
                onChange={(event) => setSeoTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="shopline-seo-description">
                  {t("edit.seoDescriptionLabel")}
                </Label>
                <span
                  className={`text-xs ${
                    isDescriptionTooLong
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {selectedDescriptionLength}/160
                </span>
              </div>
              <Textarea
                id="shopline-seo-description"
                value={seoDescription}
                rows={4}
                aria-invalid={isDescriptionTooLong}
                onChange={(event) => setSeoDescription(event.target.value)}
              />
              {isDescriptionTooLong ? (
                <p className="text-sm text-destructive">
                  {t("edit.charLimitExceeded")}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopline-handle">{t("edit.handleLabel")}</Label>
              <Input
                id="shopline-handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
              />
            </div>
            {isHandleChanged ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {t("edit.handleChangeWarning")}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedProduct(null)}
              >
                <X className="h-4 w-4" />
                {t("edit.cancel")}
              </Button>
              <Button type="submit" disabled={saving || isDescriptionTooLong}>
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
