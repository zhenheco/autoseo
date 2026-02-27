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

const FAQItem = ({ faq, isOpen, onToggle }: any) => {
  return (
    <motion.div
      variants={fadeUpVariants}
      className="border-b border-border last:border-b-0"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-6 text-left"
      >
        <span
          className={`text-lg font-semibold pr-8 ${isOpen ? "text-primary" : "text-text-main"}`}
        >
          {faq.q}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-text-muted shrink-0 transition-transform duration-300 ${
            isOpen ? "rotate-180 text-primary" : ""
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
            <div className="pb-6 text-text-subtle leading-relaxed">{faq.a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export function FAQSection() {
  const t = useTranslations("home");
  const tFaq = useTranslations("faq");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    "whatIsCredits",
    "creditsPerArticle",
    "creditsAccumulate",
    "getMoreCredits",
    "paymentMethods",
  ].map((key) => ({
    q: tFaq(`questions.${key}.question`),
    a: tFaq(`questions.${key}.answer`),
  }));

  return (
    <section className="bg-bg-subtle section-padding">
      <div className="container-section max-w-3xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          variants={containerVariants}
          className="text-center mb-12"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 bg-accent text-primary-dark text-sm font-bold px-4 py-1.5 rounded-full mb-4"
          >
            <MessageCircleQuestion className="w-4 h-4" />
            {t("newDesign.faqTitle")}
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="text-3xl md:text-4xl font-bold text-text-main"
          >
            {tFaq("title")}
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="text-lg md:text-xl text-text-subtle max-w-2xl mx-auto"
          >
            {t("newDesign.faqDesc")}
          </motion.p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="bg-card border border-border rounded-card p-4"
        >
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
