"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";

export function FAQSection() {
  const t = useTranslations("home");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: t("faq.questions.whatIsCredits.question"),
      a: t("faq.questions.whatIsCredits.answer"),
    },
    {
      q: t("faq.questions.creditsPerArticle.question"),
      a: t("faq.questions.creditsPerArticle.answer"),
    },
    {
      q: t("faq.questions.creditsAccumulate.question"),
      a: t("faq.questions.creditsAccumulate.answer"),
    },
    {
      q: t("faq.questions.getMoreCredits.question"),
      a: t("faq.questions.getMoreCredits.answer"),
    },
    {
      q: t("faq.questions.paymentMethods.question"),
      a: t("faq.questions.paymentMethods.answer"),
    },
  ];

  return (
    <section className="py-32 bg-white relative overflow-hidden">
      <div className="container relative z-10 mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200 text-sm font-bold text-slate-600 uppercase tracking-widest">
            <MessageCircleQuestion className="w-4 h-4" />
            {t("newDesign.faqTitle")}
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            {t("faq.title")}
          </h2>
          <p className="text-xl text-slate-500 font-medium">
            {t("newDesign.faqDesc")}
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="space-y-4"
        >
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                variants={fadeUpVariants}
                className={`border rounded-2xl transition-all duration-300 ${
                  isOpen
                    ? "bg-slate-50 border-indigo-200 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span
                    className={`text-lg font-bold pr-8 ${isOpen ? "text-indigo-600" : "text-slate-900"}`}
                  >
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-indigo-500" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 pt-0 text-slate-600 leading-relaxed">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
