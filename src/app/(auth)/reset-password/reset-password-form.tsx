"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updatePassword } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface ResetPasswordFormProps {
  error?: string;
  success?: string;
}

/**
 * 重設密碼表單元件
 * 用戶點擊重設密碼郵件中的連結後會導向此頁面
 */
export function ResetPasswordForm({
  error: initialError,
  success: initialSuccess,
}: ResetPasswordFormProps) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(initialError || "");
  const [success, setSuccess] = useState(initialSuccess || "");

  /**
   * 處理表單提交
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    // 前端驗證
    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t("passwordTooShort"));
      setIsLoading(false);
      return;
    }

    try {
      const result = await updatePassword(password);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(t("passwordResetSuccess"));
        // 2 秒後跳轉到登入頁
        setTimeout(() => {
          router.push(
            "/login?success=" + encodeURIComponent(t("passwordResetSuccess")),
          );
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("passwordResetFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 成功訊息 */}
      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {success}
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 新密碼輸入 */}
        <div className="space-y-2">
          <Label htmlFor="password">{t("newPassword")}</Label>
          <Input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="••••••••"
            disabled={isLoading}
            className="h-11"
          />
        </div>

        {/* 確認新密碼輸入 */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("confirmNewPassword")}</Label>
          <Input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="••••••••"
            disabled={isLoading}
            className="h-11"
          />
        </div>

        {/* 提交按鈕 */}
        <Button type="submit" disabled={isLoading} className="w-full h-11">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isLoading ? t("processing") : t("resetPassword")}
        </Button>
      </form>
    </>
  );
}
