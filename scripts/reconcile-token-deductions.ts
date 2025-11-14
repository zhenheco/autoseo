import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

async function reconcileStuckDeductions() {
  const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000)

  console.log('[Reconciliation] Starting reconciliation process...')

  const { data: stuckRecords, error } = await supabase
    .from('token_deduction_records')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', ONE_HOUR_AGO.toISOString())

  if (error) {
    console.error('[Reconciliation] Failed to fetch stuck records:', error)
    return
  }

  console.log(`[Reconciliation] Found ${stuckRecords?.length || 0} stuck deduction records`)

  for (const record of stuckRecords || []) {
    try {
      if (record.article_id) {
        const { data: article } = await supabase
          .from('generated_articles')
          .select('id')
          .eq('id', record.article_id)
          .single()

        if (article) {
          console.log(`[Reconciliation] Retrying deduction for record ${record.id}`)
          await retryStuckDeduction(record)
        } else {
          console.log(
            `[Reconciliation] Article not found for record ${record.id}, marking as failed`
          )
          await supabase
            .from('token_deduction_records')
            .update({
              status: 'failed',
              error_message: 'Article not found, likely generation failed',
            })
            .eq('id', record.id)
        }
      } else {
        console.log(
          `[Reconciliation] No article_id for record ${record.id}, marking as failed`
        )
        await supabase
          .from('token_deduction_records')
          .update({
            status: 'failed',
            error_message: 'No article_id provided',
          })
          .eq('id', record.id)
      }
    } catch (error) {
      console.error(`[Reconciliation] Failed to reconcile record ${record.id}:`, error)
    }
  }

  console.log('[Reconciliation] Reconciliation process completed')
}

async function retryStuckDeduction(record: Database['public']['Tables']['token_deduction_records']['Row']) {
  const { data, error } = await supabase.rpc('deduct_tokens_atomic', {
    p_idempotency_key: record.idempotency_key,
    p_company_id: record.company_id,
    p_article_id: record.article_id || null,
    p_amount: record.amount,
  })

  if (error) {
    console.error(`[Reconciliation] Retry failed for record ${record.id}:`, error.message)
    await supabase
      .from('token_deduction_records')
      .update({
        status: 'failed',
        error_message: `Retry failed: ${error.message}`,
      })
      .eq('id', record.id)
  } else {
    console.log(`[Reconciliation] Successfully retried record ${record.id}`)
  }
}

if (require.main === module) {
  reconcileStuckDeductions()
    .then(() => {
      console.log('[Reconciliation] Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('[Reconciliation] Script failed:', error)
      process.exit(1)
    })
}

export { reconcileStuckDeductions }
