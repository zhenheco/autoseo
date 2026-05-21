"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Checkbox } from "@shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { renderSeoTemplate } from "@/lib/shopline/seo-template";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/ui/table";
import {
  getSeoFilterOptions,
  normalizeShoplineSeoFilter,
  readShoplineSeoFilterFromUrl,
  SHOPLINE_SEO_FILTER_EVENT,
  updateShoplineSeoFilterUrl,
  type ShoplineSeoFilter,
} from "./seo-filter-events";

type ShoplineProduct = {
  id: string;
  title: string;
  handle: string;
  product_type?: string;
  vendor?: string;
  images?: ShoplineProductImage[];
  seo?: {
    title?: string;
    description?: string;
  };
};

type ShoplineProductImage = {
  id: string;
  src: string;
  alt?: string | null;
  position?: number;
};

type ProductsResponse = {
  products?: ShoplineProduct[];
  nextCursor?: string;
};

type ShoplineCollection = {
  id: string;
  title: string;
  handle: string;
  seo?: {
    title?: string;
    description?: string;
  };
};

type CollectionsResponse = {
  collections?: ShoplineCollection[];
  nextCursor?: string | null;
};

type ProductCollect = {
  id: string;
  collection_id: string;
  product_id: string;
};

type ProductCollectsResponse = {
  collects?: ProductCollect[];
};

type ShoplineShopMeta = {
  seo_title_template?: string | null;
};

type CategoryMutationResultItem = {
  collection_id: string;
  success: boolean;
  error?: string;
};

type CategoryMutationResponse = {
  added: CategoryMutationResultItem[];
  removed: CategoryMutationResultItem[];
};

type ShoplineSaveErrorResponse = {
  error?: string;
  retryAfter?: number;
  reauthorize_url?: string;
};

