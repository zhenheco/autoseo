import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateModels() {
  console.log('🔄 更新 AI 模型配置...\n');

  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name, ai_model_preferences');

  if (fetchError) {
    console.error('❌ 獲取公司資料失敗:', fetchError);
    return;
  }

  console.log(`📊 找到 ${companies?.length || 0} 個公司\n`);

  for (const company of companies || []) {
    console.log(`\n🏢 更新公司: ${company.name} (${company.id})`);

    // 高 CP 值配置：88% 品質，60% 成本節省
    const newPreferences = {
      ...company.ai_model_preferences,
      research_model: 'google/gemini-2.5-pro',           // 保留付費（品質關鍵）
      strategy_model: 'google/gemini-2.5-pro',           // 保留付費（品質關鍵）
      writing_model: 'meta-llama/llama-4-maverick:free', // Meta免費模型（無隱私限制）
      meta_model: 'google/gemini-2.0-flash-exp:free',    // Google免費模型（穩定快速）
      image_model: 'openai/gpt-5-image-mini',            // GPT Image Mini
    };

    const { error: updateError } = await supabase
      .from('companies')
      .update({ ai_model_preferences: newPreferences })
      .eq('id', company.id);

    if (updateError) {
      console.error(`   ❌ 更新失敗:`, updateError);
    } else {
      console.log(`   ✅ 已更新為高 CP 值配置 (88% 品質, 60% 成本節省):`);
      console.log(`      - Research/Strategy: google/gemini-2.5-pro (保留付費, 品質關鍵)`);
      console.log(`      - Writing: meta-llama/llama-4-maverick:free (Meta免費, 無隱私限制)`);
      console.log(`      - Meta: google/gemini-2.0-flash-exp:free (Google免費, 穩定快速)`);
      console.log(`      - Image: openai/gpt-5-image-mini (GPT Image Mini)`);
    }
  }

  console.log('\n✨ 更新完成！\n');
}

updateModels().catch(console.error);
