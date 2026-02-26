"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { Search, FileText, MousePointer2, Sparkles, Send } from "lucide-react";

const steps = [
  { key: "step1", icon: Search },
  { key: "step2", icon: FileText },
  { key: "step3", icon: Send },
] as const;

export function ThreeSteps() {
  const t = useTranslations("home");

  return (
    <section className="relative py-32 bg-slate-900 overflow-hidden">
      <div className="container relative z-10 mx-auto max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-24 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-sm font-bold text-white uppercase tracking-widest">
            <MousePointer2 className="w-4 h-4 text-blue-500" />
            {t("story.threeSteps.badge")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl text-white font-bold tracking-tight">
            {t("story.threeSteps.title")}
          </h2>
        </motion.div>

        <div className="relative">
          {/* Vertical Progress Line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-slate-700 hidden md:block" />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="space-y-24 md:space-y-32"
          >
            {steps.map((step, index) => (
              <motion.div
                key={step.key}
                variants={fadeUpVariants}
                className={`relative flex flex-col md:flex-row items-center gap-8 md:gap-16 ${
                  index % 2 === 1 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div className="relative z-10 flex-shrink-0">
                  <div className="w-14 h-14 md:w-20 md:h-20 rounded-3xl bg-blue-600 border-4 border-slate-900 flex items-center justify-center shadow-xl transition-transform duration-500 group-hover:scale-110 text-white">
                    <step.icon className="w-6 h-6 md:w-10 md:h-10" />
                  </div>
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center text-xs font-black shadow-xl md:hidden">
                    0{index + 1}
                  </div>
                </div>

                <div
                  className={`flex-1 w-full text-center bg-slate-800 p-8 rounded-3xl border border-slate-700 hover:border-blue-500 transition-colors duration-200 ${index % 2 === 1 ? "md:text-right" : "md:text-left"}`}
                >
                  <div className="space-y-4">
                    <div className="inline-block px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-slate-700 text-blue-400">
                      {t("story.threeSteps.stepLabel", {
                        step: String(index + 1),
                      })}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                      {t(`story.threeSteps.${step.key}.title`)}
                    </h3>
                    <p className="text-lg text-slate-300 font-medium leading-relaxed max-w-lg mx-auto md:mx-0">
                      {t(`story.threeSteps.${step.key}.desc`)}
                    </p>

                    <div
                      className={`pt-6 flex flex-col ${index % 2 === 1 ? "md:items-end" : "md:items-start"}`}
                    >
                      <div className="relative inline-block max-w-xs md:max-w-md">
                        <div className="relative px-6 py-4 bg-slate-900 border border-slate-700 rounded-2xl italic shadow-inner">
                          <div className="absolute -top-3 left-4 md:left-auto md:right-4 flex items-center gap-1.5 px-3 py-1 bg-orange-500 rounded-full">
                            <Sparkles className="w-3 h-3 text-white" />
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                              {t("story.threeSteps.xiaoMeiChoice")}
                            </span>
                          </div>
                          <p className="text-sm md:text-base text-slate-400 leading-relaxed mt-2">
                            &quot;{t(`story.threeSteps.${step.key}.aside`)}
                            &quot;
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