type ShoplineAiSeoDraftResponse = {
  drafts?: {
    seoTitle?: string;
    seoDescription?: string;
  };
  model?: string;
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
  const [scopeMissing, setScopeMissing] = useState<{
    reauthorizeUrl: string;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [handle, setHandle] = useState("");
  const [aiSeoGenerating, setAiSeoGenerating] = useState(false);
  const [aiSeoModel, setAiSeoModel] = useState<string | null>(null);
  const [imageAlts, setImageAlts] = useState<Record<string, string>>({});
  const [shopMeta, setShopMeta] = useState<ShoplineShopMeta | null>(null);
  const [savingImageId, setSavingImageId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState("seo-meta");
  const [currentCollects, setCurrentCollects] = useState<ProductCollect[]>([]);
  const [availableCollections, setAvailableCollections] = useState<
    ShoplineCollection[]
  >([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<
    Set<string>
  >(new Set());
  const [loadingCollects, setLoadingCollects] = useState(false);
  const [categoryAddInput, setCategoryAddInput] = useState("");
  const [categoryRemoveInput, setCategoryRemoveInput] = useState("");
  const [categoryResult, setCategoryResult] =
    useState<CategoryMutationResponse | null>(null);
  const [seoFilter, setSeoFilter] = useState<ShoplineSeoFilter | "">(() =>
    readShoplineSeoFilterFromUrl("product"),
  );
  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
  const currentPageNumber = cursorStack.length;
  const selectedProductTitleLength = useMemo(() => title.length, [title]);
  const filterOptions = getSeoFilterOptions("product");
  const activeFilterLabel = seoFilter ? getSeoFilterLabel(t, seoFilter) : "";

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);

      try {
        const requestUrl = buildShoplineListUrl(
          `/api/shopline/${websiteId}/products`,
          currentCursor,
          seoFilter,
        );
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
  }, [currentCursor, saveErrorMessage, seoFilter, websiteId]);

  useEffect(() => {
    function handleSeoFilterChange(event: Event) {
      const nextFilter = normalizeShoplineSeoFilter(
        (event as CustomEvent<{ filter?: string }>).detail?.filter,
        "product",
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

  useEffect(() => {
    if (!selectedProduct || editTab !== "categories") return;

    let cancelled = false;
    const selectedProductId = selectedProduct.id;

    async function loadCategoryData() {
      setLoadingCollects(true);

      try {
        const collections = await fetchAllCollections(websiteId);
        if (cancelled) return;
        setAvailableCollections(collections);

        const response = await fetch(
          `/api/shopline/${websiteId}/products/${selectedProductId}/collects`,
        );
        if (!response.ok) throw new Error("shopline_product_collects_failed");

        const data = (await response.json()) as ProductCollectsResponse;
        if (!cancelled) {
          const collects = data.collects ?? [];
          setCurrentCollects(collects);
          setSelectedCollectionIds(
            new Set(collects.map((collect) => collect.collection_id)),
          );
        }
      } catch {
        if (!cancelled) toast.error(saveErrorMessage);
      } finally {
        if (!cancelled) setLoadingCollects(false);
      }
    }

    void loadCategoryData();

    return () => {
      cancelled = true;
    };
  }, [editTab, saveErrorMessage, selectedProduct, websiteId]);

  const selectedTitleLength = useMemo(() => seoTitle.length, [seoTitle]);
  const selectedDescriptionLength = useMemo(
    () => seoDescription.length,
    [seoDescription],
  );
  const titleTemplatePreview = useMemo(() => {
    if (!selectedProduct || !shopMeta?.seo_title_template) return "";

    return renderSeoTemplate(shopMeta.seo_title_template, {
      product: {
        title: selectedProduct.title,
        vendor: selectedProduct.vendor,
        type: selectedProduct.product_type,
      },
    });
  }, [selectedProduct, shopMeta]);
  const isDescriptionTooLong = selectedDescriptionLength > 160;
  const isHandleChanged =
    selectedProduct !== null && handle !== selectedProduct.handle;

  function openEditor(product: ShoplineProduct) {
    setSelectedProduct(product);
    setScopeMissing(null);
    setTitle(product.title);
    setSeoTitle(product.seo?.title ?? "");
    setSeoDescription(product.seo?.description ?? "");
    setHandle(product.handle);
    setAiSeoModel(null);
    setAiSeoGenerating(false);
    setEditTab("seo-meta");
    setCurrentCollects([]);
    setAvailableCollections([]);
    setSelectedCollectionIds(new Set());
    setCategoryAddInput("");
    setCategoryRemoveInput("");
    setCategoryResult(null);
    setImageAlts(
      Object.fromEntries(
        (product.images ?? []).map((image) => [image.id, image.alt ?? ""]),
      ),
    );

    if (product.seo && !product.seo.title) {
      window.setTimeout(() => {
        void loadShopMeta();
      }, 0);
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
    if (!selectedProduct || isDescriptionTooLong) return;

    setSaving(true);
    setScopeMissing(null);

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/products/${selectedProduct.id}/seo`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seo: { title: seoTitle, description: seoDescription },
            handle,
            title,
            ...(aiSeoModel ? { source: "ai" as const, model: aiSeoModel } : {}),
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

        throw new Error("shopline_product_update_failed");
      }

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

  async function handleAiSeoDraftGenerate() {
    if (!selectedProduct) return;

    setAiSeoGenerating(true);

    try {
      const response = await fetch(`/api/shopline/${websiteId}/ai-seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "product",
          entityId: selectedProduct.id,
          fields: ["seoTitle", "seoDescription"],
        }),
      });

      if (!response.ok) {
        const errorBody = await readShoplineSaveError(response);
        throw new Error(errorBody.error ?? "shopline_ai_seo_failed");
      }

      const data = (await response.json()) as ShoplineAiSeoDraftResponse;
      if (typeof data.drafts?.seoTitle === "string") {
        setSeoTitle(data.drafts.seoTitle);
      }
      if (typeof data.drafts?.seoDescription === "string") {
        setSeoDescription(data.drafts.seoDescription);
      }
      setAiSeoModel(data.model ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "shopline_ai_seo_failed";
      toast.error(t("ai.generate.error", { error: message }));
    } finally {
      setAiSeoGenerating(false);
    }
  }

  async function handleImageAltSave(image: ShoplineProductImage) {
    if (!selectedProduct) return;

    setSavingImageId(image.id);
    setScopeMissing(null);

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/products/${selectedProduct.id}/images/${image.id}/alt`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alt: imageAlts[image.id] ?? "" }),
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

        throw new Error("shopline_image_alt_update_failed");
      }

      const updatedImage = (await response.json()) as ShoplineProductImage;
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === selectedProduct.id
            ? updateProductImage(product, updatedImage)
            : product,
        ),
      );
      setSelectedProduct((currentProduct) =>
        currentProduct
          ? updateProductImage(currentProduct, updatedImage)
          : null,
      );
      setImageAlts((currentAlts) => ({
        ...currentAlts,
        [updatedImage.id]: updatedImage.alt ?? "",
      }));
      toast.success(t("toast.saveSuccess"));
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setSavingImageId(null);
    }
  }

  async function handleCategorySubmit() {
    if (!selectedProduct) return;

    const currentCollectionIds = new Set(
      currentCollects.map((collect) => collect.collection_id),
    );
    const add = uniqueValues([
      ...Array.from(selectedCollectionIds).filter(
        (collectionId) => !currentCollectionIds.has(collectionId),
      ),
      ...parseCollectionIds(categoryAddInput),
    ]);
    const remove = uniqueValues([
      ...Array.from(currentCollectionIds).filter(
        (collectionId) => !selectedCollectionIds.has(collectionId),
      ),
      ...parseCollectionIds(categoryRemoveInput),
    ]);

    setSaving(true);
    setScopeMissing(null);

    try {
      const response = await fetch(
        `/api/shopline/${websiteId}/products/${selectedProduct.id}/categories`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ add, remove }),
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

        throw new Error("shopline_product_categories_update_failed");
      }

      const result = (await response.json()) as CategoryMutationResponse;
      setCategoryResult(result);
      setCurrentCollects((collects) =>
        applyCategoryResultToCollects(collects, selectedProduct.id, result),
      );
      setCategoryAddInput("");
      setCategoryRemoveInput("");
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="shopline-products-filter">
              {t("filter.label")}
            </Label>
            <select
              id="shopline-products-filter"
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
                  count: products.length,
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
        <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("edit.title")}</DialogTitle>
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
            <Tabs
              value={editTab}
              onValueChange={setEditTab}
              className="space-y-4"
            >
              <TabsList>
                <TabsTrigger
                  value="seo-meta"
                  onClick={() => setEditTab("seo-meta")}
                >
                  {t("edit.tabs.seoMeta")}
                </TabsTrigger>
                <TabsTrigger
                  value="images"
                  onClick={() => setEditTab("images")}
                >
                  {t("edit.tabs.images")}
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  onClick={() => setEditTab("categories")}
                >
                  {t("edit.tabs.categories")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="seo-meta" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="shopline-product-title">
                      {t("edit.product.titleLabel")}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {t("edit.charCount", {
                        count: selectedProductTitleLength,
                      })}
                    </span>
                  </div>
                  <Input
                    id="shopline-product-title"
                    value={title}
                    maxLength={70}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
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
                  <Label htmlFor="shopline-handle">
                    {t("edit.handleLabel")}
                  </Label>
                  <Input
                    id="shopline-handle"
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                  />
                </div>
                {isHandleChanged ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {t("redirects.warning.autoCreated")}
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  {aiSeoModel ? (
                    <span className="text-sm text-muted-foreground">
                      {t("ai.generate.source", { model: aiSeoModel })}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={aiSeoGenerating}
                    onClick={() => {
                      void handleAiSeoDraftGenerate();
                    }}
                  >
                    {aiSeoGenerating
                      ? t("ai.generate.loading")
                      : t("ai.generate.button")}
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedProduct(null)}
                  >
                    <X className="h-4 w-4" />
                    {t("edit.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || isDescriptionTooLong}
                  >
                    <Save className="h-4 w-4" />
                    {t("edit.save")}
                  </Button>
                </DialogFooter>
              </TabsContent>
              <TabsContent value="images" className="space-y-3">
                {(selectedProduct?.images ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("edit.images.empty")}
                  </p>
                ) : (
                  (selectedProduct?.images ?? []).map((image, index) => {
                    const imageLabel = t("edit.images.imageNumber", {
                      number: index + 1,
                    });
                    const inputLabel = `${imageLabel} ${t(
                      "edit.images.altLabel",
                    )}`;

                    return (
                      <div
                        key={image.id}
                        className="grid gap-3 rounded-md border p-3 sm:grid-cols-[72px_1fr_auto] sm:items-end"
                      >
                        <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-md border bg-muted">
                          {image.src ? (
                            <img
                              src={image.src}
                              alt={imageLabel}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = "/1waySEO_icon.svg";
                              }}
                            />
                          ) : (
                            <ImageIcon
                              className="h-5 w-5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`shopline-image-alt-${image.id}`}>
                            {inputLabel}
                          </Label>
                          <Input
                            id={`shopline-image-alt-${image.id}`}
                            value={imageAlts[image.id] ?? ""}
                            maxLength={125}
                            placeholder={t("edit.images.altPlaceholder")}
                            onChange={(event) =>
                              setImageAlts((currentAlts) => ({
                                ...currentAlts,
                                [image.id]: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          aria-label={`${t("edit.images.save")} ${imageLabel}`}
                          disabled={savingImageId === image.id}
                          onClick={() => {
                            void handleImageAltSave(image);
                          }}
                        >
                          <Save className="h-4 w-4" />
                          {t("edit.images.save")}
                        </Button>
                      </div>
                    );
                  })
                )}
              </TabsContent>
              <TabsContent value="categories" className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("edit.categories.selectLabel")}</Label>
                  <div className="max-h-64 space-y-2 overflow-auto rounded-md border p-3">
                    {loadingCollects ? (
                      <p className="text-sm text-muted-foreground">
                        {t("edit.categories.loading")}
                      </p>
                    ) : availableCollections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("products.column.notSet")}
                      </p>
                    ) : (
                      availableCollections.map((collection) => {
                        const checkboxId = `shopline-category-${collection.id}`;
                        return (
                          <div
                            key={collection.id}
                            className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
                          >
                            <Checkbox
                              id={checkboxId}
                              checked={selectedCollectionIds.has(collection.id)}
                              onCheckedChange={(checked) => {
                                setSelectedCollectionIds((currentIds) => {
                                  const nextIds = new Set(currentIds);
                                  if (checked === true) {
                                    nextIds.add(collection.id);
                                  } else {
                                    nextIds.delete(collection.id);
                                  }
                                  return nextIds;
                                });
                              }}
                            />
                            <Label
                              htmlFor={checkboxId}
                              className="flex flex-1 cursor-pointer flex-col gap-1"
                            >
                              <span>{collection.title}</span>
                              {collection.handle &&
                              collection.handle !== collection.id ? (
                                <span
                                  aria-hidden="true"
                                  className="text-xs text-muted-foreground"
                                >
                                  {collection.handle}
                                </span>
                              ) : null}
                            </Label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {t("edit.categories.advanced")}
                  </summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="shopline-category-add">
                        {t("edit.categories.addLabel")}
                      </Label>
                      <Textarea
                        id="shopline-category-add"
                        value={categoryAddInput}
                        rows={5}
                        placeholder={t("edit.categories.placeholder")}
                        onChange={(event) =>
                          setCategoryAddInput(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shopline-category-remove">
                        {t("edit.categories.removeLabel")}
                      </Label>
                      <Textarea
                        id="shopline-category-remove"
                        value={categoryRemoveInput}
                        rows={5}
                        placeholder={t("edit.categories.placeholder")}
                        onChange={(event) =>
                          setCategoryRemoveInput(event.target.value)
                        }
                      />
                    </div>
                  </div>
                </details>
                {categoryResult ? (
                  <div className="space-y-2 rounded-md border p-3 text-sm">
                    <div className="flex gap-3">
                      <span>
                        {t("edit.categories.successCount", {
                          count: countCategoryResults(categoryResult, true),
                        })}
                      </span>
                      <span>
                        {t("edit.categories.failedCount", {
                          count: countCategoryResults(categoryResult, false),
                        })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {[...categoryResult.added, ...categoryResult.removed].map(
                        (item, index) => (
                          <div
                            key={`${item.collection_id}-${index}`}
                            className="flex items-center justify-between gap-3"
                          >
                            <span>{item.collection_id}</span>
                            <span
                              className={
                                item.success
                                  ? "text-emerald-700"
                                  : "text-destructive"
                              }
                            >
                              {item.success ? "success" : item.error}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
                <DialogFooter>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      void handleCategorySubmit();
                    }}
                  >
                    <Save className="h-4 w-4" />
                    {t("edit.categories.submit")}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function parseCollectionIds(value: string): string[] {
  return value
    .split(/[,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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
  t: (key: string) => string,
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

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function fetchAllCollections(
  websiteId: string,
): Promise<ShoplineCollection[]> {
  const collections: ShoplineCollection[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 5; page++) {
    const requestUrl =
      cursor === null
        ? `/api/shopline/${websiteId}/collections`
        : `/api/shopline/${websiteId}/collections?cursor=${encodeURIComponent(
            cursor,
          )}`;
    const response = await fetch(requestUrl);
    if (!response.ok) throw new Error("shopline_collections_fetch_failed");

    const data = (await response.json()) as CollectionsResponse;
    collections.push(...(data.collections ?? []));
    cursor = data.nextCursor ?? null;
    if (!cursor) break;
  }

  return collections;
}

function countCategoryResults(
  result: CategoryMutationResponse,
  success: boolean,
): number {
  return [...result.added, ...result.removed].filter(
    (item) => item.success === success,
  ).length;
}

function applyCategoryResultToCollects(
  collects: ProductCollect[],
  productId: string,
  result: CategoryMutationResponse,
): ProductCollect[] {
  const collectByCollectionId = new Map(
    collects.map((collect) => [collect.collection_id, collect]),
  );

  for (const item of result.added) {
    if (!item.success || collectByCollectionId.has(item.collection_id)) {
      continue;
    }

    collectByCollectionId.set(item.collection_id, {
      id: `pending-${item.collection_id}`,
      collection_id: item.collection_id,
      product_id: productId,
    });
  }

  for (const item of result.removed) {
    if (item.success) {
      collectByCollectionId.delete(item.collection_id);
    }
  }

  return Array.from(collectByCollectionId.values());
}

function updateProductImage(
  product: ShoplineProduct,
  updatedImage: ShoplineProductImage,
): ShoplineProduct {
  return {
    ...product,
    images: (product.images ?? []).map((image) =>
      image.id === updatedImage.id ? updatedImage : image,
    ),
  };
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
