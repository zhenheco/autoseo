"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Clock, DollarSign, TrendingUp } from "lucide-react";

const scenes = [
  {
    key: "scene1",
    icon: Clock,
    accent: "text-emerald-600 dark:text-emerald-400",
    statBg:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "scene2",
    icon: DollarSign,
    accent: "text-amber-600 dark:text-amber-400",
    statBg:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  },
  {
    key: "scene3",
    icon: TrendingUp,
    accent: "text-orange-600 dark:text-orange-400",
    statBg:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  },
] as const;

export function Results() {
  const t = useTranslations("home");

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-amber-50/50 to-white dark:from-slate-800 dark:to-slate-900">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-bold text-center text-slate-800 dark:text-white mb-12"
        >
          {t("story.results.title")}
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6">
          {scenes.map((scene, index) => {
            const Icon = scene.icon;
            return (
              <motion.div
                key={scene.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className="relative bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-amber-100 dark:border-slate-700 shadow-sm"
              >
                <Icon className={`h-8 w-8 ${scene.accent} mb-4`} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                  {t(`story.results.${scene.key}.title`)}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  {t(`story.results.${scene.key}.desc`)}
                </p>
                <span
                  className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${scene.statBg}`}
                >
                  {t(`story.results.${scene.key}.stat`)}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
