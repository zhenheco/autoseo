"use client";

import { useState } from "react";
import Link from "next/link";
import { authenticateUser, signInWithGoogle } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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

interface LoginFormProps {
  error?: string;
  success?: string;
  unverified?: string;
  email?: string;
}

export function LoginForm({
  error,
  success,
  unverified,
  email,
}: LoginFormProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleResendVerification() {
    if (!email) return;

    setIsResending(true);
    setResendMessage("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendMessage(data.message || "驗證信已重新發送");
      } else {
        setResendMessage(data.error || "重發失敗，請稍後再試");
      }
    } catch (err) {
      setResendMessage("網路錯誤，請稍後再試");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <>
      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <p>{error}</p>
          {error.includes("尚未註冊") && (
            <div className="mt-2">
              <Link
                href="/signup"
                className="text-primary hover:text-primary/80 hover:underline underline-offset-4 font-semibold transition-all"
              >
                前往註冊 →
              </Link>
            </div>
          )}
          {unverified && email && (
            <div className="mt-3 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    發送中...
                  </>
                ) : (
                  "重新發送驗證信"
                )}
              </Button>
              {resendMessage && (
                <p className="text-xs text-center">{resendMessage}</p>
              )}
            </div>
          )}
        </div>
      )}

      <form
        action={async () => {
          setIsGoogleLoading(true);
          await signInWithGoogle();
        }}
        className="mb-6"
      >
        <Button
          type="submit"
          variant="outline"
          disabled={isGoogleLoading}
          className="w-full h-11 text-sm font-medium border-border hover:bg-accent transition-colors"
        >
          {isGoogleLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 h-5 w-5" />
          )}
          使用 Google 帳號繼續
        </Button>
      </form>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            或使用 Email
          </span>
        </div>
      </div>

      <form
        action={async (formData) => {
          setIsSubmitting(true);
          await authenticateUser(formData);
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
          >
            電子郵件
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="your@email.com"
            required
            className="h-11 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              密碼
            </Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:text-primary/80 hover:underline underline-offset-4 font-medium transition-all"
            >
              忘記密碼？
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={6}
            className="h-11 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              登入中...
            </>
          ) : (
            "繼續"
          )}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-center text-sm text-muted-foreground">
          還沒有帳號？{" "}
          <Link
            href="/signup"
            className="text-primary hover:text-primary/80 hover:underline underline-offset-4 font-semibold transition-all"
          >
            立即註冊
          </Link>
        </p>
      </div>
    </>
  );
}
