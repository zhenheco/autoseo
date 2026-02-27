"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function HeroStory() {
  const t = useTranslations("home");

  return (
    <section className="relative bg-bg-main overflow-hidden section-padding pt-32">
      <div className="absolute inset-0 pointer-events-none">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
        <div className="absolute top-1/2 right-0 w-1/3 h-1/2 bg-gradient-to-bl from-secondary/5 to-transparent opacity-30" />
      </div>

      <div className="container-section relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="flex flex-col items-center text-center space-y-8"
        >
          {/* Badge */}
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-primary-dark font-semibold"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm">{t("heroTagline")}</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUpVariants}
            className="text-4xl md:text-6xl font-extrabold text-text-main tracking-tighter leading-tight max-w-4xl"
          >
            {t("heroTitle1")}
            <span className="text-primary"> {t("heroTitle2")}</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={fadeUpVariants}
            className="text-lg md:text-xl text-text-subtle max-w-2xl mx-auto"
          >
            {t("heroDescription")}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col sm:flex-row items-center gap-4 pt-4"
          >
            <Link
              href="/signup"
              className="btn-cta group flex items-center gap-2 text-base"
            >
              <span>{t("freeStart")}</span>
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <a href="#features" className="btn-secondary text-base">
              {t("learnMore")}
            </a>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            variants={fadeUpVariants}
            className="flex items-center justify-center gap-x-6 gap-y-2 text-text-muted text-sm pt-4 flex-wrap"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-success" />
              {t("noCreditCard")}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-success" />
              {t("freeCredits")}
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
