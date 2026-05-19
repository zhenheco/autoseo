"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  ListTree,
  RefreshCw,
  Save,
  TableProperties,
  X,
} from "lucide-react";
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
import { renderSeoTemplate } from "@/lib/shopline/seo-template";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getSeoFilterOptions,
  normalizeShoplineSeoFilter,
  readShoplineSeoFilterFromUrl,
  SHOPLINE_SEO_FILTER_EVENT,
  updateShoplineSeoFilterUrl,
  type ShoplineSeoFilter,
} from "./seo-filter-events";

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

type CollectionHierarchyItem = {
  collection_id: string;
  parent_collection_id?: string | null;
  display_order?: number | null;
};

type CollectionHierarchyResponse = {
  hierarchy?: CollectionHierarchyItem[];
};

type ShoplineShopMeta = {
  seo_title_template?: string | null;
};

type CollectionProduct = {
  id: string;
  title: string;
  handle?: string;
  position?: number | null;
};

type CollectionProductsResponse = {
  products?: CollectionProduct[];
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
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [hierarchy, setHierarchy] = useState<CollectionHierarchyItem[]>([]);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] =
    useState<ShoplineCollection | null>(null);
  const [editMode, setEditMode] = useState<"seo" | "products">("seo");
  const [collectionProducts, setCollectionProducts] = useState<
    CollectionProduct[]
  >([]);
  const [productPositions, setProductPositions] = useState<
    Record<string, string>
  >({});
  const [productsLoading, setProductsLoading] = useState(false);
  const [movingCollection, setMovingCollection] =
    useState<ShoplineCollection | null>(null);
  const [moveParentId, setMoveParentId] = useState("");
  const [moveDisplayOrder, setMoveDisplayOrder] = useState("0");
  const [scopeMissing, setScopeMissing] = useState<{
    reauthorizeUrl: string;
  } | null>(null);
  const [shopMeta, setShopMeta] = useState<ShoplineShopMeta | null>(null);
  const [title, setTitle] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [handle, setHandle] = useState("");
  const [seoFilter, setSeoFilter] = useState<ShoplineSeoFilter | "">(() =>
    readShoplineSeoFilterFromUrl("collection"),
  );
  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
  const currentPageNumber = cursorStack.length;
  const selectedCollectionTitleLength = useMemo(() => title.length, [title]);
  const selectedTitleLength = useMemo(() => seoTitle.length, [seoTitle]);
  const selectedDescriptionLength = useMemo(
    () => seoDescription.length,
    [seoDescription],
  );
  const titleTemplatePreview = useMemo(() => {
    if (!selectedCollection || !shopMeta?.seo_title_template) return "";

    return renderSeoTemplate(shopMeta.seo_title_template, {
      collection: { title: selectedCollection.title },
    });
  }, [selectedCollection, shopMeta]);
  const isDescriptionTooLong = selectedDescriptionLength > 160;
  const isHandleChanged =
    selectedCollection !== null && handle !== selectedCollection.handle;
  const treeRows = useMemo(
    () => buildCollectionTreeRows(collections, hierarchy),
    [collections, hierarchy],
  );
  const filterOptions = getSeoFilterOptions("collection");
  const activeFilterLabel = seoFilter ? getSeoFilterLabel(t, seoFilter) : "";

  const loadCollections = useCallback(async () => {
    setLoading(true);

    try {
      const requestUrl = buildShoplineListUrl(
        `/api/shopline/${websiteId}/collections`,
        currentCursor,
        seoFilter,
      );
      const response = await fetch(requestUrl);
      if (!response.ok) throw new Error("shopline_collections_fetch_failed");

      const data = (await response.json()) as CollectionsResponse;
      setCollections(data.collections ?? []);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      toast.error(saveErrorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentCursor, saveErrorMessage, seoFilter, websiteId]);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    function handleSeoFilterChange(event: Event) {
      const nextFilter = normalizeShoplineSeoFilter(
        (event as CustomEvent<{ filter?: string }>).detail?.filter,
        "collection",
      );

      setSeoFilter(nextFilter);
      setCursorStack([null]);
    }

    window.addEventListener(SHOPLINE_SEO_FILTER_EVENT, handleSeoFilterChange);

    return () => {
      window.removeEventListener(
        SHOPLINE_SEO_FILTER_EVENT,
        handleSeoFilterChange,
      );
    };
  }, []);

  const loadHierarchy = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/collections/hierarchy`,
      );
      if (!response.ok) throw new Error("shopline_hierarchy_fetch_failed");

      const data = (await response.json()) as CollectionHierarchyResponse;
      setHierarchy(data.hierarchy ?? []);
    } catch {
      toast.error(saveErrorMessage);
    }
  }, [saveErrorMessage, websiteId]);

  useEffect(() => {
    if (viewMode === "tree") {
      void loadHierarchy();
    }
  }, [loadHierarchy, viewMode]);

  function openEditor(collection: ShoplineCollection) {
    setSelectedCollection(collection);
    setEditMode("seo");
    setCollectionProducts([]);
    setProductPositions({});
    setScopeMissing(null);
    setTitle(collection.title);
    setSeoTitle(collection.seo?.title ?? "");
    setSeoDescription(collection.seo?.description ?? "");
    setHandle(collection.handle);

    if (collection.seo && !collection.seo.title) {
      void loadShopMeta();
    }
  }

  async function loadShopMeta() {
    if (shopMeta) return;

    try {
      const response = await fetch(`/api/shopline/${websiteId}/shop-meta`);
      if (!response.ok) throw new Error("shopline_shop_meta_fetch_failed");

      setShopMeta((await response.json()) as ShoplineShopMeta);
    } catch {
      toast.error(saveErrorMessage);
    }
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

  function handleFilterChange(filter: ShoplineSeoFilter | "") {
    setSeoFilter(filter);
    setCursorStack([null]);
    updateShoplineSeoFilterUrl(filter);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editMode === "products") {
      await submitProductOrder();
      return;
    }

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

      await response.json();
      await loadCollections();
      setSelectedCollection(null);
      toast.success(t("toast.saveSuccess"));
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function loadCollectionProducts(collection: ShoplineCollection) {
    setProductsLoading(true);
    setEditMode("products");

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/collections/${collection.id}/products`,
      );
      if (!response.ok) throw new Error("shopline_collection_products_failed");

      const data = (await response.json()) as CollectionProductsResponse;
      const products = data.products ?? [];
      setCollectionProducts(products);
      setProductPositions(
        Object.fromEntries(
          products.map((product, index) => [
            product.id,
            String(product.position ?? index + 1),
          ]),
        ),
      );
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setProductsLoading(false);
    }
  }

  async function submitProductOrder() {
    if (!selectedCollection) return;

    setSaving(true);

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/collections/${selectedCollection.id}/products/order`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order: collectionProducts.map((product, index) => ({
              productId: product.id,
              position: Number(productPositions[product.id] ?? index + 1),
            })),
          }),
        },
      );

      if (!response.ok) throw new Error("shopline_product_order_failed");

      await response.json();
      setSelectedCollection(null);
      toast.success(t("toast.saveSuccess"));
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function openMoveModal(collection: ShoplineCollection) {
    const hierarchyItem = hierarchy.find(
      (item) => item.collection_id === collection.id,
    );
    setMovingCollection(collection);
    setMoveParentId(hierarchyItem?.parent_collection_id ?? "");
    setMoveDisplayOrder(String(hierarchyItem?.display_order ?? 0));
  }

  async function handleMoveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movingCollection) return;

    setSaving(true);

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/collections/${movingCollection.id}/hierarchy`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentCollectionId: moveParentId === "" ? null : moveParentId,
            displayOrder: Number(moveDisplayOrder),
          }),
        },
      );

      if (!response.ok) throw new Error("shopline_hierarchy_update_failed");

      await response.json();
      await loadHierarchy();
      setMovingCollection(null);
      toast.success(t("toast.saveSuccess"));
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{t("collections.title")}</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setViewMode((currentMode) =>
              currentMode === "list" ? "tree" : "list",
            )
          }
        >
          {viewMode === "list" ? (
            <ListTree className="h-4 w-4" />
          ) : (
            <TableProperties className="h-4 w-4" />
          )}
          {viewMode === "list"
            ? t("collections.view.tree")
            : t("collections.view.list")}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="shopline-collections-filter">
              {t("filter.label")}
            </Label>
            <select
              id="shopline-collections-filter"
              className="flex h-9 w-full min-w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={seoFilter}
              onChange={(event) =>
                handleFilterChange(event.target.value as ShoplineSeoFilter | "")
              }
            >
              <option value="">{t("filter.all")}</option>
              {filterOptions.map((filter) => (
                <option key={filter} value={filter}>
                  {getSeoFilterLabel(t, filter)}
                </option>
              ))}
            </select>
          </div>
          {seoFilter ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {t("filter.count", {
                  filter: activeFilterLabel,
                  count: collections.length,
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleFilterChange("")}
              >
                {t("filter.clear")}
              </Button>
            </div>
          ) : null}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("collections.empty")}
          </p>
        ) : collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("collections.empty")}
          </p>
        ) : viewMode === "tree" ? (
          <div className="space-y-2">
            {treeRows.map(({ collection, depth }) => (
              <div
                key={collection.id}
                className="flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                style={{ paddingLeft: `${12 + depth * 24}px` }}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium"
                  onClick={() => openEditor(collection)}
                >
                  {collection.title}
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openMoveModal(collection)}
                >
                  {t("collections.hierarchy.move")}
                </Button>
              </div>
            ))}
          </div>
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
              {editMode === "seo" && selectedCollection ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => loadCollectionProducts(selectedCollection)}
                >
                  {t("collections.products.reorder")}
                </Button>
              ) : null}
              {editMode === "products" ? (
                <div className="space-y-3">
                  {productsLoading ? (
                    <p className="text-sm text-muted-foreground">
                      {t("edit.categories.loading")}
                    </p>
                  ) : (
                    collectionProducts.map((product) => (
                      <div
                        key={product.id}
                        className="grid grid-cols-[1fr_7rem] items-end gap-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {product.title}
                          </p>
                          {product.handle ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {product.handle}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`collection-product-${product.id}`}>
                            {`${t("collections.products.position")} ${product.title}`}
                          </Label>
                          <Input
                            id={`collection-product-${product.id}`}
                            type="number"
                            min={1}
                            value={productPositions[product.id] ?? ""}
                            onChange={(event) =>
                              setProductPositions((currentPositions) => ({
                                ...currentPositions,
                                [product.id]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor="shopline-collection-title">
                        {t("edit.collection.titleLabel")}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {t("edit.charCount", {
                          count: selectedCollectionTitleLength,
                        })}
                      </span>
                    </div>
                    <Input
                      id="shopline-collection-title"
                      value={title}
                      maxLength={70}
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
                      placeholder={titleTemplatePreview || undefined}
                      maxLength={70}
                      onChange={(event) => setSeoTitle(event.target.value)}
                    />
                    {titleTemplatePreview ? (
                      <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="truncate text-muted-foreground">
                          {t("edit.templatePreview", {
                            preview: titleTemplatePreview,
                          })}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSeoTitle(titleTemplatePreview)}
                        >
                          {t("edit.applyTemplate")}
                        </Button>
                      </div>
                    ) : null}
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
                      onChange={(event) =>
                        setSeoDescription(event.target.value)
                      }
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
                      {t("redirects.warning.autoCreated")}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedCollection(null)}
              >
                <X className="h-4 w-4" />
                {t("edit.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  (editMode === "seo" && isDescriptionTooLong) ||
                  (editMode === "products" && productsLoading)
                }
              >
                <Save className="h-4 w-4" />
                {t("edit.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={movingCollection !== null}
        onOpenChange={(open) => {
          if (!open) setMovingCollection(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("collections.hierarchy.move")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMoveSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopline-collection-parent">
                {t("collections.hierarchy.parent")}
              </Label>
              <select
                id="shopline-collection-parent"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={moveParentId}
                onChange={(event) => setMoveParentId(event.target.value)}
              >
                <option value="">{t("collections.hierarchy.noParent")}</option>
                {collections
                  .filter(
                    (collection) => collection.id !== movingCollection?.id,
                  )
                  .map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopline-collection-display-order">
                {t("collections.hierarchy.displayOrder")}
              </Label>
              <Input
                id="shopline-collection-display-order"
                type="number"
                value={moveDisplayOrder}
                onChange={(event) => setMoveDisplayOrder(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMovingCollection(null)}
              >
                <X className="h-4 w-4" />
                {t("edit.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
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

function buildCollectionTreeRows(
  collections: ShoplineCollection[],
  hierarchy: CollectionHierarchyItem[],
): { collection: ShoplineCollection; depth: number }[] {
  const hierarchyById = new Map(
    hierarchy.map((item) => [item.collection_id, item]),
  );
  const collectionsById = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const collectionIndexById = new Map(
    collections.map((collection, index) => [collection.id, index]),
  );
  const childrenByParentId = new Map<string | null, ShoplineCollection[]>();

  for (const collection of collections) {
    const hierarchyItem = hierarchyById.get(collection.id);
    const parentId =
      hierarchyItem?.parent_collection_id &&
      collectionsById.has(hierarchyItem.parent_collection_id)
        ? hierarchyItem.parent_collection_id
        : null;
    const children = childrenByParentId.get(parentId) ?? [];
    children.push(collection);
    childrenByParentId.set(parentId, children);
  }

  for (const children of childrenByParentId.values()) {
    children.sort((left, right) => {
      const leftOrder = hierarchyById.get(left.id)?.display_order ?? 0;
      const rightOrder = hierarchyById.get(right.id)?.display_order ?? 0;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return (
        (collectionIndexById.get(left.id) ?? 0) -
        (collectionIndexById.get(right.id) ?? 0)
      );
    });
  }

  const rows: { collection: ShoplineCollection; depth: number }[] = [];
  const visited = new Set<string>();

  function appendRows(parentId: string | null, depth: number) {
    for (const collection of childrenByParentId.get(parentId) ?? []) {
      if (visited.has(collection.id)) continue;
      visited.add(collection.id);
      rows.push({ collection, depth });
      appendRows(collection.id, depth + 1);
    }
  }

  appendRows(null, 0);

  for (const collection of collections) {
    if (!visited.has(collection.id)) {
      rows.push({ collection, depth: 0 });
    }
  }

  return rows;
}

function buildShoplineListUrl(
  basePath: string,
  cursor: string | null,
  filter: ShoplineSeoFilter | "",
): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (filter) params.set("filter", filter);

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function getSeoFilterLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  filter: ShoplineSeoFilter,
): string {
  const keys: Record<ShoplineSeoFilter, string> = {
    "missing-seo": "health.flag.missingSeoTitle",
    "missing-alt": "health.flag.missingAlt",
    "title-too-long": "health.flag.seoTitleTooLong",
    "description-too-long": "health.flag.seoDescriptionTooLong",
    "duplicate-title": "health.flag.duplicateTitle",
  };

  return t(keys[filter]);
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
