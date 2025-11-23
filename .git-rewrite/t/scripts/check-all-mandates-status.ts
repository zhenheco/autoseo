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

async function checkAllMandates() {
  console.log('🔍 查詢所有 mandates...\n')

  const { data: mandates, error } = await supabase
    .from('recurring_mandates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    console.error('❌ 查詢失敗:', error)
    return
  }

  if (!mandates || mandates.length === 0) {
    console.log('❌ 沒有找到任何 mandates')
    return
  }

  console.log(`找到 ${mandates.length} 個 mandates:\n`)

  for (const mandate of mandates) {
    console.log(`📋 Mandate: ${mandate.mandate_no}`)
    console.log(`  ID: ${mandate.id}`)
    console.log(`  狀態: ${mandate.status}`)
    console.log(`  公司 ID: ${mandate.company_id}`)
    console.log(`  方案 ID: ${mandate.plan_id}`)
    console.log(`  建立時間: ${mandate.created_at}`)
    console.log(`  啟用時間: ${mandate.activated_at || 'NULL'}`)
    console.log()
  }

  // 按狀態分組統計
  const statusCounts = mandates.reduce((acc: any, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    return acc
  }, {})

  console.log('📊 統計:')
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })
}

checkAllMandates()
  .catch(console.error)
  .finally(() => process.exit(0))
