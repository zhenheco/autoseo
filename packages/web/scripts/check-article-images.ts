import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('generated_articles')
    .select('featured_image_url, content_images')
    .eq('id', 'c5a3ef4e-49b9-4bf5-8868-c2c313f59d3f')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Featured Image URL:');
  console.log(data.featured_image_url);
  console.log('\nContent Images:');
  console.log(JSON.stringify(data.content_images, null, 2));
}

main();
