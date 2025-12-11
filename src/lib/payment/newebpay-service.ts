import crypto from "crypto";

export interface NewebPayConfig {
  merchantId: string;
  hashKey: string;
  hashIv: string;
  apiUrl: string;
  periodApiUrl?: string;
  version?: string;
}

export interface OnetimePaymentParams {
  orderNo: string;
  amount: number;
  description: string;
  email: string;
  returnUrl: string;
  notifyUrl: string;
  clientBackUrl?: string;
}

export interface RecurringPaymentParams {
  orderNo: string;
  amount: number;
  description: string;
  email: string;
  periodType: "D" | "W" | "M" | "Y";
  periodPoint?: string;
  periodStartType: 1 | 2 | 3;
  periodTimes?: number;
  returnUrl: string;
  notifyUrl: string;
  clientBackUrl?: string;
}

export interface DecryptedResponse {
  [key: string]: string | number | undefined;
}

export interface RefundParams {
  orderNo: string; // 商店訂單編號
  amount: number; // 退款金額
  tradeNo: string; // 藍新交易序號
}

export interface RefundResult {
  merchantId: string;
  postData: string; // AES 加密
  apiUrl: string;
}

export class NewebPayService {
  private config: NewebPayConfig;

  constructor(config: NewebPayConfig) {
    this.config = {
      version: "2.0",
      periodApiUrl: "https://ccore.newebpay.com/MPG/period",
      ...config,
    };
  }

