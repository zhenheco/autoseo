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

async function verifyData() {
  console.log('📊 驗證文章和任務資料...\n')

  const { data: jobs, error: jobsError } = await supabase
    .from('article_jobs')
    .select('id, status, keywords')
    .order('created_at', { ascending: false })

  if (jobsError) {
    console.error('查詢任務錯誤:', jobsError)
  } else {
    console.log(`任務總數: ${jobs?.length || 0}`)
    const statusCount = jobs?.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log('任務狀態統計:', statusCount)
    console.log()
  }

  const { data: articles, error: articlesError } = await supabase
    .from('generated_articles')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (articlesError) {
    console.error('查詢文章錯誤:', articlesError)
  } else {
    console.log(`\n最近 10 篇文章:`)
    articles?.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title || '(無標題)'} - 狀態: ${article.status}`)
    })
  }

  console.log('\n✅ 驗證完成')
}

verifyData().catch(console.error)
