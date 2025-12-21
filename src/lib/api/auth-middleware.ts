/**
 * API 認證中間件
 * 統一處理 API 路由的認證和授權邏輯
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  unauthorized,
  noCompanyMembership,
  handleApiError,
} from "./response-helpers";
import type { User } from "@supabase/supabase-js";

// 認證上下文
export interface AuthContext {
  user: User;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

// 公司認證上下文
export interface CompanyAuthContext extends AuthContext {
  companyId: string;
}

// 管理員認證上下文
export interface AdminAuthContext extends AuthContext {
  adminClient: ReturnType<typeof createAdminClient>;
}

// 完整認證上下文（包含公司和管理員）
export interface FullAuthContext extends CompanyAuthContext {
  adminClient: ReturnType<typeof createAdminClient>;
}

// Handler 類型定義
type AuthHandler<T extends AuthContext> = (
  request: NextRequest,
  context: T,
) => Promise<NextResponse>;

/**
 * 基礎認證包裝器
 * 檢查用戶是否已登入
 */
export function withAuth<T extends AuthContext = AuthContext>(
  handler: AuthHandler<T>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return unauthorized();
      }

      const context = {
        user,
        supabase,
      } as T;

      return handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * 公司認證包裝器
 * 檢查用戶是否有活躍的公司成員資格
 */
export function withCompany(
  handler: AuthHandler<CompanyAuthContext>,
): (request: NextRequest) => Promise<NextResponse> {
  return withAuth(async (request, { user, supabase }) => {
    try {
      const { data: membership, error } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (error || !membership) {
        return noCompanyMembership();
      }

      return handler(request, {
        user,
        supabase,
        companyId: membership.company_id,
      });
    } catch (error) {
      return handleApiError(error);
    }
  });
}

/**
 * 完整認證包裝器
 * 包含用戶認證、公司檢查和管理員客戶端
 */
export function withFullAuth(
  handler: AuthHandler<FullAuthContext>,
): (request: NextRequest) => Promise<NextResponse> {
  return withCompany(async (request, { user, supabase, companyId }) => {
    try {
      const adminClient = createAdminClient();

      return handler(request, {
        user,
        supabase,
        companyId,
        adminClient,
      });
    } catch (error) {
      return handleApiError(error);
    }
  });
}

/**
 * 從 URL 路徑中提取動態路由參數
 * 例如：/api/articles/123/cancel → { id: "123" }
 * 例如：/api/articles/jobs/456 → { id: "456" }
 */
export function extractPathParams(
  request: NextRequest,
): Record<string, string> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  // 從 API 路徑中提取 ID
  // 尋找 UUID 或數字格式的段落
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // UUID 格式 (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segment,
      )
    ) {
      params.id = segment;
    }
    // 數字格式
    else if (/^\d+$/.test(segment)) {
      params.id = segment;
    }
  }

  return params;
}

/**
 * 取得用戶的公司 ID（用於簡單查詢）
 */
export async function getUserCompanyId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return data?.company_id ?? null;
}

/**
 * 取得帳單 ID（優先使用公司 ID，否則用用戶 ID）
 */
export async function getBillingId(userId: string): Promise<string> {
  const companyId = await getUserCompanyId(userId);
  return companyId ?? userId;
}
