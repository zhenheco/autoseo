"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { trackPurchase } from "@/lib/analytics/events";
import { useTranslations } from "next-intl";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const hasTracked = useRef(false);
  const t = useTranslations("payment");

  const paymentId = searchParams.get("paymentId");
  const orderId = searchParams.get("orderId");
  const status = searchParams.get("status");
  const amount = searchParams.get("amount");

  const isSuccess = status === "success" || status === "SUCCESS";

  // GA4 追蹤：付款成功時追蹤購買事件
  useEffect(() => {
    if (isSuccess && !hasTracked.current) {
      hasTracked.current = true;
      trackPurchase({
        transaction_id: orderId || paymentId || `order_${Date.now()}`,
        value: amount ? parseInt(amount, 10) : 0,
        currency: "TWD",
        items: [
          {
            item_id: "subscription",
            item_name: "1waySEO Subscription",
            price: amount ? parseInt(amount, 10) : 0,
            quantity: 1,
          },
        ],
      });
    }
  }, [isSuccess, orderId, paymentId, amount]);

  useEffect(() => {
    // 倒數計時後跳轉
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/dashboard/subscription");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-6">
          {isSuccess ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">{t("successTitle")}</h2>
                <p className="mt-2 text-gray-600">
                  {t("thankYouMessage")}
                </p>
                {orderId && (
                  <p className="mt-2 text-sm text-gray-500">
                    {t("orderNumber")}{orderId}
                  </p>
                )}
              </div>

              <div className="w-full rounded-lg bg-green-50 p-4">
                <p className="text-center text-sm text-green-800">
                  {t("subscriptionActivated")}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">{t("failedTitle")}</h2>
                <p className="mt-2 text-gray-600">{t("failedMessage")}</p>
                {orderId && (
                  <p className="mt-2 text-sm text-gray-500">
                    {t("orderNumber")}{orderId}
                  </p>
                )}
              </div>

              <div className="w-full rounded-lg bg-red-50 p-4">
                <p className="text-center text-sm text-red-800">
                  {t("retryMessage")}
                </p>
              </div>
            </>
          )}

          <div className="text-center text-sm text-gray-500">
            <p>{t("redirectCountdown", { seconds: countdown })}</p>
          </div>

          <button
            onClick={() => router.push("/dashboard/subscription")}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white transition-colors hover:bg-blue-700"
          >
            {t("goToSubscription")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentResultFallback() {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{t("loading")}</h2>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={<PaymentResultFallback />}>
      <PaymentResultContent />
    </Suspense>
  );
}
