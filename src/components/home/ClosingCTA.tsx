"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2, ArrowRight, Sparkles, Rocket } from "lucide-react";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";

export function ClosingCTA() {
  const t = useTranslations("home");

  return (
    <section className="relative py-40 bg-slate-50 overflow-hidden">
      <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="space-y-12"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-bold text-slate-800 uppercase tracking-widest"
          >
            <Rocket className="w-4 h-4 text-blue-600" />
            {t("joinCreators")}
          </motion.div>

          <motion.h2
            variants={fadeUpVariants}
            className="text-5xl md:text-6xl lg:text-7xl text-slate-900 font-bold tracking-tight leading-tight"
          >
            {t("story.closing.title")}
          </motion.h2>

          <div className="space-y-4">
            {(["line1", "line2", "line3"] as const).map((key) => (
              <motion.p
                key={key}
                variants={fadeUpVariants}
                className="text-lg md:text-2xl text-slate-600 font-medium"
              >
                {t(`story.closing.${key}`)}
              </motion.p>
            ))}
          </div>

          <motion.p
            variants={fadeUpVariants}
            className="text-2xl md:text-3xl text-blue-600 font-bold py-4"
          >
            {t("story.closing.message")}
          </motion.p>

          <motion.div variants={fadeUpVariants} className="pt-6">
            <a
              href="/signup"
              className="group relative inline-flex items-center gap-4 px-12 py-6 text-xl font-bold text-white bg-orange-500 rounded-[2.5rem] hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer"
            >
              <span className="relative z-10 flex items-center gap-3 uppercase tracking-widest">
                {t("story.closing.cta")}
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>
          </motion.div>

          <motion.div
            variants={fadeUpVariants}
            className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-10"
          >
            {(["trust1", "trust2", "trust3"] as const).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-xs md:text-sm font-bold text-slate-600 uppercase tracking-widest">
                  {t(`story.closing.${key}`)}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Floating Sparkles decoration */}
      <div className="absolute top-1/4 left-10 opacity-20 animate-pulse hidden md:block">
        <Sparkles className="w-8 h-8 text-blue-600" />
      </div>
      <div
        className="absolute bottom-1/4 right-10 opacity-20 animate-pulse hidden md:block"
        style={{ animationDelay: "1s" }}
      >
        <Sparkles className="w-6 h-6 text-orange-500" />
      </div>
    </section>
  );
}
