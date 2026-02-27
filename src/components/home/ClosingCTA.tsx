"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { ArrowRight, CheckCircle2, Rocket } from "lucide-react";
import Link from "next/link";

export function ClosingCTA() {
  const t = useTranslations("home");

  return (
    <section className="relative py-32 bg-slate-950 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] bg-repeat pointer-events-none" />
      <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-1/2 -left-1/4 w-[800px] h-[800px] bg-violet-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4 max-w-5xl text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800 rounded-[3rem] p-12 md:p-20 shadow-2xl relative overflow-hidden"
        >
          {/* Inner Glow */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />

          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-8 shadow-inner"
          >
            <Rocket className="w-8 h-8 text-indigo-400" />
          </motion.div>

          <motion.h2
            variants={fadeUpVariants}
            className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6"
          >
            {t("newDesign.ctaTitle")}
          </motion.h2>

          <motion.p
            variants={fadeUpVariants}
            className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto"
          >
            {t("newDesign.ctaDesc")}
          </motion.p>

          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link
              href="/signup"
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 text-lg font-bold text-white bg-indigo-600 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(79,70,229,0.4)] w-full sm:w-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 transition-opacity duration-300 group-hover:opacity-90" />
              <span className="relative flex items-center gap-2">
                {t("newDesign.getStarted")}
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUpVariants}
            className="flex flex-wrap items-center justify-center gap-6 text-slate-400 text-sm font-medium mt-10"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {t("noCreditCard")}
            </span>
            <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {t("freeCredits")}
            </span>
            <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {t("story.finalCta.cancelAnytime")}
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
