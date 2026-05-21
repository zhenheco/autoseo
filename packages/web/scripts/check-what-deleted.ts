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

async function checkDeleted() {
  console.log('🔍 檢查刪除記錄...\n')

  // 檢查 article_jobs 表
  console.log('1️⃣ article_jobs 表:')
  const { data: allJobs, error: jobsError } = await supabase
    .from('article_jobs')
    .select('id, status, keywords, created_at')
    .order('created_at', { ascending: false })

  if (jobsError) {
    console.error('   查詢錯誤:', jobsError)
  } else {
    console.log(`   總數: ${allJobs?.length || 0}`)

    const byStatus = allJobs?.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('   狀態統計:', byStatus || {})

    if (allJobs && allJobs.length > 0) {
      console.log('\n   所有任務:')
      allJobs.forEach((job, i) => {
        console.log(`   ${i + 1}. ${job.status} - ${job.keywords.join(', ')}`)
      })
    }
  }
  console.log()

  // 檢查 generated_articles 表
  console.log('2️⃣ generated_articles 表:')
  const { data: allArticles, error: articlesError } = await supabase
    .from('generated_articles')
    .select('id, title, status, article_job_id, created_at')
    .order('created_at', { ascending: false })

  if (articlesError) {
    console.error('   查詢錯誤:', articlesError)
  } else {
    console.log(`   總數: ${allArticles?.length || 0}`)

    if (allArticles && allArticles.length > 0) {
      console.log('\n   所有文章:')
      allArticles.forEach((article, i) => {
        console.log(`   ${i + 1}. ${article.title || '(無標題)'} - 狀態: ${article.status}`)
        console.log(`       Job ID: ${article.article_job_id?.substring(0, 8) || 'N/A'}`)
      })
    }
  }

  console.log('\n✅ 檢查完成')
}

checkDeleted().catch(console.error)
