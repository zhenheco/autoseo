"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { createHeadingStyle, createTextStyle } from "@/lib/styles";
import { CheckCircle2, Zap, ArrowRight } from "lucide-react";

const featureKeys = ["feature1", "feature2", "feature3", "feature4"] as const;

export function TurningPoint() {
  const t = useTranslations("home");

  return (
    <section className="relative overflow-hidden">
      {/* Narrative Section - The Transition */}
      <div className="relative bg-slate-950 pt-32 pb-20 px-4 overflow-hidden">
        {/* Abstract Light Beam */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-mp-primary/50 via-mp-accent/20 to-transparent opacity-30" />

        <div className="container relative z-10 mx-auto max-w-4xl text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="space-y-8"
          >
            <motion.div
              variants={fadeUpVariants}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-widest"
            >
              <Zap className="w-3 h-3 text-mp-accent" />
              The Turning Point
            </motion.div>

            <motion.h2
              variants={fadeUpVariants}
              className={createHeadingStyle(
                "hero",
                "text-4xl md:text-6xl text-white font-bold tracking-tight",
              )}
            >
              {t("story.turningPoint.title")}
            </motion.h2>

            <motion.div variants={fadeUpVariants} className="space-y-6">
              <p
                className={createTextStyle(
                  "secondary",
                  "",
                  "text-xl md:text-2xl text-slate-300 leading-relaxed font-medium",
                )}
              >
                {t("story.turningPoint.intro")}
              </p>
              <p className="text-lg text-slate-500 italic font-jakarta">
                {t("story.turningPoint.halfDoubt")}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Discovery Section - The Realization */}
      <div className="relative bg-gradient-to-b from-slate-950 to-slate-900 pb-32 px-4">
        <div className="container relative z-10 mx-auto max-w-5xl">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {featureKeys.map((key, index) => (
              <motion.div
                key={key}
                variants={fadeUpVariants}
                className="group flex items-start gap-4 bg-slate-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 hover:border-mp-primary/30 transition-all duration-500 hover:shadow-2xl hover:shadow-mp-primary/5"
              >
                <div className="w-10 h-10 rounded-full bg-mp-primary/10 border border-mp-primary/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-mp-primary/20 transition-transform">
                  <CheckCircle2 className="w-5 h-5 text-mp-primary" />
                </div>
                <div className="space-y-2">
                  <span className="text-lg md:text-xl text-slate-200 font-medium leading-snug group-hover:text-white transition-colors">
                    {t(`story.turningPoint.${key}`)}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Emotional Climax */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={defaultViewport}
            transition={{ delay: 0.8 }}
            className="mt-20 text-center"
          >
            <div className="inline-block relative">
              <div className="absolute -inset-4 bg-mp-accent/20 blur-2xl rounded-full opacity-50 animate-pulse" />
              <p className="relative text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-mp-primary to-mp-accent italic">
                &quot;{t("story.turningPoint.reaction")}&quot;
              </p>
            </div>
          </motion.div>
        </div>

        {/* Subtle decorative arrow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-20 h-20 bg-slate-900 rounded-full border border-white/5 flex items-center justify-center shadow-2xl">
          <ArrowRight className="w-8 h-8 text-mp-primary animate-bounce-horizontal" />
        </div>
      </div>
    </section>
  );
}
