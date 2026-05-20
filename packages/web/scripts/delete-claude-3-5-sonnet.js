require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function deleteClaudeSonnet() {
  console.log('查詢 claude-3-5-sonnet 模型...')

  const { data: models, error: queryError } = await supabase
    .from('ai_models')
    .select('id, model_name, model_id')
    .ilike('model_id', '%claude-3-5-sonnet%')

  if (queryError) {
    console.error('查詢失敗:', queryError)
    return
  }

  if (!models || models.length === 0) {
    console.log('未找到 claude-3-5-sonnet 模型')
    return
  }

  console.log('找到以下模型:')
  models.forEach(m => console.log(`  - ${m.model_name} (${m.model_id})`))

  const modelIds = models.map(m => m.id)

  console.log('\n刪除這些模型...')
  const { error: deleteError } = await supabase
    .from('ai_models')
    .delete()
    .in('id', modelIds)

  if (deleteError) {
    console.error('刪除失敗:', deleteError)
    return
  }

  console.log('✅ 成功刪除 claude-3-5-sonnet 模型')
}

deleteClaudeSonnet()
