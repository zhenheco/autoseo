#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupWebsite() {
  console.log('🌐 網站設定精靈 - x-marks.com\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少 Supabase 環境變數');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('1️⃣ 檢查現有網站...');
    const { data: existingWebsite } = await supabase
      .from('websites')
      .select('*')
      .eq('url', 'https://x-marks.com')
      .single();

    let websiteId: string;
    let companyId: string;

    if (existingWebsite) {
      console.log('✅ 找到現有網站:', existingWebsite.name);
      websiteId = existingWebsite.id;
      companyId = existingWebsite.company_id;
    } else {
      console.log('\n⚠️  未找到網站，需要先建立');

      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .limit(5);

      if (!companies || companies.length === 0) {
        console.error('❌ 未找到公司記錄，請先建立公司');
        process.exit(1);
      }

      console.log('\n可用的公司：');
      companies.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.name} (${c.id})`);
      });

      const companyIndex = await question('\n請選擇公司編號 (1-' + companies.length + '): ');
      companyId = companies[parseInt(companyIndex) - 1].id;

      const websiteName = await question('網站名稱 (預設: X-Marks): ') || 'X-Marks';

      const { data: newWebsite, error: websiteError } = await supabase
        .from('websites')
        .insert({
          company_id: companyId,
          name: websiteName,
          url: 'https://x-marks.com',
          status: 'active'
        })
        .select()
        .single();

      if (websiteError) {
        console.error('❌ 建立網站失敗:', websiteError);
        process.exit(1);
      }

      websiteId = newWebsite.id;
      console.log('✅ 網站已建立:', websiteId);
    }

    console.log('\n2️⃣ 檢查 Brand Voice 設定...');
    const { data: brandVoice } = await supabase
      .from('brand_voices')
      .select('*')
      .eq('website_id', websiteId)
      .single();

    if (!brandVoice) {
      console.log('建立預設 Brand Voice...');
      const { error: brandError } = await supabase
        .from('brand_voices')
        .insert({
          website_id: websiteId,
          tone: 'professional',
          style: 'informative',
          vocabulary_level: 'advanced',
          point_of_view: 'third_person',
          target_audience: 'professionals and business owners',
          key_messages: ['AI automation', 'content quality', 'efficiency'],
          avoid_topics: ['politics', 'religion']
        });

      if (brandError) {
        console.error('❌ 建立 Brand Voice 失敗:', brandError);
      } else {
        console.log('✅ Brand Voice 已建立');
      }
    } else {
      console.log('✅ Brand Voice 已存在');
    }

    console.log('\n3️⃣ 檢查 Workflow Settings...');
    const { data: workflow } = await supabase
      .from('workflow_settings')
      .select('*')
      .eq('website_id', websiteId)
      .single();

    if (!workflow) {
      console.log('建立預設 Workflow Settings...');
      const { error: workflowError } = await supabase
        .from('workflow_settings')
        .insert({
          website_id: websiteId,
          competitor_count: 5,
          content_length_min: 1500,
          content_length_max: 3000,
          quality_threshold: 80,
          keyword_density_min: 0.01,
          keyword_density_max: 0.03,
          auto_publish: false
        });

      if (workflowError) {
        console.error('❌ 建立 Workflow Settings 失敗:', workflowError);
      } else {
        console.log('✅ Workflow Settings 已建立');
      }
    } else {
      console.log('✅ Workflow Settings 已存在');
    }

    console.log('\n4️⃣ 檢查 AI Model Preferences...');
    const { data: company } = await supabase
      .from('companies')
      .select('ai_model_preferences')
      .eq('id', companyId)
      .single();

    if (!company?.ai_model_preferences) {
      console.log('設定預設 AI Model Preferences...');
      const { error: modelError } = await supabase
        .from('companies')
        .update({
          ai_model_preferences: {
            text_model: 'openai/gpt-4o',
            research_model: 'openai/gpt-4o',
            meta_model: 'google/gemini-2.0-flash-exp:free',
            image_model: 'none'
          }
        })
        .eq('id', companyId);

      if (modelError) {
        console.error('❌ 設定 AI Model 失敗:', modelError);
      } else {
        console.log('✅ AI Model Preferences 已設定');
      }
    } else {
      console.log('✅ AI Model Preferences 已存在');
    }

    console.log('\n5️⃣ WordPress 設定 (可選)');
    const setupWP = await question('是否要設定 WordPress 整合? (y/n): ');

    if (setupWP.toLowerCase() === 'y') {
      console.log('\nWordPress 認證方式：');
      console.log('  1. Application Password (推薦)');
      console.log('  2. JWT Token');
      console.log('  3. OAuth 2.0');

      const authType = await question('請選擇認證方式 (1-3): ');

      const wpUrl = await question('WordPress 網址: ');

      let wpConfig: any = { url: wpUrl };

      if (authType === '1') {
        const username = await question('WordPress 使用者名稱: ');
        const appPassword = await question('Application Password: ');
        wpConfig = {
          ...wpConfig,
          username,
          applicationPassword: appPassword
        };
      } else if (authType === '2') {
        const jwtToken = await question('JWT Token: ');
        wpConfig = {
          ...wpConfig,
          jwtToken
        };
      } else if (authType === '3') {
        const accessToken = await question('Access Token: ');
        const refreshToken = await question('Refresh Token (可選): ');
        wpConfig = {
          ...wpConfig,
          accessToken,
          refreshToken: refreshToken || undefined
        };
      }

      const { error: wpError } = await supabase
        .from('websites')
        .update({ wordpress_config: wpConfig })
        .eq('id', websiteId);

      if (wpError) {
        console.error('❌ 設定 WordPress 失敗:', wpError);
      } else {
        console.log('✅ WordPress 設定已儲存');
      }
    }

    console.log('\n✨ 設定完成！');
    console.log('\n📋 網站資訊：');
    console.log(`  - 網站 ID: ${websiteId}`);
    console.log(`  - 公司 ID: ${companyId}`);
    console.log(`  - URL: https://x-marks.com`);
    console.log('\n現在可以執行測試腳本：');
    console.log('  npx tsx scripts/test-manual-workflow.ts');

  } catch (error) {
    console.error('❌ 設定失敗:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupWebsite();
