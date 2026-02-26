"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2, ArrowRight, Sparkles, Rocket } from "lucide-react";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { createHeadingStyle } from "@/lib/styles";

export function ClosingCTA() {
  const t = useTranslations("home");

  return (
    <section className="relative py-40 bg-slate-950 overflow-hidden">
      {/* Sunrise-inspired glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] aspect-square bg-gradient-to-t from-mp-primary/20 via-mp-accent/5 to-transparent rounded-full blur-[160px] opacity-60 translate-y-1/2 pointer-events-none" />

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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-[0.3em]"
          >
            <Rocket className="w-4 h-4 text-mp-primary" />
            {t("joinCreators")}
          </motion.div>

          <motion.h2
            variants={fadeUpVariants}
            className={createHeadingStyle(
              "hero",
              "text-4xl md:text-6xl lg:text-7xl text-white font-black tracking-tighter leading-tight",
            )}
          >
            {t("story.closing.title")}
          </motion.h2>

          {/* Parallel lines - emotional punch */}
          <div className="space-y-4">
            {(["line1", "line2", "line3"] as const).map((key, index) => (
              <motion.p
                key={key}
                variants={fadeUpVariants}
                className="text-lg md:text-2xl text-slate-400 font-medium font-jakarta"
              >
                {t(`story.closing.${key}`)}
              </motion.p>
            ))}
          </div>

          <motion.p
            variants={fadeUpVariants}
            className="text-2xl md:text-3xl text-white font-bold italic py-4"
          >
            {t("story.closing.message")}
          </motion.p>

          {/* High-impact CTA */}
          <motion.div variants={fadeUpVariants} className="pt-6">
            <a
              href="/signup"
              className="group relative inline-flex items-center gap-4 px-12 py-6 text-xl font-black text-white bg-gradient-to-r from-mp-primary to-mp-accent rounded-[2.5rem] hover:scale-105 transition-all duration-500 shadow-2xl shadow-mp-primary/40 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-3 uppercase tracking-widest">
                {t("story.closing.cta")}
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </span>
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-10"
          >
            {(["trust1", "trust2", "trust3"] as const).map((key) => (
              <div key={key} className="flex items-center gap-2 group/trust">
                <div className="w-6 h-6 rounded-full bg-mp-success/10 flex items-center justify-center group-hover/trust:bg-mp-success/20 transition-colors">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mp-success" />
                </div>
                <span className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-widest">
                  {t(`story.closing.${key}`)}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Floating Sparkles decoration */}
      <div className="absolute top-1/4 left-10 opacity-20 animate-pulse">
        <Sparkles className="w-8 h-8 text-mp-primary" />
      </div>
      <div
        className="absolute bottom-1/4 right-10 opacity-20 animate-pulse"
        style={{ animationDelay: "1s" }}
      >
        <Sparkles className="w-6 h-6 text-mp-accent" />
      </div>
    </section>
  );
}
