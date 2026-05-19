import type { Database } from "@/types/database.types";

export type ShoplineRedirect =
  Database["public"]["Tables"]["shopline_redirects"]["Row"];
export type ShoplineRedirectInsert =
  Database["public"]["Tables"]["shopline_redirects"]["Insert"];

type StoreError = { message?: string } | null;

export interface RedirectStoreSupabase {
  from: (table: "shopline_redirects") => {
    insert: (row: ShoplineRedirectInsert) => Promise<{ error: StoreError }>;
    select: (cols: string) => any;
    delete: () => any;
  };
}

const REDIRECT_SELECT =
  "id, website_id, entity_type, entity_id, handle_from, handle_to, created_at, last_hit_at, hit_count";

export async function createShoplineRedirect(
  supabase: RedirectStoreSupabase,
  input: {
    websiteId: string;
    entityType: "product" | "collection" | "page";
    entityId?: string;
    handleFrom: string;
    handleTo: string;
  },
): Promise<void> {
  if (input.handleFrom === input.handleTo) return;

  const { error } = await supabase.from("shopline_redirects").insert({
    website_id: input.websiteId,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    handle_from: input.handleFrom,
    handle_to: input.handleTo,
  });

  if (error) {
    console.warn(
      "[shopline-redirect-store] redirect insert failed:",
      error.message ?? "unknown",
    );
  }
}

export async function listShoplineRedirects(
  supabase: RedirectStoreSupabase,
  websiteId: string,
): Promise<ShoplineRedirect[]> {
  const { data, error } = await supabase
    .from("shopline_redirects")
    .select(REDIRECT_SELECT)
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`shopline_redirects_list_failed: ${error.message}`);
  }

  return (data ?? []) as ShoplineRedirect[];
}

export async function deleteShoplineRedirect(
  supabase: RedirectStoreSupabase,
  redirectId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shopline_redirects")
    .delete()
    .eq("id", redirectId);

  if (error) {
    throw new Error(`shopline_redirect_delete_failed: ${error.message}`);
  }
}
