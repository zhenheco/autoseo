"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { Target, Sparkles, Send } from "lucide-react";

export function ThreeSteps() {
  const t = useTranslations("home");

  const steps = [
    {
      icon: Target,
      title: t("newDesign.step1Title"),
      desc: t("newDesign.step1Desc"),
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
    },
    {
      icon: Sparkles,
      title: t("newDesign.step2Title"),
      desc: t("newDesign.step2Desc"),
      color: "text-fuchsia-400",
      bg: "bg-fuchsia-400/10 border-fuchsia-400/20",
    },
    {
      icon: Send,
      title: t("newDesign.step3Title"),
      desc: t("newDesign.step3Desc"),
      color: "text-sky-400",
      bg: "bg-sky-400/10 border-sky-400/20",
    },
  ];

  return (
    <section className="py-32 bg-slate-900 relative overflow-hidden">
      <div className="container relative z-10 mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-24 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-sm font-bold text-slate-300 uppercase tracking-widest">
            {t("story.threeSteps.badge")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight">
            {t("story.threeSteps.title")}
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
        >
          {/* Connector Line */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-800 z-0" />

          {steps.map((step, i) => (
            <motion.div
              key={i}
              variants={fadeUpVariants}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center border-2 backdrop-blur-md mb-8 shadow-2xl ${step.bg}`}
              >
                <step.icon className={`w-10 h-10 ${step.color}`} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                {step.title}
              </h3>
              <p className="text-slate-400 text-lg leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
