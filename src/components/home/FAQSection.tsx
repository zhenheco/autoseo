"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, Sparkles } from "lucide-react";
import { fadeUpVariants, defaultViewport } from "@/lib/animations";
import { createHeadingStyle } from "@/lib/styles";

const faqKeys = [
  "whatIsCredits",
  "creditsPerArticle",
  "creditsAccumulate",
  "getMoreCredits",
  "paymentMethods",
] as const;

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const t = useTranslations("faq");

  return (
    <section className="relative py-32 bg-slate-950 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-mp-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          variants={fadeUpVariants}
          className="text-center mb-20 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <HelpCircle className="w-4 h-4 text-mp-primary" />
            {t("title")}
          </div>
          <h2
            className={createHeadingStyle(
              "hero",
              "text-4xl md:text-5xl text-white font-bold tracking-tight",
            )}
          >
            {t("subtitle")}
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
            {t("description")}
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqKeys.map((key, index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={defaultViewport}
              transition={{ delay: index * 0.1 }}
              className={`group overflow-hidden rounded-[2rem] border transition-all duration-500 ${
                openIndex === index
                  ? "bg-slate-900 border-mp-primary/30 shadow-2xl shadow-mp-primary/5"
                  : "bg-slate-900/40 border-white/5 hover:border-white/10"
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-8 py-6 text-left flex items-center justify-between gap-4"
              >
                <span
                  className={`text-lg md:text-xl font-bold transition-colors duration-300 ${
                    openIndex === index
                      ? "text-white"
                      : "text-slate-300 group-hover:text-white"
                  }`}
                >
                  {t(`questions.${key}.question`)}
                </span>
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center transition-all duration-500 ${
                    openIndex === index
                      ? "rotate-180 bg-mp-primary border-mp-primary text-white"
                      : "text-slate-500"
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.04, 0.62, 0.23, 0.98],
                    }}
                  >
                    <div className="px-8 pb-8">
                      <div className="pt-4 border-t border-white/5">
                        <p className="text-slate-400 text-base md:text-lg leading-relaxed font-medium">
                          {t(`questions.${key}.answer`)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Support CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={defaultViewport}
          className="mt-20 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 border border-white/5 text-sm font-bold text-slate-500">
            <Sparkles className="w-4 h-4 text-mp-accent" />
            Still have questions?
            <a
              href="mailto:service@1wayseo.com"
              className="text-mp-primary hover:underline ml-1"
            >
              Contact Support
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
