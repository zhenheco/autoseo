"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";

const FAQ_KEYS = [
  { qKey: "q1", aKey: "a1" },
  { qKey: "q2", aKey: "a2" },
  { qKey: "q3", aKey: "a3" },
  { qKey: "q4", aKey: "a4" },
  { qKey: "q5", aKey: "a5" },
  { qKey: "q6", aKey: "a6" },
];

export function FAQSectionNew() {
  const t = useTranslations("home.v5.faq");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <section className="section-padding relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[160px] rounded-full -z-10" />

      <div className="container-section flex flex-col lg:flex-row gap-16">
        <div className="lg:w-1/3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/5 border border-foreground/10 text-primary text-xs font-bold uppercase tracking-widest mb-6">
              <HelpCircle className="w-3 h-3" />
              <span>{t("badge")}</span>
            </div>
            <h2 className="mb-6">{t("title")}</h2>
            <p className="text-text-sub">{t("description")}</p>
          </motion.div>
        </div>

        <div className="lg:w-2/3 space-y-4">
          {FAQ_KEYS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border transition-all duration-300 ${
                activeIndex === i
                  ? "border-primary/30 bg-primary/5 shadow-[0_0_30px_-10px_rgba(99,102,241,0.1)]"
                  : "border-foreground/5 bg-card hover:border-foreground/10"
              }`}
            >
              <button
                onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                className="w-full p-6 flex items-center justify-between text-left gap-4"
              >
                <span
                  className={`font-bold transition-colors ${activeIndex === i ? "text-primary" : "text-foreground"}`}
                >
                  {t(faq.qKey)}
                </span>
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border ${
                    activeIndex === i
                      ? "border-primary text-primary"
                      : "border-text-dim text-text-dim"
                  }`}
                >
                  {activeIndex === i ? (
                    <Minus className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {activeIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 text-text-sub leading-relaxed text-sm">
                      {t(faq.aKey)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
