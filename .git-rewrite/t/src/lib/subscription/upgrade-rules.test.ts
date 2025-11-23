import { canUpgrade, getUpgradeBlockReason, TIER_HIERARCHY } from './upgrade-rules'

describe('TIER_HIERARCHY', () => {
  test('階層順序正確反映實際定價', () => {
    expect(TIER_HIERARCHY['starter']).toBe(1)
    expect(TIER_HIERARCHY['professional']).toBe(2)
    expect(TIER_HIERARCHY['business']).toBe(3)
    expect(TIER_HIERARCHY['agency']).toBe(4)

    expect(TIER_HIERARCHY['starter']).toBeLessThan(TIER_HIERARCHY['professional'])
    expect(TIER_HIERARCHY['professional']).toBeLessThan(TIER_HIERARCHY['business'])
    expect(TIER_HIERARCHY['business']).toBeLessThan(TIER_HIERARCHY['agency'])
  })
})

describe('canUpgrade - 新用戶', () => {
  test('新用戶可以訂閱任何方案', () => {
    expect(canUpgrade(null, 'monthly', 'starter', 'monthly')).toBe(true)
    expect(canUpgrade(null, 'monthly', 'professional', 'yearly')).toBe(true)
    expect(canUpgrade(null, 'monthly', 'agency', 'lifetime')).toBe(true)
  })
})

describe('canUpgrade - 同階層升級', () => {
  describe('Starter 同階層', () => {
    test('月繳 → 年繳 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'starter', 'yearly')).toBe(true)
    })

    test('月繳 → 終身 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'starter', 'lifetime')).toBe(true)
    })

    test('年繳 → 終身 ✅', () => {
      expect(canUpgrade('starter', 'yearly', 'starter', 'lifetime')).toBe(true)
    })

    test('年繳 → 月繳 ❌', () => {
      expect(canUpgrade('starter', 'yearly', 'starter', 'monthly')).toBe(false)
    })

    test('終身 → 月繳 ❌', () => {
      expect(canUpgrade('starter', 'lifetime', 'starter', 'monthly')).toBe(false)
    })

    test('終身 → 年繳 ❌', () => {
      expect(canUpgrade('starter', 'lifetime', 'starter', 'yearly')).toBe(false)
    })
  })

  describe('Professional 同階層', () => {
    test('月繳 → 年繳 ✅', () => {
      expect(canUpgrade('professional', 'monthly', 'professional', 'yearly')).toBe(true)
    })

    test('月繳 → 終身 ✅', () => {
      expect(canUpgrade('professional', 'monthly', 'professional', 'lifetime')).toBe(true)
    })

    test('年繳 → 月繳 ❌', () => {
      expect(canUpgrade('professional', 'yearly', 'professional', 'monthly')).toBe(false)
    })
  })

  describe('Business 同階層', () => {
    test('月繳 → 年繳 ✅', () => {
      expect(canUpgrade('business', 'monthly', 'business', 'yearly')).toBe(true)
    })

    test('年繳 → 終身 ✅', () => {
      expect(canUpgrade('business', 'yearly', 'business', 'lifetime')).toBe(true)
    })
  })

  describe('Agency 同階層', () => {
    test('月繳 → 年繳 ✅', () => {
      expect(canUpgrade('agency', 'monthly', 'agency', 'yearly')).toBe(true)
    })

    test('月繳 → 終身 ✅', () => {
      expect(canUpgrade('agency', 'monthly', 'agency', 'lifetime')).toBe(true)
    })

    test('年繳 → 月繳 ❌', () => {
      expect(canUpgrade('agency', 'yearly', 'agency', 'monthly')).toBe(false)
    })
  })
})

