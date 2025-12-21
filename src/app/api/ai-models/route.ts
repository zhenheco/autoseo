/**
 * AI 模型管理 API
 * GET: 查詢模型列表（公開）
 * POST/PATCH: 管理模型（需認證）
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";
import type { GetModelsResponse } from "@/types/ai-models";

/**
 * GET /api/ai-models
 * 查詢 AI 模型列表（公開端點）
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  const provider = searchParams.get("provider");
  const processing_tier = searchParams.get("processing_tier");
  const api_provider = searchParams.get("api_provider");
  const is_active = searchParams.get("is_active");

  try {
    let query = supabase
      .from("ai_models")
      .select("*")
      .eq("is_active", is_active === "false" ? false : true)
      .order("sort_order");

    if (type) {
      query = query.eq("model_type", type);
    }

    if (provider) {
      query = query.eq("provider", provider);
    }

    if (processing_tier) {
      query = query.or(
        `processing_tier.eq.${processing_tier},processing_tier.eq.both`,
      );
    }

    if (api_provider) {
      query = query.eq("api_provider", api_provider);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[AI Models API] 查詢失敗:", error);
      return internalError(error.message);
    }

    const response: GetModelsResponse = {
      models: data || [],
      total: data?.length || 0,
    };

    return successResponse({
      ...response,
      count: response.total,
    });
  } catch (error: unknown) {
    console.error("[AI Models API] 未預期的錯誤:", error);
    return internalError((error as Error).message);
  }
}

/**
 * POST /api/ai-models
 * 新增 AI 模型（需認證）
 */
export const POST = withAuth(async (request: NextRequest, { supabase }) => {
  const body = await request.json();

  const { data, error } = await supabase
    .from("ai_models")
    .insert([body])
    .select()
    .single();

  if (error) {
    return internalError(error.message);
  }

  return successResponse({ model: data });
});

/**
 * PATCH /api/ai-models
 * 更新 AI 模型（需認證）
 */
export const PATCH = withAuth(async (request: NextRequest, { supabase }) => {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return validationError("Model ID is required");
  }

  const { data, error } = await supabase
    .from("ai_models")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return internalError(error.message);
  }

  return successResponse({ model: data });
});
