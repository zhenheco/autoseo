import crypto from 'crypto'

export interface NewebPayConfig {
  merchantId: string
  hashKey: string
  hashIv: string
  apiUrl: string
  periodApiUrl?: string
  version?: string
}

export interface OnetimePaymentParams {
  orderNo: string
  amount: number
  description: string
  email: string
  returnUrl: string
  notifyUrl: string
  clientBackUrl?: string
}

export interface RecurringPaymentParams {
  orderNo: string
  amount: number
  description: string
  email: string
  periodType: 'D' | 'W' | 'M' | 'Y'
  periodPoint?: string
  periodStartType: 1 | 2 | 3
  periodTimes?: number
  returnUrl: string
  notifyUrl: string
  clientBackUrl?: string
}

export interface DecryptedResponse {
  [key: string]: string | number | undefined
}

export class NewebPayService {
  private config: NewebPayConfig

  constructor(config: NewebPayConfig) {
    this.config = {
      version: '2.0',
      periodApiUrl: 'https://ccore.newebpay.com/MPG/period',
      ...config,
    }
  }

  private aesEncrypt(data: string): string {
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      this.config.hashKey,
      this.config.hashIv
    )
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return encrypted
  }

  private aesDecrypt(encryptedData: string): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.config.hashKey,
      this.config.hashIv
    )
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  private createCheckValue(tradeInfo: string): string {
    const data = `HashKey=${this.config.hashKey}&${tradeInfo}&HashIV=${this.config.hashIv}`
    return crypto.createHash('sha256').update(data).digest('hex').toUpperCase()
  }

  createOnetimePayment(params: OnetimePaymentParams): {
    merchantId: string
    tradeInfo: string
    tradeSha: string
    version: string
    apiUrl: string
  } {
    const tradeData = {
      MerchantID: this.config.merchantId,
      RespondType: 'JSON',
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Version: this.config.version,
      MerchantOrderNo: params.orderNo,
      Amt: params.amount.toString(),
      ItemDesc: params.description,
      Email: params.email,
      ReturnURL: params.returnUrl,
      NotifyURL: params.notifyUrl,
      ClientBackURL: params.clientBackUrl || params.returnUrl,
    }

    const tradeInfoString = new URLSearchParams(
      tradeData as Record<string, string>
    ).toString()
    const tradeInfo = this.aesEncrypt(tradeInfoString)
    const tradeSha = this.createCheckValue(tradeInfo)

    return {
      merchantId: this.config.merchantId,
      tradeInfo,
      tradeSha,
      version: this.config.version!,
      apiUrl: this.config.apiUrl,
    }
  }

  createRecurringPayment(params: RecurringPaymentParams): {
    merchantId: string
    postData: string
    apiUrl: string
  } {
    // 注意：定期定額 API 必須使用 Version 1.5
    // 加密資料內部也需要 MerchantID_（根據文件要求）
    const periodData: Record<string, string> = {
      MerchantID_: this.config.merchantId,  // 注意：加密內也需要 MerchantID_
      RespondType: 'JSON',
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Version: '1.5',  // 必須是 1.5，不能是 1.0
      MerOrderNo: params.orderNo,
      ProdDesc: params.description,
      PeriodAmt: params.amount.toString(),
      PeriodType: params.periodType,
      PeriodStartType: params.periodStartType.toString(),
      ReturnURL: params.returnUrl,
      NotifyURL: params.notifyUrl,
      BackURL: params.clientBackUrl || params.returnUrl,
      EmailModify: '1',
      PayerEmail: params.email,
      CREDIT: '1',
    }

    if (params.periodPoint) {
      // 確保月繳的日期是兩位數格式 (01-31)
      if (params.periodType === 'M') {
        const day = parseInt(params.periodPoint)
        const formattedDay = day.toString().padStart(2, '0')
        console.log('[NewebPay] 格式化 PeriodPoint: ', params.periodPoint, ' -> ', formattedDay)
        periodData.PeriodPoint = formattedDay
      } else {
        periodData.PeriodPoint = params.periodPoint
      }
    }

    // NewebPay 定期定額要求必須提供 PeriodTimes，無限期訂閱使用 99
    console.log('[NewebPay] PeriodTimes 原始值: ', params.periodTimes)
    if (params.periodTimes === 0 || params.periodTimes === undefined || params.periodTimes === null) {
      console.log('[NewebPay] 設定 PeriodTimes 為 99 (無限期)')
      periodData.PeriodTimes = '99'
    } else {
      console.log('[NewebPay] 設定 PeriodTimes: ', params.periodTimes)
      periodData.PeriodTimes = params.periodTimes.toString()
    }

    const postDataString = new URLSearchParams(periodData).toString()
    const postData = this.aesEncrypt(postDataString)

    return {
      merchantId: this.config.merchantId,
      postData,
      apiUrl: this.config.periodApiUrl!,
    }
  }

  decryptCallback(tradeInfo: string, tradeSha: string): DecryptedResponse {
    const calculatedSha = this.createCheckValue(tradeInfo)

    if (calculatedSha !== tradeSha.toUpperCase()) {
      throw new Error('Invalid TradeSha - 簽章驗證失敗')
    }

    const decryptedData = this.aesDecrypt(tradeInfo)
    console.log('[NewebPayService] AES 解密後的原始資料:', decryptedData.substring(0, 200))

    // 藍新金流單次購買也可能回傳 JSON 格式（與定期定額相同）
    // 先嘗試解析為 JSON，失敗才用 URLSearchParams
    try {
      const jsonData = JSON.parse(decryptedData)
      console.log('[NewebPayService] 成功解析為 JSON 格式')
      console.log('[NewebPayService] JSON 解析結果 keys:', Object.keys(jsonData))
      return jsonData
    } catch (e) {
      // 如果不是 JSON，則使用 URLSearchParams 解析（向後兼容）
      console.log('[NewebPayService] JSON 解析失敗，使用 URLSearchParams 解析')
      const params = new URLSearchParams(decryptedData)
      const result: DecryptedResponse = {}

      params.forEach((value, key) => {
        const numValue = Number(value)
        result[key] = isNaN(numValue) ? value : numValue
      })

      console.log('[NewebPayService] URLSearchParams 解析結果:', JSON.stringify(result, null, 2))
      console.log('[NewebPayService] 解析後的 keys:', Object.keys(result))

      return result
    }
  }

  decryptPeriodCallback(period: string): DecryptedResponse {
    const decryptedData = this.aesDecrypt(period)

    // 嘗試解析為 JSON（定期定額授權回調使用 JSON 格式）
    try {
      const jsonData = JSON.parse(decryptedData)
      return jsonData
    } catch (e) {
      // 如果不是 JSON，則使用 URLSearchParams 解析
      const params = new URLSearchParams(decryptedData)
      const result: DecryptedResponse = {}

      params.forEach((value, key) => {
        const numValue = Number(value)
        result[key] = isNaN(numValue) ? value : numValue
      })

      return result
    }
  }

  modifyRecurringStatus(
    periodNo: string,
    status: 'suspend' | 'terminate'
  ): {
    merchantId: string
    postData: string
    postDataSha: string
    apiUrl: string
  } {
    const modifyData = {
      RespondType: 'JSON',
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Version: '1.0',
      PeriodNo: periodNo,
      AlterType: status === 'suspend' ? 'suspend' : 'terminate',
    }

    const postDataString = new URLSearchParams(modifyData).toString()
    const postData = this.aesEncrypt(postDataString)
    const postDataSha = this.createCheckValue(postData)

    return {
      merchantId: this.config.merchantId,
      postData,
      postDataSha,
      apiUrl: this.config.periodApiUrl!.replace('/period', '/period/AlterStatus'),
    }
  }

  modifyRecurringAmount(
    periodNo: string,
    newAmount: number,
    periodType: 'D' | 'W' | 'M' | 'Y',
    periodPoint?: string,
    periodTimes?: number
  ): {
    merchantId: string
    postData: string
    postDataSha: string
    apiUrl: string
  } {
    const modifyData: Record<string, string> = {
      RespondType: 'JSON',
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Version: '1.0',
      PeriodNo: periodNo,
      AlterType: 'amount',
      PeriodAmt: newAmount.toString(),
      PeriodType: periodType,
    }

    if (periodPoint) {
      modifyData.PeriodPoint = periodPoint
    }

    if (periodTimes) {
      modifyData.PeriodTimes = periodTimes.toString()
    }

    const postDataString = new URLSearchParams(modifyData).toString()
    const postData = this.aesEncrypt(postDataString)
    const postDataSha = this.createCheckValue(postData)

    return {
      merchantId: this.config.merchantId,
      postData,
      postDataSha,
      apiUrl: this.config.periodApiUrl!.replace('/period', '/period/AlterAmt'),
    }
  }

  static createInstance(): NewebPayService {
    const merchantId = process.env.NEWEBPAY_MERCHANT_ID
    const hashKey = process.env.NEWEBPAY_HASH_KEY
    const hashIv = process.env.NEWEBPAY_HASH_IV
    const apiUrl = process.env.NEWEBPAY_API_URL || 'https://ccore.newebpay.com/MPG/mpg_gateway'
    const periodApiUrl = process.env.NEWEBPAY_PERIOD_API_URL || 'https://ccore.newebpay.com/MPG/period'

    if (!merchantId || !hashKey || !hashIv) {
      throw new Error('NewebPay 環境變數未設定')
    }

    return new NewebPayService({
      merchantId,
      hashKey,
      hashIv,
      apiUrl,
      periodApiUrl,
    })
  }
}
