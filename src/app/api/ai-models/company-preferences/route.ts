/**
 * 公司 AI 模型偏好設定 API
 */

import { NextRequest } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";

/**
 * GET /api/ai-models/company-preferences
 * 取得公司的 AI 模型偏好設定
 */
export const GET = withCompany(
  async (request: NextRequest, { supabase, companyId }) => {
    try {
      const { data, error } = await supabase.rpc("get_company_ai_models", {
        company_id_param: companyId,
      });

      if (error) {
        return internalError(error.message);
      }

      return successResponse({ preferences: data?.[0] || null });
    } catch (error: unknown) {
      return internalError((error as Error).message);
    }
  },
);

/**
 * POST /api/ai-models/company-preferences
 * 更新公司的 AI 模型偏好設定
 */
export const POST = withCompany(
  async (request: NextRequest, { supabase, companyId }) => {
    const body = await request.json();
    const { preferences } = body;

    if (!preferences) {
      return validationError("Preferences are required");
    }

    try {
      const { data, error } = await supabase
        .from("companies")
        .update({ ai_model_preferences: preferences })
        .eq("id", companyId)
        .select("id, ai_model_preferences")
        .single();

      if (error) {
        return internalError(error.message);
      }

      return successResponse({ company: data });
    } catch (error: unknown) {
      return internalError((error as Error).message);
    }
  },
);
