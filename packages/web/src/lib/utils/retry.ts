import {
  InsufficientBalanceError,
  DeductionInProgressError,
  MaxRetriesExceededError,
} from '../billing/errors'
import type {
  TokenBillingService,
  DeductTokensIdempotentParams,
  DeductTokensResult,
} from '../billing/token-billing-service'

export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  shouldRetry: (error: Error) => boolean
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry } = options
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (!shouldRetry(lastError)) {
        throw lastError
      }

      if (attempt === maxRetries) {
        throw new MaxRetriesExceededError(
          `Operation failed after ${maxRetries} retries: ${lastError.message}`,
          lastError
        )
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
      console.log(
        `[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`,
        lastError.message
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

export async function deductTokensWithRetry(
  service: TokenBillingService,
  params: DeductTokensIdempotentParams
): Promise<DeductTokensResult> {
  return retryWithExponentialBackoff(
    () => service.deductTokensIdempotent(params),
    {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      shouldRetry: (error) => {
        if (error instanceof InsufficientBalanceError) return false
        if (error instanceof DeductionInProgressError) return false

        return true
      },
    }
  )
}
