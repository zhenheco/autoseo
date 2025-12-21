/**
 * 網站 AI Agent 配置 API
 */

import { NextRequest } from "next/server";
import { withCompany, extractPathParams } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";
import type { UpdateAgentConfigRequest } from "@/types/ai-models";

/**
 * GET /api/websites/[id]/agent-config
 * 取得網站的 AI Agent 配置
 */
export const GET = withCompany(
  async (request: NextRequest, { supabase, companyId }) => {
    const { id: websiteId } = extractPathParams(request);

    if (!websiteId) {
      return notFound("網站");
    }

    // 驗證網站屬於該公司
    const { data: website, error: websiteError } = await supabase
      .from("website_configs")
      .select("id")
      .eq("id", websiteId)
      .eq("company_id", companyId)
      .single();

    if (websiteError || !website) {
      return notFound("網站");
    }

    // 查詢 agent config
    const { data: agentConfig, error } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("website_id", websiteId)
      .single();

    if (error) {
      console.error("[Agent Config API] Error:", error);
      return internalError("查詢失敗");
    }

    if (!agentConfig) {
      return notFound("設定");
    }

    return successResponse({ config: agentConfig });
  },
);

/**
 * PUT /api/websites/[id]/agent-config
 * 更新網站的 AI Agent 配置
 */
export const PUT = withCompany(
  async (request: NextRequest, { supabase, companyId }) => {
    const { id: websiteId } = extractPathParams(request);

    if (!websiteId) {
      return notFound("網站");
    }

    // 驗證網站屬於該公司
    const { data: website, error: websiteError } = await supabase
      .from("website_configs")
      .select("id")
      .eq("id", websiteId)
      .eq("company_id", companyId)
      .single();

    if (websiteError || !website) {
      return notFound("網站");
    }

    const body: UpdateAgentConfigRequest = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.complex_processing_model !== undefined) {
      updates.complex_processing_model = body.complex_processing_model;
    }
    if (body.simple_processing_model !== undefined) {
      updates.simple_processing_model = body.simple_processing_model;
    }
    if (body.image_model !== undefined) {
      updates.image_model = body.image_model;
    }
    if (body.research_model !== undefined) {
      updates.research_model = body.research_model;
    }
    if (body.meta_model !== undefined) {
      updates.meta_model = body.meta_model;
    }

    if (Object.keys(updates).length === 0) {
      return validationError("沒有需要更新的欄位");
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedConfig, error } = await supabase
      .from("agent_configs")
      .update(updates)
      .eq("website_id", websiteId)
      .select("*")
      .single();

    if (error) {
      console.error("[Agent Config API] Update failed:", error);
      return internalError("更新失敗");
    }

    return successResponse({ config: updatedConfig });
  },
);
