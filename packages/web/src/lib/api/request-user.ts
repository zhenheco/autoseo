import { NextResponse } from "next/server";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface RequestUser {
  id: string;
  email?: string | null;
}

interface RequestUserAuthClient {
  auth: {
    getUser(token?: string): Promise<{
      data: {
        user: RequestUser | null;
      };
      error?: {
        message?: string;
      } | null;
    }>;
  };
}

type CookieClientFactory = () => Promise<RequestUserAuthClient>;
type SupabaseClientFactory = (
  url: string,
  anonKey: string,
) => RequestUserAuthClient;

export interface ResolveRequestUserDependencies {
  createCookieClient?: CookieClientFactory;
  createSupabaseClient?: SupabaseClientFactory;
  env?: Partial<
    Pick<
      NodeJS.ProcessEnv,
      "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    >
  >;
}

export type ResolveRequestUserResult =
  | {
      success: true;
      user: RequestUser;
    }
  | {
      success: false;
      response: NextResponse;
    };

export async function resolveRequestUser(
  request: Partial<Pick<Request, "headers">>,
  dependencies: ResolveRequestUserDependencies = {},
): Promise<ResolveRequestUserResult> {
  const authHeader = request.headers?.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const env = dependencies.env ?? process.env;
    const authClient = (
      dependencies.createSupabaseClient ?? createSupabaseClient
    )(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: userData, error: userError } =
      await authClient.auth.getUser(token);

    if (userError || !userData.user) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Invalid token", details: userError?.message },
          { status: 401 },
        ),
      };
    }

    return {
      success: true,
      user: userData.user,
    };
  }

  const cookieClient = await (
    dependencies.createCookieClient ?? createCookieClient
  )();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();

  if (!user) {
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    success: true,
    user,
  };
}
