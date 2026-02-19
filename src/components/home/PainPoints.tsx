"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { DollarSign, Clock, BarChart3 } from "lucide-react";

const painItems = [
  {
    key: "outsource",
    icon: DollarSign,
    tagColor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    cardBg:
      "bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/30",
  },
  {
    key: "diy",
    icon: Clock,
    tagColor:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    cardBg:
      "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30",
  },
  {
    key: "chatgpt",
    icon: BarChart3,
    tagColor:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    cardBg:
      "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30",
  },
] as const;

export function PainPoints() {
  const t = useTranslations("home");

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-orange-50/50 to-amber-50/30 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-bold text-center text-slate-800 dark:text-white mb-12"
        >
          {t("story.painPoints.title")}
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {painItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className={`rounded-2xl border p-6 ${item.cardBg}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Icon className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${item.tagColor}`}
                  >
                    {t(`story.painPoints.${item.key}.tag`)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                  {t(`story.painPoints.${item.key}.title`)}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(`story.painPoints.${item.key}.desc`)}
                </p>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-lg text-slate-500 dark:text-slate-400 italic"
        >
          {t("story.painPoints.closing")}
        </motion.p>
      </div>
    </section>
  );
}
