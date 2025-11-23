#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function runAffiliateMigration() {
  console.log('🚀 聯盟行銷系統 Migration\n')
  console.log('═'.repeat(80))

  // 讀取 SQL 檔案
  const sqlPath = resolve(process.cwd(), 'supabase/migrations/20250115_affiliate_system.sql')
  let sqlContent: string

  try {
    sqlContent = readFileSync(sqlPath, 'utf-8')
    console.log('✅ 已讀取 SQL 檔案\n')
  } catch (error) {
    console.error('❌ 無法讀取 SQL 檔案:', error)
    process.exit(1)
  }

  // 檢查環境變數
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  缺少環境變數\n')
    console.log('請先設定以下環境變數（在 .env.local 檔案中）：')
    console.log('  - NEXT_PUBLIC_SUPABASE_URL')
    console.log('  - SUPABASE_SERVICE_ROLE_KEY\n')
    console.log('─'.repeat(80))
    console.log('\n📋 請在 Supabase Dashboard 的 SQL Editor 中執行以下 SQL：\n')
    console.log('路徑：supabase/migrations/20250115_affiliate_system.sql\n')
    console.log('或直接複製以下內容：\n')
    console.log('─'.repeat(80))
    console.log(sqlContent)
    console.log('─'.repeat(80))
    process.exit(0)
  }

  // 連接 Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('📡 連接到 Supabase...\n')

  // 檢查是否已存在 affiliates 表
  const { data: existingTable, error: checkError } = await supabase
    .from('affiliates')
    .select('id')
    .limit(1)

  if (!checkError) {
    console.log('⚠️  affiliates 表已存在\n')
    console.log('是否要重新執行 migration？(這會刪除現有資料)')
    console.log('請手動在 SQL Editor 中執行\n')
    return
  }

  console.log('📊 開始建立資料表...\n')

  // 由於 Supabase JS 不支援執行多行 SQL，我們需要手動執行
  console.log('⚠️  注意：Supabase JS Client 不支援執行完整的 migration SQL\n')
  console.log('請在 Supabase Dashboard → SQL Editor 中執行以下檔案：')
  console.log('  supabase/migrations/20250115_affiliate_system.sql\n')
  console.log('或使用 Supabase CLI：')
  console.log('  supabase db push\n')
  console.log('─'.repeat(80))
}

runAffiliateMigration().catch((error) => {
  console.error('❌ Migration 失敗:', error)
  process.exit(1)
})
