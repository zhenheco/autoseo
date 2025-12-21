"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  const paymentId = searchParams.get("paymentId");
  const orderId = searchParams.get("orderId");
  const status = searchParams.get("status");

  const isSuccess = status === "success" || status === "SUCCESS";

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
                <h2 className="text-2xl font-bold text-gray-900">付款成功</h2>
                <p className="mt-2 text-gray-600">
                  感謝您的購買，訂單已完成處理
                </p>
                {orderId && (
                  <p className="mt-2 text-sm text-gray-500">
                    訂單編號：{orderId}
                  </p>
                )}
              </div>

              <div className="w-full rounded-lg bg-green-50 p-4">
                <p className="text-center text-sm text-green-800">
                  您的訂閱或購買的額度已生效
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">付款失敗</h2>
                <p className="mt-2 text-gray-600">很抱歉，付款處理時發生問題</p>
                {orderId && (
                  <p className="mt-2 text-sm text-gray-500">
                    訂單編號：{orderId}
                  </p>
                )}
              </div>

              <div className="w-full rounded-lg bg-red-50 p-4">
                <p className="text-center text-sm text-red-800">
                  請檢查您的付款資訊後重試，或聯繫客服
                </p>
              </div>
            </>
          )}

          <div className="text-center text-sm text-gray-500">
            <p>{countdown} 秒後自動跳轉至訂閱頁面</p>
          </div>

          <button
            onClick={() => router.push("/dashboard/subscription")}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white transition-colors hover:bg-blue-700"
          >
            立即前往訂閱頁面
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">載入中...</h2>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
