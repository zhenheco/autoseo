import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json(
      { error: "Company ID is required" },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase.rpc("get_company_ai_models", {
      company_id_param: companyId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: data?.[0] || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { companyId, preferences } = body;

    if (!companyId || !preferences) {
      return NextResponse.json(
        { error: "Company ID and preferences are required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("companies")
      .update({ ai_model_preferences: preferences })
      .eq("id", companyId)
      .select("id, ai_model_preferences")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      company: data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
