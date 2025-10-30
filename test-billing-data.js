const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testBillingData() {
  console.log('🔍 測試 Token 計費系統資料...\n')

  try {
    // 測試訂閱方案
    console.log('1️⃣  訂閱方案 (subscription_plans):')
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('is_lifetime', { ascending: true })
      .order('monthly_price', { ascending: true })

    if (plansError) throw new Error(`訂閱方案錯誤: ${plansError.message}`)

    const monthlyPlans = plans.filter(p => !p.is_lifetime)
    const lifetimePlans = plans.filter(p => p.is_lifetime)

    console.log(`   ✅ 月費方案: ${monthlyPlans.length} 個`)
    monthlyPlans.forEach(p => console.log(`      - ${p.name}: NT$ ${p.monthly_price} / ${p.base_tokens} tokens`))

    console.log(`   ✅ 終身方案: ${lifetimePlans.length} 個`)
    lifetimePlans.forEach(p => console.log(`      - ${p.name}: NT$ ${p.lifetime_price} / ${p.base_tokens} tokens/月`))
    console.log()

    // 測試 Token 購買包
    console.log('2️⃣  Token 購買包 (token_packages):')
    const { data: packages, error: packagesError } = await supabase
      .from('token_packages')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })

    if (packagesError) throw new Error(`Token 包錯誤: ${packagesError.message}`)

    console.log(`   ✅ 購買包數量: ${packages.length} 個`)
    packages.forEach(p => console.log(`      - ${p.name}: ${p.tokens.toLocaleString()} tokens - NT$ ${p.price}`))
    console.log()

    // 測試 AI 模型定價
    console.log('3️⃣  AI 模型定價 (ai_model_pricing):')
    const { data: models, error: modelsError } = await supabase
      .from('ai_model_pricing')
      .select('*')
      .eq('is_active', true)
      .order('tier', { ascending: true })
      .order('model_name', { ascending: true })

    if (modelsError) throw new Error(`AI 模型錯誤: ${modelsError.message}`)

    const basicModels = models.filter(m => m.tier === 'basic')
    const advancedModels = models.filter(m => m.tier === 'advanced')

    console.log(`   ✅ 基礎模型: ${basicModels.length} 個`)
    basicModels.forEach(m => console.log(`      - ${m.model_name} (${m.provider}): ${m.multiplier}x`))

    console.log(`   ✅ 進階模型: ${advancedModels.length} 個`)
    advancedModels.forEach(m => console.log(`      - ${m.model_name} (${m.provider}): ${m.multiplier}x`))
    console.log()

    // 驗證結果
    console.log('📊 驗證結果:')
    const checks = [
      { name: '訂閱方案', expected: 7, actual: plans.length, pass: plans.length === 7 },
      { name: 'Token 包', expected: 6, actual: packages.length, pass: packages.length === 6 },
      { name: 'AI 模型', expected: 8, actual: models.length, pass: models.length === 8 },
    ]

    checks.forEach(check => {
      const icon = check.pass ? '✅' : '❌'
      console.log(`   ${icon} ${check.name}: ${check.actual}/${check.expected}`)
    })

    const allPassed = checks.every(c => c.pass)
    console.log()
    if (allPassed) {
      console.log('🎉 所有測試通過！Token 計費系統資料完整。')
    } else {
      console.log('⚠️  部分測試失敗，請檢查資料庫。')
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error)
    process.exit(1)
  }
}

testBillingData()
