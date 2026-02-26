"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { CheckCircle2, Zap } from "lucide-react";

const featureKeys = ["feature1", "feature2", "feature3", "feature4"] as const;

export function TurningPoint() {
  const t = useTranslations("home");

  return (
    <section className="relative overflow-hidden bg-slate-50 py-32 px-4">
      <div className="container relative z-10 mx-auto max-w-5xl">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="text-center space-y-8 mb-16"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-bold text-slate-800 uppercase tracking-widest"
          >
            <Zap className="w-4 h-4 text-orange-500" />
            {t("story.turningPoint.badge")}
          </motion.div>

          <motion.h2
            variants={fadeUpVariants}
            className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight"
          >
            {t("story.turningPoint.title")}
          </motion.h2>

          <motion.div
            variants={fadeUpVariants}
            className="space-y-4 max-w-3xl mx-auto"
          >
            <p className="text-xl md:text-2xl text-slate-700 leading-relaxed font-medium">
              {t("story.turningPoint.intro")}
            </p>
            <p className="text-lg text-slate-500 italic">
              {t("story.turningPoint.halfDoubt")}
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {featureKeys.map((key) => (
            <motion.div
              key={key}
              variants={fadeUpVariants}
              className="group flex items-start gap-4 bg-white rounded-3xl p-8 border border-slate-200 hover:border-blue-500 transition-colors duration-200 hover:shadow-lg cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors duration-200">
                <CheckCircle2 className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors duration-200" />
              </div>
              <div className="space-y-2 pt-1">
                <span className="text-lg md:text-xl text-slate-800 font-bold leading-snug">
                  {t(`story.turningPoint.${key}`)}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ delay: 0.4 }}
          className="mt-20 text-center"
        >
          <p className="text-2xl md:text-4xl font-bold text-blue-600 italic">
            &quot;{t("story.turningPoint.reaction")}&quot;
          </p>
        </motion.div>
      </div>
    </section>
  );
}
