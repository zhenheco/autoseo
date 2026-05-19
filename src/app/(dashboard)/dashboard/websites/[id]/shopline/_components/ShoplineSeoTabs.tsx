"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoplineCollectionsPanel } from "./ShoplineCollectionsPanel";
import { ShoplineProductsPanel } from "./ShoplineProductsPanel";
import { ShoplineRedirectsPanel } from "./ShoplineRedirectsPanel";
import { ShoplineShopPanel } from "./ShoplineShopPanel";

type ShoplineSeoTabsProps = {
  websiteId: string;
};

export function ShoplineSeoTabs({ websiteId }: ShoplineSeoTabsProps) {
  const t = useTranslations("shopline.seo");

  return (
    <Tabs defaultValue="products" className="space-y-4">
      <TabsList>
        <TabsTrigger value="products">{t("tabs.products")}</TabsTrigger>
        <TabsTrigger value="collections">{t("tabs.collections")}</TabsTrigger>
        <TabsTrigger value="redirects">{t("tabs.redirects")}</TabsTrigger>
        <TabsTrigger value="shop">{t("tabs.shop")}</TabsTrigger>
      </TabsList>
      <TabsContent value="products">
        <ShoplineProductsPanel websiteId={websiteId} />
      </TabsContent>
      <TabsContent value="collections">
        <ShoplineCollectionsPanel websiteId={websiteId} />
      </TabsContent>
      <TabsContent value="redirects">
        <ShoplineRedirectsPanel websiteId={websiteId} />
      </TabsContent>
      <TabsContent value="shop">
        <ShoplineShopPanel websiteId={websiteId} />
      </TabsContent>
    </Tabs>
  );
}
