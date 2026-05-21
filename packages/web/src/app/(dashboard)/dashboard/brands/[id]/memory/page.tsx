import { getUser } from "@shared/auth";
import { createClient } from "@shared/supabase";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BrandMemoryForm, type BrandMemoryFormBrand } from "./BrandMemoryForm";
import {
  BrandPerformanceMemory,
  type BrandPerformanceMemoryItem,
} from "./BrandPerformanceMemory";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type PerformanceMemoryRow =
  Database["public"]["Tables"]["brand_performance_memory"]["Row"];

const brandIdSchema = z.string().uuid();
const BRAND_SELECT =
  "id, company_id, name, voice_tone, target_audience, value_props, brand_guidelines, logo_url, primary_color, secondary_color, is_default, created_at, updated_at, deleted_at";

export default async function BrandMemoryPage({ params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const parsedId = brandIdSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const supabase = await createClient();
  const brand = await loadBrand(supabase, parsedId.data);
  if (!brand) {
    notFound();
  }

  const canAccess = await userCanAccessBrandCompany(
    supabase,
    user.id,
    brand.company_id,
  );
  if (!canAccess) {
    notFound();
  }

  const performanceMemory = await loadPerformanceMemory(supabase, brand.id);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <p className="text-sm text-muted-foreground">Brand memory</p>
        <h1 className="mt-1 text-3xl font-bold tracking-normal">
          {brand.name}
        </h1>
      </div>
      <BrandMemoryForm brand={toFormBrand(brand)} />
      <BrandPerformanceMemory items={performanceMemory} />
    </div>
  );
}

async function loadBrand(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandRow | null> {
  const { data, error } = await supabase
    .from("brands")
    .select(BRAND_SELECT)
    .eq("id", brandId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[BrandMemory] Failed to load brand:", error);
    throw new Error("Failed to load brand memory");
  }

  return (data as BrandRow | null) ?? null;
}

async function userCanAccessBrandCompany(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[BrandMemory] Failed to verify company membership:", error);
    throw new Error("Failed to verify brand access");
  }

  return Boolean(data);
}

async function loadPerformanceMemory(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandPerformanceMemoryItem[]> {
  const { data, error } = await supabase
    .from("brand_performance_memory")
    .select("metric_key, metric_value, updated_at")
    .eq("brand_id", brandId)
    .order("metric_key", { ascending: true });

  if (error) {
    console.error("[BrandMemory] Failed to load performance memory:", error);
    return [];
  }

  return ((data ?? []) as PerformanceMemoryRow[]).map((row) => ({
    metricKey: row.metric_key,
    metricValue: row.metric_value,
    updatedAt: row.updated_at,
  }));
}

function toFormBrand(brand: BrandRow): BrandMemoryFormBrand {
  return {
    id: brand.id,
    name: brand.name,
    voice_tone: brand.voice_tone,
    target_audience: brand.target_audience,
    value_props: brand.value_props,
    brand_guidelines: brand.brand_guidelines,
    logo_url: brand.logo_url,
    primary_color: brand.primary_color,
    secondary_color: brand.secondary_color,
  };
}
