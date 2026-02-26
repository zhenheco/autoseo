"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { createHeadingStyle } from "@/lib/styles";
import {
  Search,
  FileText,
  Globe,
  MousePointer2,
  Sparkles,
  Send,
} from "lucide-react";

const steps = [
  { key: "step1", icon: Search, color: "primary" },
  { key: "step2", icon: FileText, color: "accent" },
  { key: "step3", icon: Send, color: "success" },
] as const;

export function ThreeSteps() {
  const t = useTranslations("home");

  return (
    <section className="relative py-32 bg-slate-950 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-mp-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container relative z-10 mx-auto max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-24 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">
            <MousePointer2 className="w-4 h-4" />
            Simple Workflow
          </div>
          <h2
            className={createHeadingStyle(
              "hero",
              "text-4xl md:text-5xl lg:text-6xl text-white font-bold",
            )}
          >
            {t("story.threeSteps.title")}
          </h2>
        </motion.div>

        <div className="relative">
          {/* Vertical Progress Line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-mp-primary via-mp-accent to-mp-success opacity-20 hidden md:block" />

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
                {/* Number/Icon Bubble */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={`w-14 h-14 md:w-20 md:h-20 rounded-3xl bg-slate-900 border-2 flex items-center justify-center shadow-2xl transition-transform duration-500 group-hover:scale-110 ${
                      step.color === "primary"
                        ? "border-mp-primary/50 text-mp-primary shadow-mp-primary/20"
                        : step.color === "accent"
                          ? "border-mp-accent/50 text-mp-accent shadow-mp-accent/20"
                          : "border-mp-success/50 text-mp-success shadow-mp-success/20"
                    }`}
                  >
                    <step.icon className="w-6 h-6 md:w-10 md:h-10" />
                  </div>
                  {/* Step label for mobile */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-950 flex items-center justify-center text-xs font-black shadow-xl md:hidden">
                    0{index + 1}
                  </div>
                </div>

                {/* Content Card */}
                <div
                  className={`flex-1 w-full text-center ${index % 2 === 1 ? "md:text-right" : "md:text-left"}`}
                >
                  <div className="space-y-4">
                    <div
                      className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        step.color === "primary"
                          ? "bg-mp-primary/10 text-mp-primary"
                          : step.color === "accent"
                            ? "bg-mp-accent/10 text-mp-accent"
                            : "bg-mp-success/10 text-mp-success"
                      }`}
                    >
                      Step 0{index + 1}
                    </div>
                    <h3 className="text-2xl md:text-4xl font-bold text-white tracking-tight leading-tight">
                      {t(`story.threeSteps.${step.key}.title`)}
                    </h3>
                    <p className="text-lg md:text-xl text-slate-400 font-medium leading-relaxed max-w-lg mx-auto md:mx-0">
                      {t(`story.threeSteps.${step.key}.desc`)}
                    </p>

                    {/* Xiao Mei's Quote Aside */}
                    <div
                      className={`pt-6 flex flex-col ${index % 2 === 1 ? "md:items-end" : "md:items-start"}`}
                    >
                      <div className="relative group/aside inline-block max-w-xs md:max-w-md">
                        <div className="absolute inset-0 bg-white/5 rounded-2xl blur-xl opacity-0 group-hover/aside:opacity-100 transition-opacity" />
                        <div className="relative px-6 py-4 bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl italic">
                          <div className="absolute -top-2 left-4 md:left-auto md:right-4 flex items-center gap-1.5 px-2 py-0.5 bg-mp-accent rounded-full">
                            <Sparkles className="w-2.5 h-2.5 text-white" />
                            <span className="text-[8px] font-black text-white uppercase tracking-tighter">
                              Xiao Mei&apos;s Choice
                            </span>
                          </div>
                          <p className="text-sm md:text-base text-slate-500 font-jakarta leading-relaxed">
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

        {/* Bottom CTA Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={defaultViewport}
          transition={{ delay: 1 }}
          className="mt-32 text-center"
        >
          <div className="inline-flex flex-col items-center gap-4">
            <div className="w-px h-16 bg-gradient-to-b from-mp-success to-transparent opacity-50" />
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">
              Next: Your Profit Awaits
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
