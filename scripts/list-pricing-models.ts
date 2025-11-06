import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listModels() {
  const { data } = await supabase
    .from('ai_model_pricing')
    .select('model_name, provider')
    .order('model_name');

  console.log('📊 ai_model_pricing 中的所有模型:\n');
  data?.forEach((m, i) => console.log(`${i + 1}. ${m.model_name} (${m.provider})`));
}

listModels().catch(console.error);
