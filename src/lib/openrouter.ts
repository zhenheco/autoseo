export interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data: OpenRouterModelsResponse = await response.json();
  return data.data;
}

export function normalizeOpenRouterModel(model: OpenRouterModel) {
  const modality = model.architecture?.modality || 'text';
  const modelType = modality === 'text->image' ? 'image' :
                   modality.includes('multimodal') ? 'multimodal' : 'text';

  return {
    model_id: model.id,
    model_name: model.name,
    model_type: modelType,
    context_length: model.context_length,
    pricing: {
      prompt: parseFloat(model.pricing.prompt) * 1000000,
      completion: parseFloat(model.pricing.completion) * 1000000,
    },
    openrouter_data: model,
    last_synced_at: new Date().toISOString(),
  };
}

export async function callOpenRouter(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  // 構建請求參數，圖片模型不支援 temperature
  const requestBody: any = {
    model: params.model,
    messages: params.messages,
    max_tokens: params.max_tokens,
    response_format: params.response_format,
  };

  // 只有非圖片模型才加入 temperature
  const modelName = params.model.toLowerCase();
  const isImageModel = modelName.includes('image') ||
                       modelName.includes('dalle') ||
                       modelName.includes('flux') ||
                       modelName.includes('stable-diffusion');

  if (!isImageModel) {
    requestBody.temperature = params.temperature ?? 0.7;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3168',
      'X-Title': 'Auto Pilot SEO',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}
