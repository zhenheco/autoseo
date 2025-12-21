/**
 * 圖片模型列表 API（公開端點）
 */

import { createClient } from "@/lib/supabase/server";
import { successResponse, internalError } from "@/lib/api/response-helpers";

interface AIModel {
  id: string;
  provider: string;
  model_id: string;
  model_name: string;
  description: string;
  capabilities: string[];
  pricing: Record<string, number>;
  image_sizes: string[];
  image_quality_options: string[];
  tags: string[];
}

export async function GET() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("get_active_image_models");

    if (error) {
      return internalError(error.message);
    }

    const groupedByProvider = data?.reduce(
      (acc: Record<string, AIModel[]>, model: AIModel) => {
        const provider = model.provider;
        if (!acc[provider]) {
          acc[provider] = [];
        }
        acc[provider].push({
          id: model.id,
          provider: model.provider,
          model_id: model.model_id,
          model_name: model.model_name,
          description: model.description,
          capabilities: model.capabilities,
          pricing: model.pricing,
          image_sizes: model.image_sizes,
          image_quality_options: model.image_quality_options,
          tags: model.tags,
        });
        return acc;
      },
      {} as Record<string, AIModel[]>,
    );

    return successResponse({
      models: data,
      groupedByProvider,
      count: data?.length || 0,
    });
  } catch (error: unknown) {
    return internalError((error as Error).message);
  }
}
