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

async function clearPendingJobs() {
  console.log('開始清理 pending 和 processing 狀態的任務...\n')

  const { data: pendingJobs, error: queryError } = await supabase
    .from('article_jobs')
    .select('id, status, keywords, created_at')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })

  if (queryError) {
    console.error('查詢錯誤:', queryError)
    process.exit(1)
  }

  console.log(`找到 ${pendingJobs?.length || 0} 個 pending/processing 任務:\n`)

  if (pendingJobs && pendingJobs.length > 0) {
    pendingJobs.forEach((job, index) => {
      console.log(`${index + 1}. ID: ${job.id.substring(0, 8)}... | 狀態: ${job.status} | 關鍵字: ${job.keywords.join(', ')}`)
    })

    console.log('\n開始刪除...\n')

    const { data: deletedJobs, error: deleteError } = await supabase
      .from('article_jobs')
      .delete()
      .in('status', ['pending', 'processing'])
      .select('id, status')

    if (deleteError) {
      console.error('刪除錯誤:', deleteError)
      process.exit(1)
    }

    console.log(`✅ 成功刪除 ${deletedJobs?.length || 0} 個任務`)

    if (deletedJobs) {
      deletedJobs.forEach((job, index) => {
        console.log(`${index + 1}. 已刪除 ID: ${job.id.substring(0, 8)}... (${job.status})`)
      })
    }
  } else {
    console.log('沒有找到需要清理的任務')
  }

  console.log('\n✅ 清理完成')
}

clearPendingJobs().catch(console.error)
