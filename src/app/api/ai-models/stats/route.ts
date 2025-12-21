/**
 * AI 模型使用統計 API
 */

import { NextRequest } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";
import { successResponse, internalError } from "@/lib/api/response-helpers";

export const GET = withCompany(
  async (request: NextRequest, { supabase, companyId }) => {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    try {
      const params: {
        company_id_param: string;
        start_date?: string;
        end_date?: string;
      } = { company_id_param: companyId };

      if (startDate) {
        params.start_date = startDate;
      }

      if (endDate) {
        params.end_date = endDate;
      }

      const { data, error } = await supabase.rpc(
        "get_agent_execution_stats",
        params,
      );

      if (error) {
        return internalError(error.message);
      }

      return successResponse({ stats: data || [] });
    } catch (error: unknown) {
      return internalError((error as Error).message);
    }
  },
);
