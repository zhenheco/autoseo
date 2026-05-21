"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@shared/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          {status === "error" ? (
            <ErrorState
              title={t("processFailed")}
              message={errorMessage}
              onRetry={() => window.location.reload()}
              supportUrl="/faq"
            />
          ) : (
            <div className="flex flex-col items-center space-y-6">
              <div className="w-full space-y-3">
                <Skeleton className="mx-auto h-16 w-16 rounded-full" />
                <Skeleton className="h-2 w-full" />
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
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <span>{t("secureConnection")}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <form ref={formRef} method="post" action="" style={{ display: "none" }} />
    </div>
  );
}

function LoadingFallback() {
  const t = useTranslations("billing.authorizing");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <Skeleton className="mx-auto h-16 w-16 rounded-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-2 w-full" />
          <span className="sr-only">{t("loading")}</span>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthorizingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthorizingContent />
    </Suspense>
  );
}
