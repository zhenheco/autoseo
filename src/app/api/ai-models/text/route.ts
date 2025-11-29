import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("get_active_text_models");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    interface AIModel {
      id: string;
      provider: string;
      model_id: string;
      model_name: string;
      description: string;
      capabilities: string[];
      pricing: Record<string, number>;
      context_window: number;
      max_tokens: number;
      tags: string[];
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
          context_window: model.context_window,
          max_tokens: model.max_tokens,
          tags: model.tags,
        });
        return acc;
      },
      {} as Record<string, AIModel[]>,
    );

    return NextResponse.json({
      success: true,
      models: data,
      groupedByProvider,
      count: data?.length || 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
