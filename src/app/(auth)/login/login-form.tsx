"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPasswordRequest,
  resendVerificationEmail,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { trackLogin, trackSignUp } from "@/lib/analytics/events";

/**
 * Google 圖示元件
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

type AuthMode = "signin" | "signup" | "forgot";

interface LoginFormProps {
  error?: string;
  success?: string;
  initialMode?: AuthMode;
}

/**
 * 登入/註冊/忘記密碼表單元件
 * 支援 Google OAuth 和 Email + 密碼認證
 */
export function LoginForm({
  error: initialError,
  success: initialSuccess,
  initialMode = "signin",
}: LoginFormProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();

  // 從 URL 參數讀取初始模式
  const modeFromUrl = searchParams.get("mode") as AuthMode | null;

  const [mode, setMode] = useState<AuthMode>(modeFromUrl || initialMode);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(initialError || "");
  const [success, setSuccess] = useState(initialSuccess || "");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // 當 URL 參數變化時更新模式
  useEffect(() => {
    if (modeFromUrl && modeFromUrl !== mode) {
      setMode(modeFromUrl);
    }
  }, [modeFromUrl, mode]);

  /**
   * 處理 Google 登入
   */
  const handleGoogleSignIn = async () => {
    setError("");
    setSuccess("");
    setIsGoogleLoading(true);

    try {
      // 追蹤 Google 登入/註冊嘗試（因為會重定向，需要在這裡追蹤）
      if (mode === "signup") {
        trackSignUp("google");
      } else {
        trackLogin("google");
      }
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
      setIsGoogleLoading(false);
    }
  };

  /**
   * 處理 Email 表單提交
   */
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setNeedsVerification(false);
    setAlreadyRegistered(false);
    setIsEmailLoading(true);

    try {
      // 忘記密碼模式
      if (mode === "forgot") {
        const result = await resetPasswordRequest(email);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(t("emailSent"));
        }
        setIsEmailLoading(false);
        return;
      }

      // 註冊模式
      if (mode === "signup") {
        // 前端驗證
        if (password !== confirmPassword) {
          setError(t("passwordMismatch"));
          setIsEmailLoading(false);
          return;
        }
        if (password.length < 6) {
          setError(t("passwordTooShort"));
          setIsEmailLoading(false);
          return;
        }

        const result = await signUpWithEmail(email, password);
        if (result.error) {
          setError(result.error);
          // 如果是「已註冊」的情況，設置標記以顯示特殊 UI
          if (result.alreadyRegistered) {
            setAlreadyRegistered(true);
          }
        } else if (result.needsVerification) {
          setSuccess(t("registerSuccess"));
          setNeedsVerification(true);
          // 追蹤註冊成功（等待驗證）
          trackSignUp("email");
        } else {
          // 追蹤註冊成功（直接登入）
          trackSignUp("email");
          router.push("/dashboard");
        }
      } else {
        // 登入模式
        const result = await signInWithEmail(email, password);
        if (result.error) {
          // 檢查是否需要驗證郵件
          if (
            result.error.includes("not confirmed") ||
            result.error.includes("Email not confirmed")
          ) {
            setError(t("emailNotVerified"));
            setNeedsVerification(true);
          } else if (result.error.includes("Invalid login credentials")) {
            setError(t("invalidCredentials"));
          } else {
            setError(result.error);
          }
        } else {
          // 追蹤登入成功
          trackLogin("email");
          router.push("/dashboard");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setIsEmailLoading(false);
    }
  };

  /**
   * 處理重發驗證郵件
   */
  const handleResendVerification = async () => {
    setError("");
    setIsEmailLoading(true);
    try {
      const result = await resendVerificationEmail(email);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(t("verificationEmailSent"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "發送驗證信失敗");
    } finally {
      setIsEmailLoading(false);
    }
  };

  /**
   * 切換模式
   */
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
    setNeedsVerification(false);
    setAlreadyRegistered(false);
    // 更新 URL 但不重新載入頁面
    const url = new URL(window.location.href);
    if (newMode === "signin") {
      url.searchParams.delete("mode");
    } else {
      url.searchParams.set("mode", newMode);
    }
    window.history.replaceState({}, "", url.toString());
  };

  const isLoading = isGoogleLoading || isEmailLoading;

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
          {/* 已註冊情況：顯示登入和重發驗證信選項 */}
          {alreadyRegistered && email && (
            <div className="mt-3 space-y-2">
              <p className="text-xs opacity-80">
                {t("emailAlreadyRegisteredHint")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => switchMode("signin")}
                  className="text-sm underline hover:no-underline"
                >
                  {t("goToLogin")}
                </button>
                <span className="text-xs opacity-50">|</span>
                <button
                  onClick={handleResendVerification}
                  disabled={isLoading}
                  className="text-sm underline hover:no-underline"
                >
                  {t("resendVerification")}
                </button>
              </div>
            </div>
          )}
          {/* 未驗證登入情況：只顯示重發驗證信 */}
          {needsVerification && !alreadyRegistered && email && (
            <button
              onClick={handleResendVerification}
              disabled={isLoading}
              className="mt-2 text-sm underline hover:no-underline"
            >
              {t("resendVerification")}
            </button>
          )}
        </div>
      )}

      {/* Google 登入按鈕（忘記密碼模式不顯示） */}
      {mode !== "forgot" && (
        <>
          <form
            action={async () => {
              await handleGoogleSignIn();
            }}
          >
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors"
            >
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon className="mr-2 h-5 w-5" />
              )}
              {mode === "signup" ? t("signupWithGoogle") : t("loginWithGoogle")}
            </Button>
          </form>

          {/* 分隔線 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card text-muted-foreground">
                {t("orLoginWithEmail")}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Email 表單 */}
      <form onSubmit={handleEmailSubmit} className="space-y-4">
        {/* Email 輸入 */}
        <div className="space-y-2">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            disabled={isLoading}
            className="h-11"
          />
        </div>

        {/* 密碼輸入（忘記密碼模式不顯示） */}
        {mode !== "forgot" && (
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
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
        )}

        {/* 確認密碼輸入（僅註冊模式顯示） */}
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
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
        )}

        {/* 忘記密碼連結（僅登入模式顯示） */}
        {mode === "signin" && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-sm text-primary hover:underline"
            >
              {t("forgotPassword")}
            </button>
          </div>
        )}

        {/* 提交按鈕 */}
        <Button type="submit" disabled={isLoading} className="w-full h-11">
          {isEmailLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isLoading
            ? t("processing")
            : mode === "forgot"
              ? t("sendResetLink")
              : mode === "signup"
                ? t("register")
                : t("login")}
        </Button>
      </form>

      {/* 模式切換連結 */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "forgot" ? (
          <button
            onClick={() => switchMode("signin")}
            className="text-primary hover:underline"
          >
            {t("backToLogin")}
          </button>
        ) : mode === "signin" ? (
          <p>
            {t("noAccount")}{" "}
            <button
              onClick={() => switchMode("signup")}
              className="text-primary hover:underline font-medium"
            >
              {t("signUpNow")}
            </button>
          </p>
        ) : (
          <p>
            {t("hasAccount")}{" "}
            <button
              onClick={() => switchMode("signin")}
              className="text-primary hover:underline font-medium"
            >
              {t("signInNow")}
            </button>
          </p>
        )}
      </div>
    </>
  );
}
