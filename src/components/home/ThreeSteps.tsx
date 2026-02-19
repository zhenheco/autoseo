"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Search, FileText, Globe } from "lucide-react";

const steps = [
  { key: "step1", icon: Search, num: "01" },
  { key: "step2", icon: FileText, num: "02" },
  { key: "step3", icon: Globe, num: "03" },
] as const;

export function ThreeSteps() {
  const t = useTranslations("home");

  return (
    <section className="py-20 px-4 bg-white dark:bg-slate-900">
      <div className="max-w-3xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-bold text-center text-slate-800 dark:text-white mb-16"
        >
          {t("story.threeSteps.title")}
        </motion.h2>

        <div className="space-y-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className="flex gap-6"
              >
                {/* Step number */}
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-500/20">
                    {step.num}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                      {t(`story.threeSteps.${step.key}.title`)}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {t(`story.threeSteps.${step.key}.desc`)}
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 italic border-l-2 border-amber-300 dark:border-amber-700 pl-3">
                    {t(`story.threeSteps.${step.key}.aside`)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
