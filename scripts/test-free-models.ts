/**
 * 測試全免費模型配置
 * 驗證零成本方案的可行性
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 全免費配置（根據 FREE_MODELS_ANALYSIS.md 的限制）
const freeConfigurations = {
  // 配置 A: Google + Meta 組合（推薦）
  googleMeta: {
    name: 'Google-Meta 免費組合',
    models: {
      research_model: 'google/gemini-2.0-flash-exp:free',    // 15 RPM, 1.5M TPM
      strategy_model: 'google/gemini-2.0-flash-exp:free',    // 15 RPM, 1.5M TPM
      writing_model: 'meta-llama/llama-4-maverick:free',     // 30 RPM, 500K TPM
      meta_model: 'meta-llama/llama-4-maverick:free',        // 30 RPM, 500K TPM
      image_model: 'none'
    },
    limits: {
      totalRPM: 15, // 受限於 Google (最低)
      estimatedTime: '2-3分鐘/篇'
    }
  },

  // 配置 B: 純 Meta Llama（最高 RPM）
  pureLlama: {
    name: '純 Meta Llama 配置',
    models: {
      research_model: 'meta-llama/llama-4-maverick:free',    // 30 RPM
      strategy_model: 'meta-llama/llama-4-maverick:free',    // 30 RPM
      writing_model: 'meta-llama/llama-4-maverick:free',     // 30 RPM
      meta_model: 'meta-llama/llama-4-maverick:free',        // 30 RPM
      image_model: 'none'
    },
    limits: {
      totalRPM: 30,
      estimatedTime: '1-2分鐘/篇'
    }
  },

  // 配置 C: 混合免費模型（實驗性）
  mixed: {
    name: '混合免費模型',
    models: {
      research_model: 'google/gemini-2.0-flash-exp:free',    // 15 RPM
      strategy_model: 'huggingface/qwen/qwen-2.5-72b-instruct:free', // 未知 RPM
      writing_model: 'meta-llama/llama-4-maverick:free',     // 30 RPM
      meta_model: 'z-ai/glm-4.5-air:free',                  // 20 RPM, 200K TPM
      image_model: 'none'
    },
    limits: {
      totalRPM: 15, // 受限於最低者
      estimatedTime: '2-3分鐘/篇'
    }
  }
};

async function testFreeConfiguration(configName: string, config: any) {
  console.log(`\n🧪 測試配置: ${config.name}`);
  console.log('━'.repeat(60));
  console.log('📊 模型配置:');
  Object.entries(config.models).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log(`⏱️  預估速度: ${config.limits.estimatedTime}`);
  console.log(`🔄 RPM 限制: ${config.limits.totalRPM} 請求/分鐘`);

  try {
    // 更新公司配置
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .limit(1)
      .single();

    if (!company) {
      throw new Error('找不到測試公司');
    }

    await supabase
      .from('companies')
      .update({
        ai_model_preferences: config.models
      })
      .eq('id', company.id);

    console.log('✅ 配置已更新');

    // 計算理論成本和處理能力
    const articlesPerHour = Math.floor(60 / 2); // 假設每篇需要 2 分鐘
    const articlesPerDay = articlesPerHour * 8; // 8 小時工作日
    const articlesPerMonth = articlesPerDay * 22; // 22 工作日

    console.log('\n📈 處理能力預估:');
    console.log(`  每小時: ${articlesPerHour} 篇`);
    console.log(`  每日: ${articlesPerDay} 篇`);
    console.log(`  每月: ${articlesPerMonth} 篇`);
    console.log(`  💰 成本: $0 (完全免費)`);
    console.log(`  💵 虛擬收入: $${(articlesPerMonth * 0.15).toFixed(2)}/月 (按 GPT-5 價格)`);

    return {
      name: config.name,
      success: true,
      articlesPerMonth,
      virtualRevenue: articlesPerMonth * 0.15
    };

  } catch (error) {
    console.error(`❌ 測試失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    return {
      name: config.name,
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    };
  }
}

async function main() {
  console.log('🚀 開始全免費模型配置測試');
  console.log('═'.repeat(60));
  console.log('\n📋 基於 FREE_MODELS_ANALYSIS.md 的限制數據:');
  console.log('  - Google Gemini Flash: 15 RPM / 1.5M TPM');
  console.log('  - Meta Llama 4: 30 RPM / 500K TPM');
  console.log('  - Zhipu GLM-4.5: 20 RPM / 200K TPM');
  console.log('  - DeepSeek: 隱私限制，不建議使用');

  const results = [];

  // 測試所有配置
  for (const [key, config] of Object.entries(freeConfigurations)) {
    const result = await testFreeConfiguration(key, config);
    results.push(result);

    // 等待避免 rate limit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 生成報告
  console.log('\n\n📊 測試結果總結');
  console.log('═'.repeat(60));
  console.log('\n| 配置名稱 | 狀態 | 月產能 | 虛擬收入 |');
  console.log('|---------|------|-------|---------|');

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const articles = result.articlesPerMonth || 0;
    const revenue = result.virtualRevenue ? `$${result.virtualRevenue.toFixed(2)}` : 'N/A';
    console.log(`| ${result.name} | ${status} | ${articles} 篇 | ${revenue} |`);
  });

  // 推薦方案
  console.log('\n\n🎯 推薦方案');
  console.log('━'.repeat(60));
  console.log('\n1. 個人專案/測試: 純 Meta Llama 配置');
  console.log('   - 最高 RPM (30)');
  console.log('   - 品質穩定');
  console.log('   - 無隱私問題');

  console.log('\n2. 小型商業: Google-Meta 組合');
  console.log('   - Google 用於分析 (品質較高)');
  console.log('   - Meta 用於生成 (速度較快)');
  console.log('   - 平衡品質與速度');

  console.log('\n3. 實驗性: 混合配置');
  console.log('   - 測試不同模型組合');
  console.log('   - 可能有更好的效果');
  console.log('   - 需要更多測試');

  console.log('\n⚠️ 注意事項:');
  console.log('  1. 免費模型有請求速率限制，需要實作隊列系統');
  console.log('  2. Token 限制可能影響長文章生成');
  console.log('  3. 建議保留付費 fallback 方案');
  console.log('  4. 定期監控模型可用性和品質');
}

main().catch(console.error);