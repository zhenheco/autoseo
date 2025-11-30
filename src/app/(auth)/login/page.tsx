import Link from "next/link";
import { Sparkles } from "lucide-react";
import { LoginForm } from "./login-form";
import { BackgroundGrid, CyberGlow } from "@/components/ui/background-effects";
import { GradientText } from "@/components/ui/shimmer-text";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden p-4">
      <BackgroundGrid variant="dark" />
      <CyberGlow position="top-right" color="violet" />
      <CyberGlow position="bottom-left" color="cyan" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-6">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-cyber-violet-500 to-cyber-magenta-500 flex items-center justify-center shadow-lg shadow-cyber-violet-500/30">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            <span className="text-white">歡迎使用 </span>
            <GradientText gradient="cyan-violet-magenta">1WaySEO</GradientText>
          </h1>
          <p className="text-base text-slate-400">使用 Google 帳號快速開始</p>
        </div>

        <div className="glass border-white/10 rounded-2xl p-8 shadow-xl backdrop-blur-xl">
          <LoginForm error={params.error} success={params.success} />
        </div>

        <p className="text-xs text-center text-slate-500 mt-8 px-8">
          繼續即表示您同意我們的{" "}
          <Link
            href="/terms"
            className="text-cyber-violet-400 underline underline-offset-2 hover:text-cyber-violet-300 transition-all"
          >
            服務條款
          </Link>{" "}
          和{" "}
          <Link
            href="/privacy"
            className="text-cyber-violet-400 underline underline-offset-2 hover:text-cyber-violet-300 transition-all"
          >
            隱私政策
          </Link>
        </p>
      </div>
    </div>
  );
}
