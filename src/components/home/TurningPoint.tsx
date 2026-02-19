"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";

const featureKeys = ["feature1", "feature2", "feature3", "feature4"] as const;

export function TurningPoint() {
  const t = useTranslations("home");

  return (
    <section className="relative overflow-hidden">
      {/* Dark top section */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-bold text-white mb-8"
          >
            {t("story.turningPoint.title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-300 text-base md:text-lg leading-relaxed mb-4"
          >
            {t("story.turningPoint.intro")}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-slate-400 mb-12"
          >
            {t("story.turningPoint.halfDoubt")}
          </motion.p>
        </div>
      </div>

      {/* Transition gradient + features */}
      <div className="bg-gradient-to-b from-slate-800 to-amber-50 dark:from-slate-700 dark:to-slate-800 py-16 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {featureKeys.map((key, index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="flex items-start gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border border-amber-200/50 dark:border-slate-600/50"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700 dark:text-slate-200">
                {t(`story.turningPoint.${key}`)}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="text-center text-xl md:text-2xl font-medium text-amber-700 dark:text-amber-400 italic mt-12"
        >
          {t("story.turningPoint.reaction")}
        </motion.p>
      </div>
    </section>
  );
}
