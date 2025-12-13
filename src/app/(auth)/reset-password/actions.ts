"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * 更新用戶密碼
 * 用戶點擊重設密碼郵件中的連結後，會導向此頁面
 * Supabase 會自動處理 token 驗證
 */
export async function updatePassword(
  password: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("Update password error:", error);

      // 處理常見錯誤
      if (error.message.includes("same as old password")) {
        return { error: "新密碼不能與舊密碼相同" };
      }
      if (error.message.includes("should be at least")) {
        return { error: "密碼至少需要 6 個字元" };
      }

      return { error: "更新密碼失敗，請稍後再試" };
    }

    return {};
  } catch (error) {
    console.error("Update password request error:", error);
    return { error: "更新密碼失敗，請稍後再試" };
  }
}
