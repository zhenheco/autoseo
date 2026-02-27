"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { DollarSign, Clock, BarChart3, LucideIcon } from "lucide-react";
import {
  containerVariants,
  fadeUpVariants,
  defaultViewport,
} from "@/lib/animations";

interface PainPoint {
  key: "outsource" | "diy" | "chatgpt";
  icon: LucideIcon;
}

const painItems: PainPoint[] = [
  { key: "outsource", icon: DollarSign },
  { key: "diy", icon: Clock },
  { key: "chatgpt", icon: BarChart3 },
];

export function PainPoints() {
  const t = useTranslations("home");

  return (
    <section className="bg-bg-subtle section-padding">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={defaultViewport}
        className="container-section"
      >
        <motion.h2
          variants={fadeUpVariants}
          className="text-center text-3xl md:text-4xl font-bold text-text-main mb-12"
        >
          {t("story.painPoints.title")}
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {painItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.key}
                variants={fadeUpVariants}
                className="card-base card-hover-lift p-6"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-accent rounded-lg p-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-text-main">
                    {t(`story.painPoints.${item.key}.title`)}
                  </h3>
                </div>
                <p className="text-text-subtle">
                  {t(`story.painPoints.${item.key}.desc`)}
                </p>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          variants={fadeUpVariants}
          className="text-center text-lg text-text-subtle"
        >
          {t("story.painPoints.closing")}
        </motion.p>
      </motion.div>
    </section>
  );
}
