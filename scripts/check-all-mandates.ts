#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkAllMandates() {
  console.log('🔍 檢查所有 mandates...\n')

  const { data: mandates } = await supabase
    .from('recurring_mandates')
    .select('*')
    .eq('company_id', '50f68bb1-2525-472f-bf09-17379aa5fdbd')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!mandates || mandates.length === 0) {
    console.log('❌ 沒有找到任何 mandates')
    return
  }

  console.log(`找到 ${mandates.length} 個 mandates:\n`)
  
  for (const m of mandates) {
    console.log(`📋 ${m.mandate_no}`)
    console.log(`   Status: ${m.status}`)
    console.log(`   Created: ${m.created_at}`)
    console.log(`   Activated: ${m.activated_at || 'NULL'}`)
    console.log(`   Response: ${m.newebpay_response ? 'YES' : 'NULL'}`)
    console.log()
  }
}

checkAllMandates().finally(() => process.exit(0))
