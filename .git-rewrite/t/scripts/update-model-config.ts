import { createClient } from '@supabase/supabase-js';

async function updateModelConfig() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 查找現有公司...');
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name, ai_model_preferences')
    .limit(10);

  if (fetchError) {
    console.error('❌ Error:', fetchError);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.error('❌ 找不到任何公司');
    process.exit(1);
  }

  console.log(`\n找到 ${companies.length} 個公司：`);
  companies.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (${c.id})`);
    console.log(`   Current config:`, c.ai_model_preferences);
  });

  const newConfig = {
    research_model: 'deepseek-reasoner',
    strategy_model: 'deepseek-reasoner',
    writing_model: 'deepseek-chat',
    meta_model: 'deepseek-chat',
    image_model: 'none'
  };

  console.log('\n📝 更新配置為：');
  console.log(JSON.stringify(newConfig, null, 2));

  for (const company of companies) {
    console.log(`\n🔄 更新公司: ${company.name}`);
    const { error: updateError } = await supabase
      .from('companies')
      .update({ ai_model_preferences: newConfig })
      .eq('id', company.id);

    if (updateError) {
      console.error(`❌ 更新失敗:`, updateError);
    } else {
      console.log(`✅ 更新成功`);
    }
  }
}

updateModelConfig().catch(console.error);
