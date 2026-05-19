"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Save, X } from "lucide-react";
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

type ShoplineCollection = {
  id: string;
  title: string;
  handle: string;
  products_count?: number;
  seo?: {
    title?: string;
    description?: string;
  };
};

type CollectionsResponse = {
  collections?: ShoplineCollection[];
  nextCursor?: string | null;
};

type ShoplineSaveErrorResponse = {
  error?: string;
  retryAfter?: number;
  reauthorize_url?: string;
};

type ShoplineCollectionsPanelProps = {
  websiteId: string;
};

export function ShoplineCollectionsPanel({
  websiteId,
}: ShoplineCollectionsPanelProps) {
  const t = useTranslations("shopline.seo");
  const saveErrorMessage = t("toast.saveError");
  const [collections, setCollections] = useState<ShoplineCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] =
    useState<ShoplineCollection | null>(null);
  const [scopeMissing, setScopeMissing] = useState<{
    reauthorizeUrl: string;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [handle, setHandle] = useState("");
  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
  const currentPageNumber = cursorStack.length;
  const selectedTitleLength = useMemo(() => seoTitle.length, [seoTitle]);
  const selectedDescriptionLength = useMemo(
    () => seoDescription.length,
    [seoDescription],
  );
  const isDescriptionTooLong = selectedDescriptionLength > 160;
  const isHandleChanged =
    selectedCollection !== null && handle !== selectedCollection.handle;

  useEffect(() => {
    let cancelled = false;

    async function loadCollections() {
      setLoading(true);

      try {
        const requestUrl =
          currentCursor === null
            ? `/api/shopline/${websiteId}/collections`
            : `/api/shopline/${websiteId}/collections?cursor=${encodeURIComponent(
                currentCursor,
              )}`;
        const response = await fetch(requestUrl);
        if (!response.ok) throw new Error("shopline_collections_fetch_failed");

        const data = (await response.json()) as CollectionsResponse;
        if (!cancelled) {
          setCollections(data.collections ?? []);
          setNextCursor(data.nextCursor ?? null);
        }
      } catch {
        if (!cancelled) toast.error(saveErrorMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCollections();

    return () => {
      cancelled = true;
    };
  }, [currentCursor, saveErrorMessage, websiteId]);

  function openEditor(collection: ShoplineCollection) {
    setSelectedCollection(collection);
    setScopeMissing(null);
    setTitle(collection.title);
    setSeoTitle(collection.seo?.title ?? "");
    setSeoDescription(collection.seo?.description ?? "");
    setHandle(collection.handle);
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
    if (!selectedCollection || isDescriptionTooLong) return;

    setSaving(true);
    setScopeMissing(null);

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/collections/${selectedCollection.id}/seo`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            seo: { title: seoTitle, description: seoDescription },
            handle,
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await readShoplineSaveError(response);

        if (
          errorBody.error === "shopline_scope_missing" &&
          errorBody.reauthorize_url
        ) {
          setScopeMissing({ reauthorizeUrl: errorBody.reauthorize_url });
          return;
        }

        if (errorBody.error === "shopline_rate_limited") {
          toast.error(
            t("error.rateLimited", {
              seconds: errorBody.retryAfter ?? 60,
            }),
          );
          return;
        }

        throw new Error("shopline_collection_update_failed");
      }

      const updatedCollection = (await response.json()) as ShoplineCollection;
      setCollections((currentCollections) =>
        currentCollections.map((collection) =>
          collection.id === updatedCollection.id
            ? updatedCollection
            : collection,
        ),
      );
      setSelectedCollection(null);
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
        <CardTitle>{t("collections.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("collections.empty")}
          </p>
        ) : collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("collections.empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("collections.column.title")}</TableHead>
                <TableHead>{t("collections.column.handle")}</TableHead>
                <TableHead>{t("collections.column.seoTitle")}</TableHead>
                <TableHead>{t("collections.column.productsCount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((collection) => (
                <TableRow
                  key={collection.id}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditor(collection)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEditor(collection);
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {collection.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {collection.handle}
                  </TableCell>
                  <TableCell>
                    {collection.seo?.title || t("products.column.notSet")}
                  </TableCell>
                  <TableCell>{collection.products_count ?? 0}</TableCell>
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
        open={selectedCollection !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCollection(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("edit.collection.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {scopeMissing ? (
              <div
                role="alert"
                className="flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
              >
                <div className="space-y-1">
                  <p className="font-medium">{t("error.scopeMissing.title")}</p>
                  <p>{t("error.scopeMissing.description")}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    window.location.assign(scopeMissing.reauthorizeUrl);
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("error.scopeMissing.reauthorize")}
                </Button>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="shopline-collection-title">
                {t("edit.collection.titleLabel")}
              </Label>
              <Input
                id="shopline-collection-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="shopline-collection-seo-title">
                  {t("edit.collection.seoTitleLabel")}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {t("edit.charCount", { count: selectedTitleLength })}
                </span>
              </div>
              <Input
                id="shopline-collection-seo-title"
                value={seoTitle}
                maxLength={70}
                onChange={(event) => setSeoTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="shopline-collection-seo-description">
                  {t("edit.collection.seoDescriptionLabel")}
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
                id="shopline-collection-seo-description"
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
              <Label htmlFor="shopline-collection-handle">
                {t("edit.collection.handleLabel")}
              </Label>
              <Input
                id="shopline-collection-handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
              />
            </div>
            {isHandleChanged ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {t("edit.collection.handleChangeWarning")}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedCollection(null)}
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

async function readShoplineSaveError(
  response: Response,
): Promise<ShoplineSaveErrorResponse> {
  try {
    const body = (await response.json()) as unknown;
    if (typeof body === "object" && body !== null) {
      return body as ShoplineSaveErrorResponse;
    }
  } catch {
    return {};
  }

  return {};
}
