"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { Target, Sparkles, Send, LucideIcon } from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export function ThreeSteps() {
  const t = useTranslations("home");

  const steps: Step[] = [
    {
      icon: Target,
      title: t("newDesign.step1Title"),
      desc: t("newDesign.step1Desc"),
    },
    {
      icon: Sparkles,
      title: t("newDesign.step2Title"),
      desc: t("newDesign.step2Desc"),
    },
    {
      icon: Send,
      title: t("newDesign.step3Title"),
      desc: t("newDesign.step3Desc"),
    },
  ];

  return (
    <section className="bg-bg-main section-padding">
      <div className="container-section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          variants={containerVariants}
          className="text-center mb-16"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center bg-accent text-primary-dark text-sm font-bold px-4 py-1.5 rounded-full mb-4"
          >
            {t("story.threeSteps.badge")}
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="text-3xl md:text-4xl font-bold text-text-main"
          >
            {t("story.threeSteps.title")}
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
        >
          {/* Dashed Connector Line */}
          <div className="hidden md:block absolute top-10 left-0 w-full h-px">
            <svg width="100%" height="100%">
              <line
                x1="16.66%"
                y1="0"
                x2="83.33%"
                y2="0"
                strokeWidth="2"
                strokeDasharray="8 8"
                className="stroke-border-main"
              />
            </svg>
          </div>

          {steps.map((step, i) => (
            <motion.div
              key={i}
              variants={fadeUpVariants}
              className="relative z-10 flex flex-col items-center text-center p-6"
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center bg-card border-4 border-bg-main mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-accent">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-text-main mb-2">
                {step.title}
              </h3>
              <p className="text-text-subtle leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
