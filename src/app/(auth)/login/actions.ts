"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signUp as authSignUp, signIn as authSignIn } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * 使用 Google OAuth 登入
 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const headersList = await headers();
  const origin =
    headersList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://1wayseo.com";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent("Google 登入失敗，請稍後再試")}`,
    );
  }

  if (data.url) {
    redirect(data.url);
  }
}

/**
 * 使用 Email + 密碼登入
 * @returns 成功時返回空物件，失敗時返回 error
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  try {
    await authSignIn(email, password);
    return {};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "登入失敗，請稍後再試";
    return { error: errorMessage };
  }
}

/**
 * 使用 Email + 密碼註冊
 * @returns 成功時返回 needsVerification，失敗時返回 error
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ error?: string; needsVerification?: boolean }> {
  try {
    const result = await authSignUp(email, password);

    // 檢查是否需要驗證郵件
    // Supabase 會發送驗證郵件，用戶需要點擊連結確認
    if (result.user && !result.user.email_confirmed_at) {
      return { needsVerification: true };
    }

    return {};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "註冊失敗，請稍後再試";

    // 處理常見錯誤
    if (errorMessage.includes("User already registered")) {
      return { error: "此 Email 已被註冊" };
    }

    return { error: errorMessage };
  }
}

/**
 * 發送重設密碼郵件
 */
export async function resetPasswordRequest(
  email: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const headersList = await headers();
    const origin =
      headersList.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://1wayseo.com";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      console.error("Reset password error:", error);
      return { error: "發送重設密碼郵件失敗，請稍後再試" };
    }

    return {};
  } catch (error) {
    console.error("Reset password request error:", error);
    return { error: "發送重設密碼郵件失敗，請稍後再試" };
  }
}

/**
 * 重新發送驗證郵件
 */
export async function resendVerificationEmail(
  email: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const headersList = await headers();
    const origin =
      headersList.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://1wayseo.com";

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });

    if (error) {
      console.error("Resend verification error:", error);
      return { error: "發送驗證郵件失敗，請稍後再試" };
    }

    return {};
  } catch (error) {
    console.error("Resend verification request error:", error);
    return { error: "發送驗證郵件失敗，請稍後再試" };
  }
}
