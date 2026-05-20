#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, user_id')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (!membership) {
    console.log('❌ 找不到有效的公司成員');
    process.exit(1);
  }

  const { data: website } = await supabase
    .from('website_configs')
    .select('id')
    .eq('company_id', membership.company_id)
    .limit(1)
    .single();

  console.log(JSON.stringify({
    companyId: membership.company_id,
    userId: membership.user_id,
    websiteId: website?.id || null
  }, null, 2));
})();
