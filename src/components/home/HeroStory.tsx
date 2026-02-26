"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export function HeroStory() {
  const t = useTranslations("home");

  return (
    <section className="relative min-h-screen bg-slate-50 flex items-center justify-center overflow-hidden py-20 px-4">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="container relative z-10 mx-auto max-w-6xl">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="flex flex-col items-center text-center space-y-8"
        >
          {/* Status Badge */}
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-800 tracking-wide">
              {t("heroTagline")}
            </span>
          </motion.div>

          {/* Emotional Headline */}
          <motion.div variants={fadeUpVariants} className="space-y-6 max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 leading-tight tracking-tight">
              {t("heroTitle1")}
              <span className="block md:inline-block ml-0 md:ml-3 text-blue-600">
                {t("heroTitle2")}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto font-medium leading-relaxed">
              {t("heroDescription")}
            </p>
          </motion.div>

          {/* CTA Group */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col sm:flex-row items-center gap-6 pt-4"
          >
            <a
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl cursor-pointer"
            >
              {t("freeStart")}
              <ArrowRight className="w-5 h-5" />
            </a>
            <div className="flex items-center gap-4 text-slate-600 text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                {t("noCreditCard")}
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                {t("freeCredits")}
              </span>
            </div>
          </motion.div>

          {/* App Preview Mockup */}
          <motion.div
            variants={fadeUpVariants}
            className="w-full max-w-5xl aspect-[16/9] relative group mt-16 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white"
          >
            <div className="absolute inset-0 bg-slate-100 flex flex-col">
              {/* Mockup Header */}
              <div className="h-12 border-b border-slate-200 flex items-center px-4 gap-2 bg-white">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                </div>
              </div>
              {/* Mockup Body */}
              <div className="flex-1 p-8 flex flex-col gap-4 bg-slate-50">
                <div className="h-8 w-1/3 bg-slate-200 rounded-lg animate-pulse" />
                <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-4 shadow-sm">
                  <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-4/6 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
