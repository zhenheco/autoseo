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

async function syncModels() {
  console.log('🔄 同步 ai_models 與 ai_model_pricing...\n');

  console.log('📝 步驟 1: 新增 gpt-image-1-mini 到 ai_model_pricing...\n');

  const { error: insertError } = await supabase.from('ai_model_pricing').upsert(
    {
      model_name: 'gpt-image-1-mini',
      provider: 'openai',
      tier: 'basic',
      multiplier: 1.0,
      input_price_per_1m: 2.5,
      output_price_per_1m: 8.0,
      is_active: true,
    },
    {
      onConflict: 'model_name',
    }
  );

  if (insertError) {
    console.error('❌ 新增 pricing 錯誤:', insertError);
    return;
  } else {
    console.log('✅ 成功新增/更新 gpt-image-1-mini pricing\n');
  }

  console.log('📝 步驟 2: 查詢 ai_model_pricing 中的所有模型...\n');

  const { data: pricingModels, error: pricingError } = await supabase
    .from('ai_model_pricing')
    .select('model_name');

  if (pricingError) {
    console.error('❌ 查詢 pricing 錯誤:', pricingError);
    return;
  }

  const pricingModelNames = new Set(pricingModels.map((m) => m.model_name));
  console.log(`📊 ai_model_pricing 中有 ${pricingModelNames.size} 個模型\n`);

  const { data: allModels, error: modelsError } = await supabase
    .from('ai_models')
    .select('*');

  if (modelsError) {
    console.error('❌ 查詢 models 錯誤:', modelsError);
    return;
  }

  console.log(`📊 ai_models 中有 ${allModels?.length || 0} 個模型\n`);

  console.log('📝 步驟 3: 比對並刪除不在 pricing 中的模型...\n');

  const modelsToDelete = allModels?.filter((m) => !pricingModelNames.has(m.model_name)) || [];

  if (modelsToDelete.length > 0) {
    console.log(`🗑️  需要刪除 ${modelsToDelete.length} 個模型:\n`);
    modelsToDelete.forEach((m) => {
      console.log(`   - ${m.model_name} (${m.model_id})`);
    });

    const { error: deleteError } = await supabase
      .from('ai_models')
      .delete()
      .in(
        'model_id',
        modelsToDelete.map((m) => m.model_id)
      );

    if (deleteError) {
      console.error('\n❌ 刪除錯誤:', deleteError);
    } else {
      console.log('\n✅ 成功刪除模型');
    }
  } else {
    console.log('✅ 所有模型都在 pricing 表中，無需刪除');
  }

  const { data: finalModels } = await supabase.from('ai_models').select('model_id, model_name, model_type');

  console.log(`\n📊 最終 ai_models 列表 (${finalModels?.length || 0} 個):\n`);
  finalModels?.forEach((m, i) => {
    console.log(`${i + 1}. [${m.model_type}] ${m.model_id} - ${m.model_name}`);
  });
}

syncModels().catch(console.error);
