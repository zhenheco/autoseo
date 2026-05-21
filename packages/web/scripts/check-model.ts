import { createClient } from '@supabase/supabase-js';

async function checkModel() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('workflow_settings')
    .select('meta_model')
    .eq('website_id', 'acdfecee-e9a9-4996-9c03-8649ff9e2364')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('meta_model from database:', data.meta_model);
  }
}

checkModel().catch(console.error);
