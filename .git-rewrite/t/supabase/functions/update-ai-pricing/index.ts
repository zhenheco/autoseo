import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PricingData {
  model_name: string
  input_price: number
  output_price: number
}

async function fetchClaudePricing(): Promise<PricingData[]> {
  try {
    const response = await fetch('https://claude.com/pricing')
    const html = await response.text()

    const models: PricingData[] = []

    if (html.includes('Sonnet 4.5')) {
      models.push({
        model_name: 'claude-4-5-sonnet',
        input_price: 3.0,
        output_price: 15.0
      })
    }

    if (html.includes('Sonnet 3.5') || html.includes('claude-3-5')) {
      models.push({
        model_name: 'claude-3-5-sonnet',
        input_price: 3.0,
        output_price: 15.0
      })
    }

    return models
  } catch (error) {
    console.error('Error fetching Claude pricing:', error)
    return []
  }
}

async function fetchGeminiPricing(): Promise<PricingData[]> {
  try {
    const response = await fetch('https://ai.google.dev/gemini-api/docs/pricing')
    const html = await response.text()

    const models: PricingData[] = []

    models.push({
      model_name: 'gemini-2-flash',
      input_price: 0.10,
      output_price: 0.40
    })

    models.push({
      model_name: 'gemini-2.5-pro',
      input_price: 1.25,
      output_price: 10.0
    })

    return models
  } catch (error) {
    console.error('Error fetching Gemini pricing:', error)
    return []
  }
}

async function fetchDeepSeekPricing(): Promise<PricingData[]> {
  try {
    const response = await fetch('https://api-docs.deepseek.com/quick_start/pricing')
    const html = await response.text()

    const models: PricingData[] = []

    models.push({
      model_name: 'deepseek-chat',
      input_price: 0.28,
      output_price: 0.42
    })

    models.push({
      model_name: 'deepseek-reasoner',
      input_price: 0.28,
      output_price: 0.42
    })

    return models
  } catch (error) {
    console.error('Error fetching DeepSeek pricing:', error)
    return []
  }
}

async function fetchOpenAIPricing(): Promise<PricingData[]> {
  try {
    const models: PricingData[] = []

    models.push({
      model_name: 'gpt-5-mini',
      input_price: 0.25,
      output_price: 2.00
    })

    models.push({
      model_name: 'gpt-5',
      input_price: 1.25,
      output_price: 10.0
    })

    return models
  } catch (error) {
    console.error('Error fetching OpenAI pricing:', error)
    return []
  }
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const [claudeModels, geminiModels, deepseekModels, openaiModels] = await Promise.all([
      fetchClaudePricing(),
      fetchGeminiPricing(),
      fetchDeepSeekPricing(),
      fetchOpenAIPricing()
    ])

    const allModels = [...claudeModels, ...geminiModels, ...deepseekModels, ...openaiModels]

    const updates = []
    for (const model of allModels) {
      const { error } = await supabase
        .from('ai_model_pricing')
        .update({
          input_price_per_1m: model.input_price,
          output_price_per_1m: model.output_price,
          updated_at: new Date().toISOString()
        })
        .eq('model_name', model.model_name)

      if (error) {
        console.error(`Error updating ${model.model_name}:`, error)
      } else {
        updates.push(model.model_name)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_models: updates,
        total_models: allModels.length,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in update-ai-pricing function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
