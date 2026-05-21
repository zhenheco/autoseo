import { redirect } from "next/navigation";
import {
  isStripePlanId,
  type StripePlanId,
} from "@/lib/payments/stripe/price-ids";

const DEFAULT_PLAN_ID: StripePlanId = "solo_monthly";

/**
 * 註冊頁面重定向
 * 將舊的 /signup URL 重定向到新的 /login?mode=signup
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    ref?: string;
    plan?: string;
  }>;
}) {
  const params = await searchParams;

  // 構建重定向 URL
  const url = new URL("/login", "https://placeholder.com");
  url.searchParams.set("mode", "signup");

  // 保留原有的 query parameters
  if (params.error) {
    url.searchParams.set("error", params.error);
  }
  if (params.success) {
    url.searchParams.set("success", params.success);
  }
  if (params.ref) {
    url.searchParams.set("ref", params.ref);
  }
  if (params.plan) {
    url.searchParams.set(
      "plan",
      isStripePlanId(params.plan) ? params.plan : DEFAULT_PLAN_ID,
    );
  }

  // 重定向到登入頁面的註冊模式
  redirect(url.pathname + url.search);
}
