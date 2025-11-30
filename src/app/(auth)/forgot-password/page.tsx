"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { BackgroundGrid, CyberGlow } from "@/components/ui/background-effects";
import { GradientText } from "@/components/ui/shimmer-text";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("請求失敗");
      }

      setIsSubmitted(true);
    } catch {
      setError("發送重設密碼郵件失敗，請稍後再試");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden p-4">
        <BackgroundGrid variant="dark" />
        <CyberGlow position="center" color="cyan" />

        <Card className="w-full max-w-md glass border-white/10 bg-transparent">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-gradient-to-br from-cyber-cyan-500 to-cyber-violet-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-cyber-cyan-500/30">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">郵件已發送</CardTitle>
            <CardDescription className="text-slate-400">
              我們已發送密碼重設連結到您的電子郵件
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400 text-center">
              請檢查您的收件匣（包括垃圾郵件資料夾），並點擊郵件中的連結來重設密碼。
            </p>
            <p className="text-sm text-slate-400 text-center">
              如果幾分鐘內沒有收到郵件，請嘗試重新發送。
            </p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button
              variant="outline"
              onClick={() => setIsSubmitted(false)}
              className="w-full border-cyber-violet-500/50 text-cyber-violet-400 hover:bg-cyber-violet-500/10 hover:border-cyber-violet-400"
            >
              重新發送郵件
            </Button>
            <Link href="/login" className="w-full">
              <Button
                variant="ghost"
                className="w-full text-slate-400 hover:text-white hover:bg-white/5"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回登入
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden p-4">
      <BackgroundGrid variant="dark" />
      <CyberGlow position="top-right" color="magenta" />
      <CyberGlow position="bottom-left" color="violet" />

      <Card className="w-full max-w-md glass border-white/10 bg-transparent">
        <CardHeader>
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 text-slate-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回登入
            </Button>
          </Link>
          <CardTitle className="text-2xl">
            <GradientText gradient="violet-magenta">忘記密碼</GradientText>
          </CardTitle>
          <CardDescription className="text-slate-400">
            輸入您的電子郵件地址，我們將發送密碼重設連結給您
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                電子郵件
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  className="pl-10 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-cyber-violet-500/50 focus:ring-cyber-violet-500/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyber-violet-600 to-cyber-magenta-600 hover:from-cyber-violet-500 hover:to-cyber-magenta-500 text-white border-0"
              disabled={isLoading}
            >
              {isLoading ? "發送中..." : "發送重設連結"}
            </Button>
            <p className="text-sm text-slate-400 text-center">
              記得密碼了？{" "}
              <Link
                href="/login"
                className="text-cyber-violet-400 hover:text-cyber-violet-300 hover:underline"
              >
                立即登入
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
