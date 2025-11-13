import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface WebsiteConfig {
  id: string;
  company_id: string;
}

interface AgentConfig {
  website_id: string;
  research_model: string;
  complex_processing_model: string;
  simple_processing_model: string;
  image_model: string;
  research_temperature: number;
  research_max_tokens: number;
  image_size: string;
  image_count: number;
  meta_enabled: boolean;
  meta_model: string;
  meta_temperature: number;
  meta_max_tokens: number;
}

async function main() {
  console.log('開始修復缺少 agent_configs 的 website_configs...\n');

  const { data: websites, error: websiteError } = await supabase
    .from('website_configs')
    .select('id, company_id');

  if (websiteError) {
    console.error('無法查詢 website_configs:', websiteError);
    process.exit(1);
  }

  if (!websites || websites.length === 0) {
    console.log('沒有找到任何 website_configs');
    return;
  }

  console.log(`找到 ${websites.length} 個 website_configs\n`);

  let created = 0;
  let skipped = 0;

  for (const website of websites as WebsiteConfig[]) {
    const { data: existing } = await supabase
      .from('agent_configs')
      .select('id')
      .eq('website_id', website.id)
      .single();

    if (existing) {
      console.log(`✓ website_id ${website.id} 已有 agent_configs`);
      skipped++;
      continue;
    }

    const defaultConfig: AgentConfig = {
      website_id: website.id,
      research_model: 'deepseek-reasoner',
      complex_processing_model: 'deepseek-reasoner',
      simple_processing_model: 'deepseek-chat',
      image_model: 'gpt-image-1-mini',
      research_temperature: 0.7,
      research_max_tokens: 4000,
      image_size: '1024x1024',
      image_count: 3,
      meta_enabled: true,
      meta_model: 'deepseek-chat',
      meta_temperature: 0.7,
      meta_max_tokens: 2000,
    };

    const { error: createError } = await supabase
      .from('agent_configs')
      .insert(defaultConfig);

    if (createError) {
      console.log(`✗ website_id ${website.id} 創建失敗:`, createError.message);
    } else {
      console.log(`✓ website_id ${website.id} agent_configs 已創建`);
      created++;
    }
  }

  console.log(`\n修復完成！`);
  console.log(`已創建: ${created}`);
  console.log(`已存在: ${skipped}`);
}

main().catch(console.error);
