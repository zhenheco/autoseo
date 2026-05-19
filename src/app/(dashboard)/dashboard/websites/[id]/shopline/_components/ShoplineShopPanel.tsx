"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type ShoplineShopMeta = {
  seo_title_template?: string | null;
  default_description?: string | null;
  robots_index_products?: boolean;
  robots_index_collections?: boolean;
  sitemap_enabled?: boolean;
  default_og_image?: string | null;
  hreflang_map?: Record<string, string> | null;
};

type ShoplineShopPanelProps = {
  websiteId: string;
};

const TEMPLATE_VARIABLES = [
  "{{product.title}}",
  "{{product.vendor}}",
  "{{product.type}}",
  "{{collection.title}}",
  "{{shop.name}}",
];

export function ShoplineShopPanel({ websiteId }: ShoplineShopPanelProps) {
  const t = useTranslations("shopline.seo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seoTitleTemplate, setSeoTitleTemplate] = useState("");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [robotsIndexProducts, setRobotsIndexProducts] = useState(true);
  const [robotsIndexCollections, setRobotsIndexCollections] = useState(true);
  const [sitemapEnabled, setSitemapEnabled] = useState(true);
  const [defaultOgImage, setDefaultOgImage] = useState("");
  const [hreflangJson, setHreflangJson] = useState("");
  const saveErrorMessage = t("toast.saveError");

  useEffect(() => {
    let cancelled = false;

    async function loadShopMeta() {
      setLoading(true);

      try {
        const response = await fetch(`/api/shopline/${websiteId}/shop-meta`);
        if (!response.ok) throw new Error("shopline_shop_meta_fetch_failed");

        const data = (await response.json()) as ShoplineShopMeta;
        if (cancelled) return;

        setSeoTitleTemplate(data.seo_title_template ?? "");
        setDefaultDescription(data.default_description ?? "");
        setRobotsIndexProducts(data.robots_index_products ?? true);
        setRobotsIndexCollections(data.robots_index_collections ?? true);
        setSitemapEnabled(data.sitemap_enabled ?? true);
        setDefaultOgImage(data.default_og_image ?? "");
        setHreflangJson(
          data.hreflang_map ? JSON.stringify(data.hreflang_map, null, 2) : "",
        );
      } catch {
        if (!cancelled) toast.error(saveErrorMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadShopMeta();

    return () => {
      cancelled = true;
    };
  }, [saveErrorMessage, websiteId]);

  function insertVariable(variable: string) {
    setSeoTitleTemplate((current) =>
      current.length > 0 ? `${current} ${variable}` : variable,
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const hreflang_map =
        hreflangJson.trim().length > 0
          ? (JSON.parse(hreflangJson) as Record<string, string>)
          : null;
      const response = await fetch(`/api/shopline/${websiteId}/shop-meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seo_title_template: seoTitleTemplate || null,
          default_description: defaultDescription || null,
          robots_index_products: robotsIndexProducts,
          robots_index_collections: robotsIndexCollections,
          sitemap_enabled: sitemapEnabled,
          default_og_image: defaultOgImage || null,
          hreflang_map,
        }),
      });

      if (!response.ok) throw new Error("shopline_shop_meta_save_failed");

      const data = (await response.json()) as ShoplineShopMeta;
      setSeoTitleTemplate(data.seo_title_template ?? "");
      setDefaultDescription(data.default_description ?? "");
      setRobotsIndexProducts(data.robots_index_products ?? true);
      setRobotsIndexCollections(data.robots_index_collections ?? true);
      setSitemapEnabled(data.sitemap_enabled ?? true);
      setDefaultOgImage(data.default_og_image ?? "");
      setHreflangJson(
        data.hreflang_map ? JSON.stringify(data.hreflang_map, null, 2) : "",
      );
      toast.success(t("toast.saveSuccess"));
    } catch {
      toast.error(saveErrorMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("shop.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="shopline-shop-title-template">
              {t("shop.titleTemplate.label")}
            </Label>
            <Input
              id="shopline-shop-title-template"
              value={seoTitleTemplate}
              placeholder={t("shop.titleTemplate.placeholder")}
              onChange={(event) => setSeoTitleTemplate(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t("shop.titleTemplate.variables")}
              </span>
              {TEMPLATE_VARIABLES.map((variable) => (
                <Button
                  key={variable}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => insertVariable(variable)}
                >
                  {variable}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shopline-shop-default-description">
              {t("shop.defaultDescription.label")}
            </Label>
            <Textarea
              id="shopline-shop-default-description"
              value={defaultDescription}
              rows={4}
              onChange={(event) => setDefaultDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SwitchField
              id="shopline-robots-products"
              label={t("shop.robots.products")}
              checked={robotsIndexProducts}
              onCheckedChange={setRobotsIndexProducts}
            />
            <SwitchField
              id="shopline-robots-collections"
              label={t("shop.robots.collections")}
              checked={robotsIndexCollections}
              onCheckedChange={setRobotsIndexCollections}
            />
            <SwitchField
              id="shopline-sitemap-enabled"
              label={t("shop.sitemap.enabled")}
              checked={sitemapEnabled}
              onCheckedChange={setSitemapEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shopline-shop-og-image">
              {t("shop.ogImage.label")}
            </Label>
            <Input
              id="shopline-shop-og-image"
              type="url"
              value={defaultOgImage}
              onChange={(event) => setDefaultOgImage(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shopline-shop-hreflang">
              {t("shop.hreflang.label")}
            </Label>
            <Textarea
              id="shopline-shop-hreflang"
              value={hreflangJson}
              rows={5}
              onChange={(event) => setHreflangJson(event.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading || saving}>
              <Save className="h-4 w-4" />
              {t("shop.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SwitchField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}
