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

async function checkPlans() {
  const { data: plans } = await supabase.from('subscription_plans').select('*')
  console.log('訂閱方案列表:')
  plans?.forEach(p => {
    console.log(`  - ${p.name}: slug="${p.slug}"`)
  })
}

checkPlans().finally(() => process.exit(0))
