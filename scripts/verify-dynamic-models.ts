import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function verifyDynamicModels() {
  console.log('🔍 驗證動態模型系統...\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  const supabase = createClient(supabaseUrl, supabaseKey);

  results.total++;
  try {
    const { data, error } = await supabase
      .from('ai_models')
      .select('count');

    if (error) throw error;

    console.log(`✅ 資料表存在且可讀取`);
    results.passed++;
  } catch (error: any) {
    console.log(`❌ 資料表讀取失敗: ${error.message || error}`);
    results.failed++;
  }

  results.total++;
  try {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('model_type', 'text')
      .eq('is_active', true);

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ 文字模型載入成功 (${data.length} 個)`);
      results.passed++;
    } else {
      console.log(`❌ 沒有找到文字模型`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ 文字模型載入失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('model_type', 'image')
      .eq('is_active', true);

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ 圖片模型載入成功 (${data.length} 個)`);
      results.passed++;
    } else {
      console.log(`❌ 沒有找到圖片模型`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ 圖片模型載入失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('provider', 'openai');

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ OpenAI 模型載入成功 (${data.length} 個)`);
      results.passed++;
    } else {
      console.log(`❌ 沒有找到 OpenAI 模型`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ OpenAI 模型載入失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('model_id', 'nano-banana');

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ nano-banana 模型存在`);
      results.passed++;
    } else {
      console.log(`❌ nano-banana 模型不存在`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ nano-banana 模型查詢失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('model_id', 'chatgpt-image-mini');

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ chatgpt-image-mini 模型存在`);
      results.passed++;
    } else {
      console.log(`❌ chatgpt-image-mini 模型不存在`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ chatgpt-image-mini 模型查詢失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const { data, error } = await supabase.rpc('get_active_text_models');

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ get_active_text_models() 函數正常 (${data.length} 個)`);
      results.passed++;
    } else {
      console.log(`❌ get_active_text_models() 無返回資料`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ get_active_text_models() 函數失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const { data, error } = await supabase.rpc('get_active_image_models');

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ get_active_image_models() 函數正常 (${data.length} 個)`);
      results.passed++;
    } else {
      console.log(`❌ get_active_image_models() 無返回資料`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ get_active_image_models() 函數失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const { data, error } = await supabase.rpc('get_models_by_provider', {
      p_provider: 'openai',
    });

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ get_models_by_provider() 函數正常 (${data.length} 個)`);
      results.passed++;
    } else {
      console.log(`❌ get_models_by_provider() 無返回資料`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ get_models_by_provider() 函數失敗: ${error}`);
    results.failed++;
  }

  const successRate = (results.passed / results.total) * 100;
  console.log(`\n📊 驗證結果: ${results.passed}/${results.total} (${successRate.toFixed(1)}%)`);

  if (successRate >= 90) {
    console.log('✅ 動態模型系統驗證通過 (≥90%)');
    return true;
  } else {
    console.log(`❌ 動態模型系統驗證失敗 (<90%)`);
    return false;
  }
}

verifyDynamicModels()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('驗證過程發生錯誤:', error);
    process.exit(1);
  });
