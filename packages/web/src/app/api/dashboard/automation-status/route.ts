import { getUser, getUserPrimaryCompany } from "@shared/auth";
import { createClient } from "@shared/supabase";
import { NextResponse } from "next/server";
import {
  type QueryClient,
  loadAutomationPipelineCounts,
} from "@/lib/dashboard/flywheel-overview";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brandId = new URL(request.url).searchParams.get("brandId");
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  const company = await getUserPrimaryCompany(user.id);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("company_id", company.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[Dashboard] Automation status brand lookup failed:", error);
    return NextResponse.json(
      { error: "Failed to resolve brand" },
      { status: 500 },
    );
  }

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const counts = await loadAutomationPipelineCounts(
    supabase as unknown as QueryClient,
    brandId,
  );
  return NextResponse.json(counts);
}