describe('canUpgrade - 跨階層升級（月繳）', () => {
  describe('Starter 月繳跨階層', () => {
    test('Starter 月繳 → Professional 月繳 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'professional', 'monthly')).toBe(true)
    })

    test('Starter 月繳 → Professional 年繳 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'professional', 'yearly')).toBe(true)
    })

    test('Starter 月繳 → Professional 終身 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'professional', 'lifetime')).toBe(true)
    })

    test('Starter 月繳 → Business 月繳 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'business', 'monthly')).toBe(true)
    })

    test('Starter 月繳 → Business 年繳 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'business', 'yearly')).toBe(true)
    })

    test('Starter 月繳 → Business 終身 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'business', 'lifetime')).toBe(true)
    })

    test('Starter 月繳 → Agency 月繳 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'agency', 'monthly')).toBe(true)
    })

    test('Starter 月繳 → Agency 年繳 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'agency', 'yearly')).toBe(true)
    })

    test('Starter 月繳 → Agency 終身 ✅', () => {
      expect(canUpgrade('starter', 'monthly', 'agency', 'lifetime')).toBe(true)
    })
  })

  describe('Professional 月繳跨階層', () => {
    test('Professional 月繳 → Business 月繳 ✅', () => {
      expect(canUpgrade('professional', 'monthly', 'business', 'monthly')).toBe(true)
    })

    test('Professional 月繳 → Business 年繳 ✅', () => {
      expect(canUpgrade('professional', 'monthly', 'business', 'yearly')).toBe(true)
    })

    test('Professional 月繳 → Agency 月繳 ✅', () => {
      expect(canUpgrade('professional', 'monthly', 'agency', 'monthly')).toBe(true)
    })

    test('Professional 月繳 → Starter 任何 ❌', () => {
      expect(canUpgrade('professional', 'monthly', 'starter', 'monthly')).toBe(false)
      expect(canUpgrade('professional', 'monthly', 'starter', 'yearly')).toBe(false)
    })
  })

  describe('Business 月繳跨階層', () => {
    test('Business 月繳 → Agency 月繳 ✅', () => {
      expect(canUpgrade('business', 'monthly', 'agency', 'monthly')).toBe(true)
    })

    test('Business 月繳 → Agency 年繳 ✅', () => {
      expect(canUpgrade('business', 'monthly', 'agency', 'yearly')).toBe(true)
    })

    test('Business 月繳 → Starter 任何 ❌', () => {
      expect(canUpgrade('business', 'monthly', 'starter', 'monthly')).toBe(false)
    })

    test('Business 月繳 → Professional 任何 ❌', () => {
      expect(canUpgrade('business', 'monthly', 'professional', 'monthly')).toBe(false)
    })
  })
})

describe('canUpgrade - 跨階層升級（年繳）', () => {
  describe('Starter 年繳跨階層', () => {
    test('Starter 年繳 → Professional 年繳 ✅', () => {
      expect(canUpgrade('starter', 'yearly', 'professional', 'yearly')).toBe(true)
    })

    test('Starter 年繳 → Professional 終身 ✅', () => {
      expect(canUpgrade('starter', 'yearly', 'professional', 'lifetime')).toBe(true)
    })

    test('Starter 年繳 → Professional 月繳 ❌ (縮短週期)', () => {
      expect(canUpgrade('starter', 'yearly', 'professional', 'monthly')).toBe(false)
    })

    test('Starter 年繳 → Business 年繳 ✅', () => {
      expect(canUpgrade('starter', 'yearly', 'business', 'yearly')).toBe(true)
    })

    test('Starter 年繳 → Business 月繳 ❌ (縮短週期)', () => {
      expect(canUpgrade('starter', 'yearly', 'business', 'monthly')).toBe(false)
    })

    test('Starter 年繳 → Agency 年繳 ✅', () => {
      expect(canUpgrade('starter', 'yearly', 'agency', 'yearly')).toBe(true)
    })

    test('Starter 年繳 → Agency 月繳 ❌ (縮短週期)', () => {
      expect(canUpgrade('starter', 'yearly', 'agency', 'monthly')).toBe(false)
    })
  })

  describe('Professional 年繳跨階層', () => {
    test('Professional 年繳 → Business 年繳 ✅', () => {
      expect(canUpgrade('professional', 'yearly', 'business', 'yearly')).toBe(true)
    })

    test('Professional 年繳 → Business 終身 ✅', () => {
      expect(canUpgrade('professional', 'yearly', 'business', 'lifetime')).toBe(true)
    })

    test('Professional 年繳 → Business 月繳 ❌ (縮短週期)', () => {
      expect(canUpgrade('professional', 'yearly', 'business', 'monthly')).toBe(false)
    })

    test('Professional 年繳 → Agency 年繳 ✅', () => {
      expect(canUpgrade('professional', 'yearly', 'agency', 'yearly')).toBe(true)
    })

    test('Professional 年繳 → Agency 月繳 ❌ (縮短週期)', () => {
      expect(canUpgrade('professional', 'yearly', 'agency', 'monthly')).toBe(false)
    })
  })

  describe('Business 年繳跨階層', () => {
    test('Business 年繳 → Agency 年繳 ✅', () => {
      expect(canUpgrade('business', 'yearly', 'agency', 'yearly')).toBe(true)
    })

    test('Business 年繳 → Agency 終身 ✅', () => {
      expect(canUpgrade('business', 'yearly', 'agency', 'lifetime')).toBe(true)
    })

    test('Business 年繳 → Agency 月繳 ❌ (縮短週期)', () => {
      expect(canUpgrade('business', 'yearly', 'agency', 'monthly')).toBe(false)
    })
  })
})

