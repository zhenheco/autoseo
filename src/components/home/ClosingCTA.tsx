"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";

export function ClosingCTA() {
  const t = useTranslations("home");

  return (
    <section className="relative py-24 px-4 bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden">
      {/* Warm bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-amber-500/15 to-transparent rounded-full blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-4xl font-bold text-white mb-10"
        >
          {t("story.closing.title")}
        </motion.h2>

        {/* Parallel lines */}
        <div className="space-y-3 mb-10">
          {(["line1", "line2", "line3"] as const).map((key, index) => (
            <motion.p
              key={key}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="text-lg text-slate-400"
            >
              {t(`story.closing.${key}`)}
            </motion.p>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-xl text-slate-200 font-medium mb-10"
        >
          {t("story.closing.message")}
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
        >
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-10 py-5 text-lg font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl hover:from-amber-400 hover:to-orange-500 transition-all duration-300 shadow-lg shadow-orange-500/25"
          >
            {t("story.closing.cta")}
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        </motion.div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-slate-500">
          {(["trust1", "trust2", "trust3"] as const).map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>{t(`story.closing.${key}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
