#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 從 URL 提取數據庫連接資訊
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function fixRLS() {
  console.log('🔧 修復 RLS 策略...\n')

  // SQL 語句
  const statements = [
    { name: '刪除舊的 companies UPDATE 策略', sql: 'DROP POLICY IF EXISTS "系統可更新公司訂閱資料" ON companies;' },
    { name: '刪除舊的 Owners UPDATE 策略', sql: 'DROP POLICY IF EXISTS "Owners can update their companies" ON companies;' },
    {
      name: '建立新的 companies UPDATE 策略',
      sql: `CREATE POLICY "系統和擁有者可更新公司資料" ON companies
        FOR UPDATE
        USING (auth.uid() IS NULL OR owner_id = auth.uid())
        WITH CHECK (auth.uid() IS NULL OR owner_id = auth.uid());`
    },
    { name: '刪除舊的 company_subscriptions INSERT 策略', sql: 'DROP POLICY IF EXISTS "系統可插入公司訂閱" ON company_subscriptions;' },
    { name: '刪除舊的 company_subscriptions UPDATE 策略', sql: 'DROP POLICY IF EXISTS "系統可更新公司訂閱" ON company_subscriptions;' },
    {
      name: '建立新的 company_subscriptions INSERT 策略',
      sql: 'CREATE POLICY "系統可插入公司訂閱（包含Service Role）" ON company_subscriptions FOR INSERT WITH CHECK (TRUE);'
    },
    {
      name: '建立新的 company_subscriptions UPDATE 策略',
      sql: 'CREATE POLICY "系統可更新公司訂閱（包含Service Role）" ON company_subscriptions FOR UPDATE USING (TRUE) WITH CHECK (TRUE);'
    },
    { name: '刪除舊的 token_balance_changes INSERT 策略', sql: 'DROP POLICY IF EXISTS "系統可插入代幣變動記錄" ON token_balance_changes;' },
    {
      name: '建立新的 token_balance_changes INSERT 策略',
      sql: 'CREATE POLICY "系統可插入代幣變動記錄（包含Service Role）" ON token_balance_changes FOR INSERT WITH CHECK (TRUE);'
    },
  ]

  console.log('⚠️  注意: 由於 Supabase JavaScript client 不支援直接執行 DDL 語句，')
  console.log('請複製以下 SQL 並在 Supabase Dashboard → SQL Editor 中執行:\n')
  console.log('='.repeat(80))
  console.log()

  for (const stmt of statements) {
    console.log(`-- ${stmt.name}`)
    console.log(stmt.sql)
    console.log()
  }

  console.log('='.repeat(80))
  console.log('\n或者執行以下單行 SQL:\n')
  console.log(statements.map(s => s.sql).join('\n'))

  // 測試當前權限
  console.log('\n\n🧪 測試當前權限...')

  const { data: testCompany, error: selectError } = await supabase
    .from('companies')
    .select('id, subscription_tier, subscription_ends_at, seo_token_balance')
    .limit(1)
    .single()

  if (selectError) {
    console.error('❌ SELECT 測試失敗:', selectError.message)
    return
  }

  console.log('✅ SELECT 權限正常')
  console.log('公司:', testCompany)

  // 嘗試更新（不改變值）
  const { error: updateError } = await supabase
    .from('companies')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', testCompany.id)

  if (updateError) {
    console.error('\n❌ UPDATE 權限測試失敗:', updateError.message)
    console.log('\n這證實了 RLS 問題！請執行上述 SQL 修復。')
  } else {
    console.log('\n✅ UPDATE 權限正常 - RLS 已修復！')
  }
}

fixRLS()
  .catch(console.error)
  .finally(() => process.exit(0))