describe('canUpgrade - 終身方案', () => {
  describe('Starter 終身', () => {
    test('Starter 終身 → Professional 終身 ✅', () => {
      expect(canUpgrade('starter', 'lifetime', 'professional', 'lifetime')).toBe(true)
    })

    test('Starter 終身 → Business 終身 ✅', () => {
      expect(canUpgrade('starter', 'lifetime', 'business', 'lifetime')).toBe(true)
    })

    test('Starter 終身 → Agency 終身 ✅', () => {
      expect(canUpgrade('starter', 'lifetime', 'agency', 'lifetime')).toBe(true)
    })

    test('Starter 終身 → Professional 月繳 ❌', () => {
      expect(canUpgrade('starter', 'lifetime', 'professional', 'monthly')).toBe(false)
    })

    test('Starter 終身 → Professional 年繳 ❌', () => {
      expect(canUpgrade('starter', 'lifetime', 'professional', 'yearly')).toBe(false)
    })
  })

  describe('Professional 終身', () => {
    test('Professional 終身 → Business 終身 ✅', () => {
      expect(canUpgrade('professional', 'lifetime', 'business', 'lifetime')).toBe(true)
    })

    test('Professional 終身 → Agency 終身 ✅', () => {
      expect(canUpgrade('professional', 'lifetime', 'agency', 'lifetime')).toBe(true)
    })

    test('Professional 終身 → Business 月繳 ❌', () => {
      expect(canUpgrade('professional', 'lifetime', 'business', 'monthly')).toBe(false)
    })

    test('Professional 終身 → Starter 任何 ❌', () => {
      expect(canUpgrade('professional', 'lifetime', 'starter', 'lifetime')).toBe(false)
    })
  })

  describe('Business 終身', () => {
    test('Business 終身 → Agency 終身 ✅', () => {
      expect(canUpgrade('business', 'lifetime', 'agency', 'lifetime')).toBe(true)
    })

    test('Business 終身 → Agency 月繳 ❌', () => {
      expect(canUpgrade('business', 'lifetime', 'agency', 'monthly')).toBe(false)
    })

    test('Business 終身 → Agency 年繳 ❌', () => {
      expect(canUpgrade('business', 'lifetime', 'agency', 'yearly')).toBe(false)
    })

    test('Business 終身 → Starter 任何 ❌', () => {
      expect(canUpgrade('business', 'lifetime', 'starter', 'lifetime')).toBe(false)
    })

    test('Business 終身 → Professional 任何 ❌', () => {
      expect(canUpgrade('business', 'lifetime', 'professional', 'lifetime')).toBe(false)
    })
  })

  describe('Agency 終身', () => {
    test('Agency 終身 → Agency 月繳 ❌', () => {
      expect(canUpgrade('agency', 'lifetime', 'agency', 'monthly')).toBe(false)
    })

    test('Agency 終身 → Agency 年繳 ❌', () => {
      expect(canUpgrade('agency', 'lifetime', 'agency', 'yearly')).toBe(false)
    })

    test('Agency 終身 → 任何低階 ❌', () => {
      expect(canUpgrade('agency', 'lifetime', 'starter', 'lifetime')).toBe(false)
      expect(canUpgrade('agency', 'lifetime', 'professional', 'lifetime')).toBe(false)
      expect(canUpgrade('agency', 'lifetime', 'business', 'lifetime')).toBe(false)
    })
  })
})

describe('getUpgradeBlockReason', () => {
  test('新用戶返回 null', () => {
    expect(getUpgradeBlockReason(null, 'monthly', 'starter', 'monthly')).toBeNull()
  })

  test('降階返回正確錯誤訊息', () => {
    expect(getUpgradeBlockReason('business', 'monthly', 'starter', 'monthly')).toBe('無法降級到低階層方案')
  })

  test('終身方案變更為月繳返回正確錯誤訊息', () => {
    expect(getUpgradeBlockReason('starter', 'lifetime', 'professional', 'monthly')).toBe('終身方案不能變更為月繳或年繳')
  })

  test('跨階層縮短週期返回正確錯誤訊息', () => {
    expect(getUpgradeBlockReason('starter', 'yearly', 'business', 'monthly')).toBe('跨階層升級不能縮短計費週期')
  })

  test('同階層縮短週期返回正確錯誤訊息', () => {
    expect(getUpgradeBlockReason('agency', 'yearly', 'agency', 'monthly')).toBe('年繳無法變更為月繳')
  })

  test('目前方案返回正確訊息', () => {
    expect(getUpgradeBlockReason('starter', 'monthly', 'starter', 'monthly')).toBe('目前方案')
  })

  test('允許的升級返回 null', () => {
    expect(getUpgradeBlockReason('starter', 'monthly', 'business', 'yearly')).toBeNull()
  })
})
