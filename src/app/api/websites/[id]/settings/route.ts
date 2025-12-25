/**
 * 網站設定 API
 * 返回指定網站的 industry, region, language 設定
 */

import { withCompany, extractPathParams } from "@/lib/api/auth-middleware";
import { successResponse, notFound } from "@/lib/api/response-helpers";

export const GET = withCompany(async (request, { supabase, companyId }) => {
  const startTime = Date.now();
  const { id: websiteId } = extractPathParams(request);

  console.log(
    `[settings] 開始請求 - websiteId: ${websiteId}, companyId: ${companyId}`,
  );

  if (!websiteId) {
    console.log(`[settings] 錯誤: 缺少 websiteId`);
    return notFound("網站");
  }

  try {
    const { data: website, error } = await supabase
      .from("website_configs")
      .select("id, industry, region, language")
      .eq("id", websiteId)
      .eq("company_id", companyId)
      .single();

    const queryTime = Date.now() - startTime;
    console.log(`[settings] 查詢完成 - 耗時: ${queryTime}ms`);

    if (error) {
      console.log(`[settings] 查詢錯誤: ${error.message}`);
      return notFound("網站");
    }

    if (!website) {
      console.log(`[settings] 網站不存在`);
      return notFound("網站");
    }

    console.log(
      `[settings] 成功返回設定 - industry: ${website.industry || "(空)"}, region: ${website.region || "(空)"}`,
    );

    return successResponse({
      industry: website.industry || "",
      region: website.region || "",
      language: website.language || "",
    });
  } catch (err) {
    const errorTime = Date.now() - startTime;
    console.error(`[settings] 未預期錯誤 (${errorTime}ms):`, err);
    throw err;
  }
});
