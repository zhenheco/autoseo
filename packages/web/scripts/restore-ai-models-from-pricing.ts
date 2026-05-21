import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const modelMapping: Record<
  string,
  { model_id: string; model_name: string; model_type: 'text' | 'image'; provider: string }
> = {
  'deepseek-reasoner': {
    model_id: 'deepseek-reasoner',
    model_name: 'DeepSeek Reasoner',
    model_type: 'text',
    provider: 'deepseek',
  },
  'deepseek-chat': {
    model_id: 'deepseek-chat',
    model_name: 'DeepSeek Chat',
    model_type: 'text',
    provider: 'deepseek',
  },
  'claude-4-5-sonnet': {
    model_id: 'anthropic/claude-sonnet-4.5',
    model_name: 'Claude 4.5 Sonnet',
    model_type: 'text',
    provider: 'anthropic',
  },
  'gemini-2.5-pro': {
    model_id: 'google/gemini-2.5-pro',
    model_name: 'Gemini 2.5 Pro',
    model_type: 'text',
    provider: 'google',
  },
  'gemini-2-flash': {
    model_id: 'google/gemini-2-flash',
    model_name: 'Gemini 2 Flash',
    model_type: 'text',
    provider: 'google',
  },
  'gpt-5': {
    model_id: 'openai/gpt-5',
    model_name: 'GPT-5',
    model_type: 'text',
    provider: 'openai',
  },
  'gpt-5-mini': {
    model_id: 'openai/gpt-5-mini',
    model_name: 'GPT-5 Mini',
    model_type: 'text',
    provider: 'openai',
  },
  'gpt-image-1-mini': {
    model_id: 'gpt-image-1-mini',
    model_name: 'GPT Image 1 Mini',
    model_type: 'image',
    provider: 'openai',
  },
};

async function restoreModels() {
  console.log('🔄 從 ai_model_pricing 恢復 ai_models...\n');

  const { data: pricingModels, error: pricingError } = await supabase
    .from('ai_model_pricing')
    .select('model_name');

  if (pricingError) {
    console.error('❌ 查詢 pricing 錯誤:', pricingError);
    return;
  }

  console.log(`📊 ai_model_pricing 中有 ${pricingModels.length} 個模型\n`);

  const modelsToInsert = pricingModels
    .map((p) => modelMapping[p.model_name])
    .filter((m) => m !== undefined);

  console.log(`📝 準備插入 ${modelsToInsert.length} 個模型:\n`);
  modelsToInsert.forEach((m) => {
    console.log(`   - [${m.model_type}] ${m.model_name} (${m.model_id})`);
  });

  const { error: insertError } = await supabase.from('ai_models').upsert(modelsToInsert, {
    onConflict: 'model_id',
  });

  if (insertError) {
    console.error('\n❌ 插入錯誤:', insertError);
  } else {
    console.log('\n✅ 成功恢復模型');
  }

  const { data: finalModels } = await supabase.from('ai_models').select('model_id, model_name, model_type');

  console.log(`\n📊 最終 ai_models 列表 (${finalModels?.length || 0} 個):\n`);
  finalModels?.forEach((m, i) => {
    console.log(`${i + 1}. [${m.model_type}] ${m.model_id} - ${m.model_name}`);
  });
}

restoreModels().catch(console.error);
