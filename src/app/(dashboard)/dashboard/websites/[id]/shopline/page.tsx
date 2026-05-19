import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseShoplineConnectionStore,
  getShoplineConnectionStatus,
} from "@/lib/shopline/connections";
import { normalizeShoplineShopHandle } from "@/lib/shopline/oauth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { ShoplineSeoTabs } from "./_components/ShoplineSeoTabs";

type SearchParams = {
  shopHandle?: string;
  shopline?: string;
  error?: string;
  reason?: string;
};

function deriveShoplineHandle(siteUrl: string | null): string {
  if (!siteUrl) return "";

  try {
    return normalizeShoplineShopHandle(siteUrl);
  } catch {
    return "";
  }
}

async function getWebsite(websiteId: string, companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("website_configs")
    .select("id, website_name, site_name, wordpress_url, site_url, company_id")
    .eq("id", websiteId)
    .eq("company_id", companyId)
    .single();

  if (error) return null;
  return data as {
    id: string;
    website_name: string | null;
    site_name: string | null;
    wordpress_url: string | null;
    site_url: string | null;
    company_id: string;
  };
}

async function getStatus(websiteId: string, companyId: string) {
  try {
    return await getShoplineConnectionStatus(
      createSupabaseShoplineConnectionStore(createAdminClient()),
      { companyId, websiteId },
    );
  } catch (error) {
    console.error("[SHOPLINE Connect] Failed to load status:", error);
    return { connected: false };
  }
}

export default async function ShoplineConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const company = await getUserPrimaryCompany(user.id);
  if (!company) redirect("/dashboard");

  const { id } = await params;
  const query = await searchParams;
  const website = await getWebsite(id, company.id);
  if (!website) redirect("/dashboard/websites?error=website_not_found");

  const status = await getStatus(website.id, company.id);
  const siteUrl = website.wordpress_url ?? website.site_url;
  const defaultHandle =
    query.shopHandle ??
    status.shopHandle ??
    deriveShoplineHandle(siteUrl) ??
    "";
  const returnTo = `/dashboard/websites/${website.id}/shopline`;
  const title = website.website_name ?? website.site_name ?? "Website";

  return (
    <div className="container mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href={`/dashboard/websites/${website.id}/edit`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            SHOPLINE OAuth
          </CardTitle>
          <CardDescription>{title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {query.shopline === "connected" && (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>SHOPLINE connected</AlertTitle>
              <AlertDescription>
                {query.shopHandle ?? status.shopHandle} is ready for assisted
                SEO operations.
              </AlertDescription>
            </Alert>
          )}

          {query.shopline === "cancelled" && (
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Authorization cancelled</AlertTitle>
              <AlertDescription>
                SHOPLINE did not grant access. You can start again when ready.
              </AlertDescription>
            </Alert>
          )}

          {query.shopline === "error" && (
            <Alert className="border-destructive/50 text-destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Authorization failed</AlertTitle>
              <AlertDescription>
                {query.error ?? "SHOPLINE could not complete authorization."}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="font-medium">
                {status.connected ? "Connected store" : "Store connection"}
              </p>
              <p className="text-sm text-muted-foreground">
                {status.connected && status.shopHandle
                  ? `${status.shopHandle} · ${
                      status.grantedScopes?.join(", ") || "No scopes recorded"
                    }`
                  : "Enter the merchant store handle to start OAuth."}
              </p>
            </div>
            <Badge variant={status.connected ? "default" : "secondary"}>
              {status.connected ? "Connected" : "Not connected"}
            </Badge>
          </div>

          <form
            action="/api/oauth/shopline/install"
            method="GET"
            className="space-y-4"
          >
            <input type="hidden" name="siteId" value={website.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="space-y-2">
              <Label htmlFor="shopHandle">SHOPLINE store</Label>
              <Input
                id="shopHandle"
                name="shopHandle"
                defaultValue={defaultHandle}
                placeholder="brandname.myshopline.com"
                autoComplete="off"
                required
              />
            </div>
            <Button type="submit">
              <ShieldCheck className="h-4 w-4" />
              Authorize SHOPLINE
            </Button>
          </form>
        </CardContent>
      </Card>

      {status.connected === true && (
        <div className="mt-6">
          <ShoplineSeoTabs websiteId={website.id} />
        </div>
      )}
    </div>
  );
}
