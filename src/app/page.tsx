import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { HomeClient } from "./home-client";

export default async function Home() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select<"*", Database["public"]["Tables"]["subscription_plans"]["Row"]>("*")
    .eq("is_lifetime", true)
    .neq("slug", "free")
    .order("lifetime_price", { ascending: true });

  const { data: tokenPackages } = await supabase
    .from("token_packages")
    .select<"*", Database["public"]["Tables"]["token_packages"]["Row"]>("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  return <HomeClient plans={plans} tokenPackages={tokenPackages} />;
}
