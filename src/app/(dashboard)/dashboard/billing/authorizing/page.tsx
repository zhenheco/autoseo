"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

function AuthorizingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"loading" | "submitting" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const t = useTranslations("billing.authorizing");

  useEffect(() => {
    const paymentForm = searchParams.get("paymentForm");

    if (!paymentForm) {
      setTimeout(() => {
        setStatus("error");
        setErrorMessage(t("missingPaymentForm"));
      }, 0);
      setTimeout(() => {
        router.push("/dashboard/subscription");
      }, 3000);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      if (status !== "submitting") {
        setStatus("error");
        setErrorMessage(t("connectionTimeout"));
      }
    }, 5000);

    try {
      const formData = JSON.parse(decodeURIComponent(paymentForm));

      if (!formRef.current) {
        throw new Error(t("formElementNotFound"));
      }

      setTimeout(() => {
        setStatus("submitting");
      }, 0);

      // 新格式：使用金流微服務 SDK 的格式 { action, method, fields }
      if (formData.action && formData.fields) {
        formRef.current.action = formData.action;
        formRef.current.method = formData.method || "POST";

        // 動態建立所有表單欄位
        for (const [key, value] of Object.entries(formData.fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(value);
          formRef.current.appendChild(input);
        }
      }
      // 舊格式（向後相容）：定期定額格式
      else if (formData.apiUrl && formData.postData && formData.merchantId) {
        formRef.current.action = formData.apiUrl;

        const merchantInput = document.createElement("input");
        merchantInput.type = "hidden";
        merchantInput.name = "MerchantID_";
        merchantInput.value = formData.merchantId;
        formRef.current.appendChild(merchantInput);

        const postDataInput = document.createElement("input");
        postDataInput.type = "hidden";
        postDataInput.name = "PostData_";
        postDataInput.value = formData.postData;
        formRef.current.appendChild(postDataInput);
      }
      // 舊格式（向後相容）：單次付款格式
      else if (
        formData.apiUrl &&
        formData.tradeInfo &&
        formData.tradeSha &&
        formData.merchantId
      ) {
        formRef.current.action = formData.apiUrl;

        const merchantInput = document.createElement("input");
        merchantInput.type = "hidden";
        merchantInput.name = "MerchantID";
        merchantInput.value = formData.merchantId;
        formRef.current.appendChild(merchantInput);

        const tradeInfoInput = document.createElement("input");
        tradeInfoInput.type = "hidden";
        tradeInfoInput.name = "TradeInfo";
        tradeInfoInput.value = formData.tradeInfo;
        formRef.current.appendChild(tradeInfoInput);

        const tradeShaInput = document.createElement("input");
        tradeShaInput.type = "hidden";
        tradeShaInput.name = "TradeSha";
        tradeShaInput.value = formData.tradeSha;
        formRef.current.appendChild(tradeShaInput);

        const versionInput = document.createElement("input");
        versionInput.type = "hidden";
        versionInput.name = "Version";
        versionInput.value = formData.version || "2.0";
        formRef.current.appendChild(versionInput);
      } else {
        throw new Error(t("missingRequiredFields"));
      }

      setTimeout(() => {
        try {
          formRef.current?.submit();
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        } catch (submitError) {
          console.error("[Authorizing] Submit form failed:", submitError);
          setStatus("error");
          setErrorMessage(t("submitFailed"));
        }
      }, 500);
    } catch (error) {
      console.error("[Authorizing] Parse payment form failed:", error);
      setTimeout(() => {
        setStatus("error");
        setErrorMessage(t("invalidFormData"));
      }, 0);
      setTimeout(() => {
        router.push("/dashboard/subscription");
      }, 3000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchParams, router, status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-6">
          {status === "error" ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground">{t("processFailed")}</h2>
                <p className="mt-2 text-muted-foreground">{errorMessage}</p>
                <div className="mt-6 flex gap-4 justify-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {t("retry")}
                  </button>
                  <button
                    onClick={() => router.push("/dashboard/billing")}
                    className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted transition-colors"
                  >
                    {t("backToBilling")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground">
                  {t("title")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {status === "loading"
                    ? t("preparingPayment")
                    : t("connectingPayment")}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("pleaseWait")}
                </p>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full animate-pulse bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{ width: "75%" }}
                />
              </div>

              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <svg
                  className="h-5 w-5 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>{t("secureConnection")}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <form ref={formRef} method="post" action="" style={{ display: "none" }} />
    </div>
  );
}

function LoadingFallback() {
  const t = useTranslations("billing.authorizing");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {t("loading")}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <AuthorizingContent />
    </Suspense>
  );
}
