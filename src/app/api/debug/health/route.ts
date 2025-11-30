import { NextResponse } from "next/server";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    step: "initial",
  };

  try {
    diagnostics.step = "env_check";
    diagnostics.envVars = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
    };

    diagnostics.step = "cookies_import";
    const { cookies } = await import("next/headers");

    diagnostics.step = "cookies_call";
    const cookieStore = await cookies();
    diagnostics.cookiesWork = true;
    diagnostics.cookieCount = cookieStore.getAll().length;

    diagnostics.step = "supabase_import";
    const { createClient } = await import("@/lib/supabase/server");

    diagnostics.step = "supabase_create";
    const supabase = await createClient();
    diagnostics.supabaseClientCreated = true;

    diagnostics.step = "db_query";
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("id")
      .limit(1);

    diagnostics.dbQuery = {
      success: !error,
      error: error?.message,
      hasData: !!data,
    };

    diagnostics.step = "admin_import";
    const { createAdminClient } = await import("@/lib/supabase/server");

    diagnostics.step = "admin_create";
    const adminClient = createAdminClient();
    diagnostics.adminClientCreated = true;

    diagnostics.step = "admin_query";
    const { data: adminData, error: adminError } = await adminClient
      .from("affiliates")
      .select("id")
      .limit(1);

    diagnostics.adminQuery = {
      success: !adminError,
      error: adminError?.message,
      hasData: !!adminData,
    };

    diagnostics.step = "complete";
    diagnostics.success = true;

    return NextResponse.json(diagnostics);
  } catch (error) {
    diagnostics.error = {
      message: error instanceof Error ? error.message : String(error),
      stack:
        error instanceof Error
          ? error.stack?.split("\n").slice(0, 5)
          : undefined,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
