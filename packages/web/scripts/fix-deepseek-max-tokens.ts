import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n=== 修復 DeepSeek max_tokens 設定 ===\n');

  // 檢查當前配置
  const { data: configs, error } = await supabase
    .from('agent_configs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 獲取配置失敗:', error);
    return;
  }

  console.log(`找到 ${configs?.length || 0} 個配置\n`);

  // 更新所有使用 deepseek-chat 的配置
  for (const cfg of configs || []) {
    console.log(`\n配置 ID: ${cfg.id}`);
    console.log(`Writing Model: ${cfg.writing_model}`);
    console.log(`當前 Max Tokens: ${cfg.writing_max_tokens}`);

    if (cfg.writing_model === 'deepseek-chat' && cfg.writing_max_tokens > 8192) {
      console.log(`⚠️  需要修正 (max_tokens > 8192)`);

      const { error: updateError } = await supabase
        .from('agent_configs')
        .update({ writing_max_tokens: 8192 })
        .eq('id', cfg.id);

      if (updateError) {
        console.error(`❌ 更新失敗:`, updateError);
      } else {
        console.log(`✅ 已更新為 8192`);
      }
    } else {
      console.log('✅ 配置正確');
    }
  }

  console.log('\n=== 完成 ===\n');
}

main().catch(console.error);
