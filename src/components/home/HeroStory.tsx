"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import {
  createHeadingStyle,
  createTextStyle,
  buttonStyles,
  gradientTextStyles,
} from "@/lib/styles";
import { Moon, Clock, Sparkles } from "lucide-react";

export function HeroStory() {
  const t = useTranslations("home");

  return (
    <section className="relative min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden py-20 px-4">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-mp-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-mp-accent/10 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="container relative z-10 mx-auto max-w-5xl">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="flex flex-col items-center text-center space-y-10"
        >
          {/* Status Badge */}
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-md shadow-xl"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mp-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-mp-accent"></span>
            </span>
            <span className="text-xs font-medium text-slate-300 tracking-wider flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {t("story.hero.scene")}
            </span>
          </motion.div>

          {/* Emotional Headline */}
          <motion.div variants={fadeUpVariants} className="space-y-4">
            <h1
              className={createHeadingStyle(
                "hero",
                "text-4xl md:text-6xl lg:text-7xl text-white leading-tight font-bold tracking-tight",
              )}
            >
              {t("heroTitle1")}
              <span
                className={`block md:inline-block ml-0 md:ml-3 ${gradientTextStyles.primary}`}
              >
                {t("heroTitle2")}
              </span>
            </h1>
            <p
              className={createTextStyle(
                "secondary",
                "",
                "text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto font-medium",
              )}
            >
              {t("story.hero.narration")}
            </p>
          </motion.div>

          {/* Interactive Card/Scene Visualization */}
          <motion.div
            variants={fadeUpVariants}
            className="w-full max-w-4xl aspect-[16/9] relative group mt-8"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-mp-primary/20 to-mp-accent/20 rounded-[2.5rem] blur-2xl group-hover:scale-105 transition-transform duration-500 opacity-50" />
            <div className="relative h-full w-full bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-1 overflow-hidden shadow-2xl">
              <div className="h-full w-full bg-slate-950 rounded-[2.25rem] relative overflow-hidden flex items-center justify-center">
                {/* Midnight Coding Scene Mockup */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-transparent" />

                <div className="relative z-10 w-full max-w-2xl p-8 space-y-6">
                  {/* Floating Code Snippets / UI Elements */}
                  <div className="flex gap-4">
                    <div className="h-3 w-3 rounded-full bg-red-500/50" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
                    <div className="h-3 w-3 rounded-full bg-green-500/50" />
                  </div>

                  <div className="space-y-4">
                    <div className="h-4 bg-slate-800 rounded-full w-full animate-shimmer" />
                    <div
                      className="h-4 bg-slate-800 rounded-full w-[90%] animate-shimmer"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <div
                      className="h-4 bg-slate-800 rounded-full w-[85%] animate-shimmer"
                      style={{ animationDelay: "0.4s" }}
                    />
                    <div
                      className="h-4 bg-slate-800 rounded-full w-[70%] animate-shimmer"
                      style={{ animationDelay: "0.6s" }}
                    />
                  </div>

                  <div className="pt-10 flex flex-col items-center gap-6">
                    <div className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl animate-float">
                      <p className="text-mp-accent font-medium italic text-lg md:text-xl">
                        {t("story.hero.question")}
                      </p>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 2, duration: 1 }}
                      className="px-8 py-5 bg-gradient-to-r from-mp-primary to-mp-accent rounded-3xl shadow-2xl shadow-mp-primary/20 flex items-center gap-4"
                    >
                      <Sparkles className="w-6 h-6 text-white animate-pulse" />
                      <span className="text-white font-bold text-xl tracking-wide">
                        {t("story.hero.answer")}
                      </span>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA Group */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col sm:flex-row items-center gap-6 pt-4"
          >
            <a
              href="/signup"
              className={`${buttonStyles.primary} !px-12 !py-5 !text-xl !rounded-2xl group overflow-hidden`}
            >
              <span className="relative z-10 flex items-center gap-2">
                {t("story.hero.cta")}
                <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </a>
            <div className="flex items-center gap-4 text-slate-500 text-sm font-medium">
              <span className="flex items-center gap-1.5 italic">
                <Moon className="w-4 h-4" />
                {t("noCreditCard")}
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              <span>{t("trustIndicators.freeArticles")}</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
          {t("discoverMore")}
        </span>
        <div className="w-px h-12 bg-gradient-to-b from-mp-primary to-transparent" />
      </motion.div>
    </section>
  );
}
