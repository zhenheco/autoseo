require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function listClaudeModels() {
  const { data: models, error } = await supabase
    .from('ai_models')
    .select('id, model_name, model_id')
    .eq('provider', 'anthropic')
    .order('model_id')

  if (error) {
    console.error('查詢失敗:', error)
    return
  }

  console.log('資料庫中的 Claude 模型:')
  models.forEach(m => console.log(`  - [${m.id}] ${m.model_name} (${m.model_id})`))
}

listClaudeModels()
