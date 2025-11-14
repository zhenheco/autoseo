import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { TokenBillingService } from '@/lib/billing/token-billing-service'
import { deductTokensWithRetry } from '@/lib/utils/retry'
import { InsufficientBalanceError, DeductionInProgressError } from '@/lib/billing/errors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

interface DeductionParams {
  jobId: string
  articleId: string
  amount: number
  companyId: string
}

async function deductTokensForArticle(params: DeductionParams) {
  const { jobId, articleId, amount, companyId } = params

  console.log('[Token Deduction] Starting deduction process...')
  console.log(`[Token Deduction] Job ID: ${jobId}`)
  console.log(`[Token Deduction] Article ID: ${articleId}`)
  console.log(`[Token Deduction] Amount: ${amount}`)
  console.log(`[Token Deduction] Company ID: ${companyId}`)

  const billingService = new TokenBillingService(supabase)

  try {
    const result = await deductTokensWithRetry(billingService, {
      idempotencyKey: jobId,
      companyId,
      articleId,
      amount,
      metadata: {
        source: 'github-actions',
        timestamp: new Date().toISOString(),
      },
    })

    if (result.idempotent) {
      console.log('✅ [Token Deduction] Idempotent request - tokens already deducted')
    } else {
      console.log('✅ [Token Deduction] Tokens deducted successfully')
    }

    console.log(`[Token Deduction] Balance before: ${result.balanceBefore}`)
    console.log(`[Token Deduction] Balance after: ${result.balanceAfter}`)
    console.log(`[Token Deduction] Deducted from monthly: ${result.deductedFromMonthly}`)
    console.log(`[Token Deduction] Deducted from purchased: ${result.deductedFromPurchased}`)
    console.log(`[Token Deduction] Record ID: ${result.recordId}`)

    await supabase
      .from('article_jobs')
      .update({ status: 'completed' })
      .eq('id', jobId)

    return { success: true }
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      console.error('❌ [Token Deduction] Insufficient balance:', error.message)

      await supabase
        .from('article_jobs')
        .update({
          status: 'failed',
          metadata: {
            error: 'insufficient_balance',
            message: error.message,
          },
        })
        .eq('id', jobId)

      return { success: false, error: 'insufficient_balance' }
    }

    if (error instanceof DeductionInProgressError) {
      console.error('❌ [Token Deduction] Deduction in progress:', error.message)

      await supabase
        .from('article_jobs')
        .update({
          status: 'pending_token_deduction',
          metadata: {
            error: 'deduction_in_progress',
            message: error.message,
          },
        })
        .eq('id', jobId)

      return { success: false, error: 'deduction_in_progress' }
    }

    console.error('❌ [Token Deduction] Unexpected error:', error)

    await supabase
      .from('article_jobs')
      .update({
        status: 'pending_token_deduction',
        metadata: {
          error: 'deduction_failed',
          message: (error as Error).message,
        },
      })
      .eq('id', jobId)

    throw error
  }
}

async function main() {
  const jobId = process.env.JOB_ID
  const tokenAmount = process.env.TOKEN_AMOUNT || '15000'

  if (!jobId) {
    console.error('❌ Missing required environment variable: JOB_ID')
    process.exit(1)
  }

  const amount = parseInt(tokenAmount, 10)
  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Invalid TOKEN_AMOUNT:', tokenAmount)
    process.exit(1)
  }

  console.log('[Token Deduction] Querying job details...')

  const { data: job, error: jobError } = await supabase
    .from('article_jobs')
    .select('id, company_id')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    console.error('❌ Failed to find job:', jobId, jobError)
    process.exit(1)
  }

  const { data: article, error: articleError } = await supabase
    .from('generated_articles')
    .select('id')
    .eq('article_job_id', jobId)
    .maybeSingle()

  if (articleError) {
    console.error('⚠️ Warning: Failed to query article:', articleError)
  }

  const articleId = article?.id || ''

  if (!articleId) {
    console.warn('⚠️ Warning: No article found for job, but continuing with deduction...')
  }

  try {
    await deductTokensForArticle({
      jobId,
      articleId,
      amount,
      companyId: job.company_id,
    })

    console.log('✅ [Token Deduction] Script completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ [Token Deduction] Script failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { deductTokensForArticle }
