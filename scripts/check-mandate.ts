#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function checkData() {
  console.log('🔍 檢查資料庫狀態...\n')

  console.log('1. 檢查 companies 表結構')
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .limit(1)

  if (companyError) {
    console.error('❌ 查詢 companies 失敗:', companyError)
  } else if (companies && companies.length > 0) {
    console.log('✅ companies 表欄位:', Object.keys(companies[0]))

    const hasSubscriptionFields =
      'subscription_ends_at' in companies[0] &&
      'seo_token_balance' in companies[0]

    console.log(hasSubscriptionFields ?
      '✅ 訂閱欄位存在 (subscription_ends_at, seo_token_balance)' :
      '❌ 缺少訂閱欄位 - 需要執行 migration！'
    )
  }

  console.log('\n2. 檢查最近的 recurring_mandates')
  const { data: mandates } = await supabase
    .from('recurring_mandates')
    .select('mandate_no, id, status, company_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (mandates && mandates.length > 0) {
    console.log(`✅ 找到 ${mandates.length} 筆 mandates:`)
    mandates.forEach((m, i) => {
      console.log(`  ${i + 1}. mandate_no: ${m.mandate_no}, status: ${m.status}, created: ${m.created_at}`)
    })
  } else {
    console.log('⚠️  沒有找到任何 mandates')
  }

  console.log('\n3. 查詢特定 mandate: MAN17621498992740331')
  const { data: specificMandate, error: mandateError } = await supabase
    .from('recurring_mandates')
    .select('*')
    .eq('mandate_no', 'MAN17621498992740331')
    .maybeSingle()

  if (mandateError) {
    console.error('❌ 查詢失敗:', mandateError)
  } else if (specificMandate) {
    console.log('✅ 找到 mandate:', {
      id: specificMandate.id,
      status: specificMandate.status,
      company_id: specificMandate.company_id,
      created_at: specificMandate.created_at
    })
  } else {
    console.log('❌ 找不到此 mandate')
  }

  console.log('\n4. 檢查 ace@zhenhe-co.com 的公司資料')
  const { data: userData } = await supabase.auth.admin.listUsers()
  const user = userData?.users.find(u => u.email === 'ace@zhenhe-co.com')

  if (user) {
    const { data: member } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (member) {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', member.company_id)
        .single()

      if (company) {
        console.log('✅ 公司資料:')
        console.log('  - 公司名稱:', company.name)
        console.log('  - subscription_tier:', company.subscription_tier || '(欄位不存在)')
        console.log('  - subscription_ends_at:', company.subscription_ends_at || '(欄位不存在或 NULL)')
        console.log('  - seo_token_balance:', company.seo_token_balance || '(欄位不存在)')
      }
    }
  }
}

checkData()
  .catch(console.error)
  .finally(() => process.exit(0))
