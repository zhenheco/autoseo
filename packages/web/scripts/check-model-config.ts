import { createClient } from '@supabase/supabase-js';

async function checkModelConfig() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('companies')
    .select('ai_model_preferences')
    .eq('id', 'd85b2e37-8a8c-4dc0-bb5e-5cfb0be9a1ab')
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Current AI Model Preferences:');
  console.log(JSON.stringify(data.ai_model_preferences, null, 2));

  console.log('\nExpected Configuration:');
  console.log({
    research_model: 'deepseek/deepseek-v3.2-exp',
    strategy_model: 'deepseek/deepseek-v3.2-exp',
    writing_model: 'deepseek/deepseek-chat-v3.1:free',
    meta_model: 'deepseek/deepseek-chat-v3.1:free'
  });
}

checkModelConfig().catch(console.error);
