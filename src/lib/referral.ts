/**
 * 生成推薦碼（8 位隨機字串）
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 移除易混淆字符
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * 從 cookie 中取得推薦碼
 */
async function getReferralCodeFromCookie(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const cookies = document.cookie.split('; ')
  const referralCookie = cookies.find(c => c.startsWith('referral_code='))

  if (referralCookie) {
    return referralCookie.split('=')[1]
  }

  return null
}

export { generateReferralCode, getReferralCodeFromCookie }
