"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { ArrowRight, Sparkles, CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";

export function HeroStory() {
  const t = useTranslations("home");

  return (
    <section className="relative min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden py-32 px-4 selection:bg-indigo-500/30">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-[35rem] h-[35rem] bg-violet-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] bg-repeat" />
      </div>

      <div className="container relative z-10 mx-auto max-w-7xl">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="flex flex-col items-center text-center space-y-10"
        >
          {/* Badge */}
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-indigo-100 tracking-wide">
              {t("heroTagline")}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div variants={fadeUpVariants} className="space-y-8 max-w-5xl">
            <h1 className="text-6xl md:text-8xl font-black text-white leading-[1.1] tracking-tight">
              {t("heroTitle1")}
              <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 animate-gradient-x">
                {" "}
                {t("heroTitle2")}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
              {t("heroDescription")}
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col sm:flex-row items-center gap-5 pt-4"
          >
            <Link
              href="/signup"
              className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-lg font-bold text-white bg-indigo-600 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(79,70,229,0.4)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 transition-opacity duration-300 group-hover:opacity-90" />
              <span className="relative flex items-center gap-2">
                {t("freeStart")}
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>

            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-slate-300 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-2xl transition-all duration-300 hover:text-white backdrop-blur-sm"
            >
              {t("learnMore")}
            </a>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            variants={fadeUpVariants}
            className="flex items-center justify-center gap-6 text-slate-500 text-sm font-medium pt-2"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {t("noCreditCard")}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {t("freeCredits")}
            </span>
          </motion.div>

          {/* Visual Mockup - Abstract Data Flow */}
          <motion.div
            variants={fadeUpVariants}
            className="w-full max-w-6xl mt-24 relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-[2.5rem] blur opacity-20" />
            <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <div className="ml-4 px-3 py-1 rounded-full bg-slate-800 text-xs font-mono text-slate-400">
                  1wayseo-agent-dashboard
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel 1 */}
                <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800/50 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-400">
                      {t("newDesign.heroMockupKeyword")}
                    </span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="h-10 bg-slate-800/50 rounded-lg w-full animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-indigo-500/20 rounded-md" />
                    <div className="h-6 w-20 bg-violet-500/20 rounded-md" />
                  </div>
                </div>

                {/* Panel 2 (Main) */}
                <div className="lg:col-span-2 bg-slate-950/50 rounded-2xl p-6 border border-slate-800/50 flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-400">
                      {t("newDesign.heroMockupTitle")}
                    </span>
                    <span className="text-xs font-mono text-indigo-400">
                      100%
                    </span>
                  </div>
                  <div className="space-y-3 relative z-10">
                    <div className="h-4 w-3/4 bg-slate-800/80 rounded" />
                    <div className="h-4 w-full bg-slate-800/60 rounded" />
                    <div className="h-4 w-5/6 bg-slate-800/60 rounded" />
                    <div className="h-4 w-4/6 bg-slate-800/60 rounded" />
                  </div>
                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-800/50">
                    <div className="text-xs text-slate-500 font-mono">
                      Status:{" "}
                      <span className="text-emerald-400">
                        {t("newDesign.heroMockupComplete")}
                      </span>
                    </div>
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full border border-slate-900 bg-slate-800" />
                      <div className="w-6 h-6 rounded-full border border-slate-900 bg-indigo-800" />
                      <div className="w-6 h-6 rounded-full border border-slate-900 bg-violet-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
