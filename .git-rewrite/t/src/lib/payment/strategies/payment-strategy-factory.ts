/**
 * 支付策略工廠
 */

import { PaymentStrategy, PaymentProduct } from './payment-strategy.interface'
import { TokenPackageStrategy } from './token-package-strategy'
import { SubscriptionStrategy } from './subscription-strategy'
import { LifetimeStrategy } from './lifetime-strategy'

export class PaymentStrategyFactory {
  private strategies: Map<PaymentProduct, PaymentStrategy>

  constructor(private supabase: any) {
    this.strategies = new Map()
    this.initializeStrategies()
  }

  /**
   * 初始化所有策略
   */
  private initializeStrategies(): void {
    this.strategies.set('token_package', new TokenPackageStrategy())
    this.strategies.set('subscription', new SubscriptionStrategy(this.supabase))
    this.strategies.set('lifetime', new LifetimeStrategy(this.supabase))
  }

  /**
   * 根據產品類型獲取策略
   */
  getStrategy(productType: PaymentProduct): PaymentStrategy | null {
    const strategy = this.strategies.get(productType)

    if (!strategy) {
      console.error('No strategy found for product type:', productType)
      return null
    }

    return strategy
  }

  /**
   * 註冊自定義策略
   */
  registerStrategy(productType: PaymentProduct, strategy: PaymentStrategy): void {
    this.strategies.set(productType, strategy)
  }

  /**
   * 從支付數據推斷產品類型
   */
  inferProductType(paymentData: any): PaymentProduct | null {
    // 從 ItemDesc 推斷
    const itemDesc = paymentData.ItemDesc?.toLowerCase() || ''

    if (itemDesc.includes('token') || itemDesc.includes('點數')) {
      return 'token_package'
    }

    if (itemDesc.includes('lifetime') || itemDesc.includes('終身')) {
      return 'lifetime'
    }

    if (itemDesc.includes('monthly') || itemDesc.includes('月費')) {
      return 'subscription'
    }

    if (itemDesc.includes('annual') || itemDesc.includes('年費')) {
      return 'subscription'
    }

    // 從金額推斷
    const amount = paymentData.Amt
    if (amount === 1999) {
      return 'subscription' // monthly
    }

    if (amount === 9999) {
      // 可能是年費或終身，需要更多上下文
      if (itemDesc.includes('訂閱') || itemDesc.includes('subscription')) {
        return 'subscription'
      }
      return 'lifetime'
    }

    // 默認為 token package
    if (amount > 0) {
      return 'token_package'
    }

    return null
  }
}