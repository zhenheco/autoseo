#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  const { data: members, error: memberError } = await supabase
    .from('company_members')
    .select('company_id, user_id, status')
    .limit(5);

  console.log('\n📊 Company Members:');
  if (memberError) {
    console.error('  錯誤:', memberError);
  } else if (!members || members.length === 0) {
    console.log('  沒有資料');
  } else {
    members.forEach((m, i) => {
      console.log(`  ${i+1}. Company: ${m.company_id}, User: ${m.user_id}, Status: ${m.status}`);
    });
  }

  const { data: websites, error: websiteError } = await supabase
    .from('website_configs')
    .select('id, company_id, website_name')
    .limit(5);

  console.log('\n📊 Website Configs:');
  if (websiteError) {
    console.error('  錯誤:', websiteError);
  } else if (!websites || websites.length === 0) {
    console.log('  沒有資料');
  } else {
    websites.forEach((w, i) => {
      console.log(`  ${i+1}. ID: ${w.id}, Company: ${w.company_id}, Name: ${w.website_name || 'N/A'}`);
    });
  }
}

checkData().catch(console.error);