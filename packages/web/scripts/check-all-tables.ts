import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAllTables() {
  console.log('🔍 檢查所有文章相關的表...\n')

  console.log('1️⃣ article_jobs 表:')
  const { data: jobs, count: jobsCount } = await supabase
    .from('article_jobs')
    .select('*', { count: 'exact' })
    .limit(5)
  console.log(`   總數: ${jobsCount}`)
  if (jobs && jobs.length > 0) {
    console.log('   範例:', jobs[0])
  }
  console.log()

  console.log('2️⃣ generated_articles 表:')
  const { data: genArticles, count: genCount } = await supabase
    .from('generated_articles')
    .select('*', { count: 'exact' })
    .limit(5)
  console.log(`   總數: ${genCount}`)
  if (genArticles && genArticles.length > 0) {
    console.log('   範例:', genArticles[0])
  }
  console.log()

  console.log('3️⃣ articles 表 (如果存在):')
  const { data: articles, count: articlesCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .limit(5)
    .then(res => res)
    .catch(() => ({ data: null, count: null }))

  if (articles !== null) {
    console.log(`   總數: ${articlesCount}`)
    if (articles && articles.length > 0) {
      console.log('   範例:', articles[0])
    }
  } else {
    console.log('   表不存在或無權限')
  }
  console.log()

  console.log('✅ 檢查完成')
}

checkAllTables().catch(console.error)
