import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function resetToFree() {
  console.log('查詢所有公司...')

  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name, subscription_tier')
    .order('created_at', { ascending: false })
    .limit(5)

  if (fetchError) {
    console.error('查詢失敗:', fetchError)
    return
  }

  console.log('\n找到的公司:')
  companies?.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.id}) - 目前方案: ${c.subscription_tier}`)
  })

  if (!companies || companies.length === 0) {
    console.log('沒有找到公司')
    return
  }

  // 更新第一個公司為 free
  const company = companies[0]
  console.log(`\n正在將 "${company.name}" 重置為 free 方案...`)

  const { data: updated, error: updateError } = await supabase
    .from('companies')
    .update({ subscription_tier: 'free' })
    .eq('id', company.id)
    .select()
    .single()

  if (updateError) {
    console.error('更新失敗:', updateError)
    return
  }

  console.log('\n✅ 成功重置為 free 方案!')
  console.log('更新結果:', {
    id: updated.id,
    name: updated.name,
    subscription_tier: updated.subscription_tier
  })
}

resetToFree().catch(console.error)