  private aesEncrypt(data: string): string {
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      this.config.hashKey,
      this.config.hashIv,
    );
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }

  private aesDecrypt(encryptedData: string): string {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      this.config.hashKey,
      this.config.hashIv,
    );

    // 關閉自動 padding，使用藍新金流的 PKCS#7 padding
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // 手動移除 PKCS#7 padding
    return this.stripPKCS7Padding(decrypted);
  }

  private stripPKCS7Padding(data: string): string {
    if (!data || data.length === 0) {
      return data;
    }

    // PKCS#7: 最後一個字節表示 padding 的長度
    const paddingLength = data.charCodeAt(data.length - 1);

    // 驗證 padding 是否有效
    if (paddingLength > 0 && paddingLength <= 32) {
      // 檢查所有 padding 字節是否相同
      for (let i = 1; i <= paddingLength; i++) {
        if (data.charCodeAt(data.length - i) !== paddingLength) {
          // Padding 無效，返回原始資料
          console.log(
            "[NewebPayService] ⚠️ 無效的 PKCS#7 padding，返回原始資料",
          );
          return data;
        }
      }

      // 移除 padding
      return data.substring(0, data.length - paddingLength);
    }

    return data;
  }

  private createCheckValue(tradeInfo: string): string {
    const data = `HashKey=${this.config.hashKey}&${tradeInfo}&HashIV=${this.config.hashIv}`;
    return crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
  }

  createOnetimePayment(params: OnetimePaymentParams): {
    merchantId: string;
    tradeInfo: string;
    tradeSha: string;
    version: string;
    apiUrl: string;
  } {
    const tradeData = {
      MerchantID: this.config.merchantId,
      RespondType: "JSON",
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Version: this.config.version,
      MerchantOrderNo: params.orderNo,
      Amt: params.amount.toString(),
      ItemDesc: params.description,
      Email: params.email,
      ReturnURL: params.returnUrl,
      NotifyURL: params.notifyUrl,
      ClientBackURL: params.clientBackUrl || params.returnUrl,
    };

    const tradeInfoString = new URLSearchParams(
      tradeData as Record<string, string>,
    ).toString();
    const tradeInfo = this.aesEncrypt(tradeInfoString);
    const tradeSha = this.createCheckValue(tradeInfo);

    return {
      merchantId: this.config.merchantId,
      tradeInfo,
      tradeSha,
      version: this.config.version!,
      apiUrl: this.config.apiUrl,
    };
  }

  createRecurringPayment(params: RecurringPaymentParams): {
    merchantId: string;
    postData: string;
    apiUrl: string;
  } {
    if (params.periodType !== "M") {
      throw new Error("只支援月繳訂閱 (PeriodType: M)");
    }

    if (!params.periodPoint) {
      throw new Error("月繳訂閱必須提供 periodPoint（扣款日期）");
    }

    const day = parseInt(params.periodPoint);
    if (isNaN(day) || day < 1 || day > 31) {
      throw new Error("periodPoint 必須是 1-31 之間的數字");
    }

    const formattedDay = day.toString().padStart(2, "0");
    console.log(
      "[NewebPay] 月繳訂閱 - PeriodPoint: ",
      params.periodPoint,
      " -> ",
      formattedDay,
    );

    const periodData: Record<string, string> = {
      MerchantID: this.config.merchantId,
      RespondType: "JSON",
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Version: "1.5",
      MerchantOrderNo: params.orderNo,
      ProdDesc: params.description,
      PeriodAmt: params.amount.toString(),
      PeriodType: "M",
      PeriodPoint: formattedDay,
      PeriodStartType: params.periodStartType.toString(),
      ReturnURL: params.returnUrl,
      NotifyURL: params.notifyUrl,
      BackURL: params.clientBackUrl || params.returnUrl,
      EmailModify: "1",
      PayerEmail: params.email,
      CREDIT: "1",
    };

    console.log("[NewebPay] PeriodTimes 原始值: ", params.periodTimes);
    if (
      params.periodTimes === 0 ||
      params.periodTimes === undefined ||
      params.periodTimes === null
    ) {
      console.log("[NewebPay] 設定 PeriodTimes 為 99 (無限期)");
      periodData.PeriodTimes = "99";
    } else {
      console.log("[NewebPay] 設定 PeriodTimes: ", params.periodTimes);
      periodData.PeriodTimes = params.periodTimes.toString();
    }

    const postDataString = new URLSearchParams(periodData).toString();
    const postData = this.aesEncrypt(postDataString);

    return {
      merchantId: this.config.merchantId,
      postData,
      apiUrl: this.config.periodApiUrl!,
    };
  }

  decryptCallback(tradeInfo: string, tradeSha: string): DecryptedResponse {
    const calculatedSha = this.createCheckValue(tradeInfo);

    if (calculatedSha !== tradeSha.toUpperCase()) {
      throw new Error("Invalid TradeSha - 簽章驗證失敗");
    }

    const decryptedData = this.aesDecrypt(tradeInfo);
    console.log(
      "[NewebPayService] AES 解密後的原始資料:",
      decryptedData.substring(0, 200),
    );

    // 藍新金流單次購買也可能回傳 JSON 格式（與定期定額相同）
    // 先嘗試解析為 JSON，失敗才用 URLSearchParams
    try {
      const jsonData = JSON.parse(decryptedData);
      console.log("[NewebPayService] 成功解析為 JSON 格式");
      console.log(
        "[NewebPayService] JSON 解析結果 keys:",
        Object.keys(jsonData),
      );
      return jsonData;
    } catch (e) {
      // 如果不是 JSON，則使用 URLSearchParams 解析（向後兼容）
      console.log("[NewebPayService] JSON 解析失敗，使用 URLSearchParams 解析");
      const params = new URLSearchParams(decryptedData);
      const result: DecryptedResponse = {};

      params.forEach((value, key) => {
        const numValue = Number(value);
        result[key] = isNaN(numValue) ? value : numValue;
      });

      console.log(
        "[NewebPayService] URLSearchParams 解析結果:",
        JSON.stringify(result, null, 2),
      );
      console.log("[NewebPayService] 解析後的 keys:", Object.keys(result));

      return result;
    }
  }

  decryptPeriodCallback(period: string): DecryptedResponse {
    console.log("[NewebPay] 開始解密 Period 參數:", {
      periodLength: period.length,
      periodPrefix: period.substring(0, 50),
      hashKeyLength: this.config.hashKey.length,
      hashIvLength: this.config.hashIv.length,
    });

    try {
      const decryptedData = this.aesDecrypt(period);
      console.log("[NewebPay] ✅ 解密成功:", {
        decryptedLength: decryptedData.length,
        decryptedPrefix: decryptedData.substring(0, 100),
      });

      // 嘗試解析為 JSON（定期定額授權回調使用 JSON 格式）
      try {
        const jsonData = JSON.parse(decryptedData);
        console.log("[NewebPay] ✅ JSON 解析成功:", {
          keys: Object.keys(jsonData),
          hasStatus: "Status" in jsonData,
          hasResult: "Result" in jsonData,
        });
        return jsonData;
      } catch (e) {
        console.log("[NewebPay] 非 JSON 格式，使用 URLSearchParams 解析");
        // 如果不是 JSON，則使用 URLSearchParams 解析
        const params = new URLSearchParams(decryptedData);
        const result: DecryptedResponse = {};

        params.forEach((value, key) => {
          const numValue = Number(value);
          result[key] = isNaN(numValue) ? value : numValue;
        });

        return result;
      }
    } catch (error) {
      console.error("[NewebPay] ❌ Period 解密失敗:", {
        error: error instanceof Error ? error.message : String(error),
        errorCode:
          error instanceof Error && "code" in error
            ? (error as any).code
            : undefined,
        periodLength: period.length,
        hashKeyLength: this.config.hashKey.length,
        hashIvLength: this.config.hashIv.length,
        suggestion:
          this.config.hashKey.length !== 32 || this.config.hashIv.length !== 16
            ? "請檢查環境變數 NEWEBPAY_HASH_KEY 和 NEWEBPAY_HASH_IV 的長度和內容"
            : "請確認藍新金流後台的 HashKey/HashIV 設定與程式碼一致",
      });
      throw error;
    }
  }

  modifyRecurringStatus(
    periodNo: string,
    status: "suspend" | "terminate",
  ): {
    merchantId: string;
    postData: string;
    postDataSha: string;
    apiUrl: string;
  } {
    const modifyData = {
      RespondType: "JSON",
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Version: "1.0",
      PeriodNo: periodNo,
      AlterType: status === "suspend" ? "suspend" : "terminate",
    };

    const postDataString = new URLSearchParams(modifyData).toString();
    const postData = this.aesEncrypt(postDataString);
    const postDataSha = this.createCheckValue(postData);

    return {
      merchantId: this.config.merchantId,
      postData,
      postDataSha,
      apiUrl: this.config.periodApiUrl!.replace(
        "/period",
        "/period/AlterStatus",
      ),
    };
  }

  modifyRecurringAmount(
    periodNo: string,
    newAmount: number,
    periodType: "D" | "W" | "M" | "Y",
    periodPoint?: string,
    periodTimes?: number,
  ): {
    merchantId: string;
    postData: string;
    postDataSha: string;
    apiUrl: string;
  } {
    const modifyData: Record<string, string> = {
      RespondType: "JSON",
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Version: "1.0",
      PeriodNo: periodNo,
      AlterType: "amount",
      PeriodAmt: newAmount.toString(),
      PeriodType: periodType,
    };

    if (periodPoint) {
      modifyData.PeriodPoint = periodPoint;
    }

    if (periodTimes) {
      modifyData.PeriodTimes = periodTimes.toString();
    }

    const postDataString = new URLSearchParams(modifyData).toString();
    const postData = this.aesEncrypt(postDataString);
    const postDataSha = this.createCheckValue(postData);

    return {
      merchantId: this.config.merchantId,
      postData,
      postDataSha,
      apiUrl: this.config.periodApiUrl!.replace("/period", "/period/AlterAmt"),
    };
  }

  /**
   * 創建信用卡退款請求
   * 使用藍新金流 CreditCard/Close API
   * CloseType=2 表示退款
   */
  createRefundRequest(params: RefundParams): RefundResult {
    // 退款請求資料
    const refundData: Record<string, string> = {
      RespondType: "JSON",
      Version: "1.1",
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      Amt: params.amount.toString(),
      MerchantOrderNo: params.orderNo,
      IndexType: "1", // 1=商店訂單編號, 2=藍新交易序號
      TradeNo: params.tradeNo,
      CloseType: "2", // 1=請款/取消請款, 2=退款/取消退款
    };

    const postDataString = new URLSearchParams(refundData).toString();
    const postData = this.aesEncrypt(postDataString);

    // 判斷使用測試環境或正式環境
    const isProduction =
      this.config.apiUrl.includes("core.newebpay.com") &&
      !this.config.apiUrl.includes("ccore.newebpay.com");
    const baseUrl = isProduction
      ? "https://core.newebpay.com"
      : "https://ccore.newebpay.com";

    console.log("[NewebPay] 創建退款請求:", {
      orderNo: params.orderNo,
      amount: params.amount,
      tradeNo: params.tradeNo,
      environment: isProduction ? "production" : "test",
    });

    return {
      merchantId: this.config.merchantId,
      postData,
      apiUrl: `${baseUrl}/API/CreditCard/Close`,
    };
  }

  /**
   * 執行退款請求（調用藍新 API）
   */
  async executeRefund(params: RefundParams): Promise<{
    success: boolean;
    status: string;
    message: string;
    tradeNo?: string;
    response?: DecryptedResponse;
  }> {
    const { merchantId, postData, apiUrl } = this.createRefundRequest(params);

    console.log("[NewebPay] 執行退款 API 調用:", { apiUrl, merchantId });

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          MerchantID_: merchantId,
          PostData_: postData,
        }).toString(),
      });

      const responseText = await response.text();
      console.log(
        "[NewebPay] 退款 API 原始回應:",
        responseText.substring(0, 500),
      );

      // 解析回應
      let result: DecryptedResponse;
      try {
        result = JSON.parse(responseText);
      } catch {
        // 如果不是 JSON，嘗試解析為 URL 參數
        const params = new URLSearchParams(responseText);
        result = {};
        params.forEach((value, key) => {
          result[key] = value;
        });
      }

      const status = String(result.Status || "");
      const message = String(result.Message || "未知錯誤");

      // Status === 'SUCCESS' 表示退款成功
      if (status === "SUCCESS") {
        console.log("[NewebPay] ✅ 退款成功:", result);
        return {
          success: true,
          status,
          message,
          tradeNo: String(result.TradeNo || params.tradeNo),
          response: result,
        };
      } else {
        console.error("[NewebPay] ❌ 退款失敗:", { status, message, result });
        return {
          success: false,
          status,
          message,
          response: result,
        };
      }
    } catch (error) {
      console.error("[NewebPay] 退款 API 調用失敗:", error);
      return {
        success: false,
        status: "ERROR",
        message: error instanceof Error ? error.message : "退款 API 調用失敗",
      };
    }
  }

  static createInstance(): NewebPayService {
    const merchantId = process.env.NEWEBPAY_MERCHANT_ID;
    const hashKey = process.env.NEWEBPAY_HASH_KEY;
    const hashIv = process.env.NEWEBPAY_HASH_IV;
    const apiUrl =
      process.env.NEWEBPAY_API_URL ||
      "https://ccore.newebpay.com/MPG/mpg_gateway";
    const periodApiUrl =
      process.env.NEWEBPAY_PERIOD_API_URL ||
      "https://ccore.newebpay.com/MPG/period";

    if (!merchantId || !hashKey || !hashIv) {
      throw new Error("NewebPay 環境變數未設定");
    }

    // 驗證 HashKey 長度
    if (hashKey.length !== 32) {
      console.error("[NewebPay] HashKey 長度錯誤:", {
        expected: 32,
        actual: hashKey.length,
        hasNewline: hashKey.includes("\n"),
        hasSpace: hashKey.includes(" "),
      });
      throw new Error(
        `HashKey 長度必須為 32 bytes，實際為 ${hashKey.length} bytes`,
      );
    }

    // 驗證 HashIV 長度
    if (hashIv.length !== 16) {
      console.error("[NewebPay] HashIV 長度錯誤:", {
        expected: 16,
        actual: hashIv.length,
        hasNewline: hashIv.includes("\n"),
        hasSpace: hashIv.includes(" "),
      });
      throw new Error(
        `HashIV 長度必須為 16 bytes，實際為 ${hashIv.length} bytes`,
      );
    }

    console.log("[NewebPay] 環境變數驗證通過:", {
      merchantId: merchantId.substring(0, 8) + "...",
      hashKeyLength: hashKey.length,
      hashIvLength: hashIv.length,
    });

    return new NewebPayService({
      merchantId,
      hashKey,
      hashIv,
      apiUrl,
      periodApiUrl,
    });
  }
}
