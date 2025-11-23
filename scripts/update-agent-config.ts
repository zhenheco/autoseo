import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n=== 更新 Agent 配置為 DeepSeek 模型 ===\n');

  const { data: configs, error } = await supabase
    .from('agent_configs')
    .select('*');

  if (error) {
    console.error('❌ 獲取配置失敗:', error);
    return;
  }

  console.log(`找到 ${configs?.length || 0} 個配置\n`);

  for (const cfg of configs || []) {
    console.log(`\n配置 ID: ${cfg.id}`);
    console.log(`當前設定:`);
    console.log(`  Research Model: ${cfg.research_model}`);
    console.log(`  Strategy Model: ${cfg.complex_processing_model}`);
    console.log(`  Writing Model: ${cfg.simple_processing_model}`);
    console.log(`  Meta Model: ${cfg.meta_model}`);

    // 更新為 DeepSeek 模型並設定正確的 max_tokens
    const updates = {
      research_model: 'deepseek-reasoner',
      research_max_tokens: 64000,
      complex_processing_model: 'deepseek-reasoner',
      strategy_temperature: 0.7,
      strategy_max_tokens: 64000,
      simple_processing_model: 'deepseek-chat',
      writing_model: 'deepseek-chat',
      writing_temperature: 0.7,
      writing_max_tokens: 8192,  // deepseek-chat 的限制
      meta_model: 'deepseek-chat',
      meta_temperature: 0.7,
      meta_max_tokens: 8192,  // deepseek-chat 的限制
      image_model: 'gpt-image-1-mini',
    };

    const { error: updateError } = await supabase
      .from('agent_configs')
      .update(updates)
      .eq('id', cfg.id);

    if (updateError) {
      console.error(`❌ 更新失敗:`, updateError);
    } else {
      console.log(`\n✅ 已更新配置:`);
      console.log(`  Research: deepseek-reasoner (max 64000 tokens)`);
      console.log(`  Strategy: deepseek-reasoner (max 64000 tokens)`);
      console.log(`  Writing: deepseek-chat (max 8192 tokens)`);
      console.log(`  Meta: deepseek-chat (max 8192 tokens)`);
      console.log(`  Image: gpt-image-1-mini`);
    }
  }

  console.log('\n=== 完成 ===\n');
}

main().catch(console.error);
