"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function HeroStory() {
  const t = useTranslations("home");

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.3, duration: 0.6 },
    }),
  };

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 py-24 px-4 overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Scene */}
        <motion.p
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-lg md:text-xl text-slate-400 mb-8"
        >
          {t("story.hero.scene")}
        </motion.p>

        {/* Narration */}
        <motion.p
          custom={1}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-base md:text-lg text-slate-300 leading-relaxed mb-12 max-w-2xl mx-auto"
        >
          {t("story.hero.narration")}
        </motion.p>

        {/* Question */}
        <motion.p
          custom={2}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-xl md:text-2xl text-slate-200 italic mb-4"
        >
          {t("story.hero.question")}
        </motion.p>

        {/* Answer */}
        <motion.p
          custom={3}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-12"
        >
          {t("story.hero.answer")}
        </motion.p>

        {/* CTA */}
        <motion.div
          custom={4}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl hover:from-amber-400 hover:to-orange-500 transition-all duration-300 shadow-lg shadow-orange-500/25"
          >
            {t("story.hero.cta")}
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
      </div>
    </section>
  );
}
