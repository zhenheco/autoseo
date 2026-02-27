"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { ArrowRight, CheckCircle2, Rocket } from "lucide-react";
import Link from "next/link";

export function ClosingCTA() {
  const t = useTranslations("home");

  const features = [
    t("noCreditCard"),
    t("freeCredits"),
    t("finalCta.cancelAnytime"),
  ];

  return (
    <section className="bg-primary section-padding">
      <div className="container-section text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="flex flex-col items-center"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/10 mb-6"
          >
            <Rocket className="w-8 h-8 text-white" />
          </motion.div>

          <motion.h2
            variants={fadeUpVariants}
            className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4"
          >
            {t("newDesign.ctaTitle")}
          </motion.h2>

          <motion.p
            variants={fadeUpVariants}
            className="text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto"
          >
            {t("newDesign.ctaDesc")}
          </motion.p>

          <motion.div variants={fadeUpVariants}>
            <Link
              href="/signup"
              className="btn-cta group flex items-center gap-2 text-base w-fit mx-auto"
            >
              <span>{t("newDesign.getStarted")}</span>
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUpVariants}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-primary-foreground/70 text-sm mt-8"
          >
            {features.map((feature, index) => (
              <span key={index} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300" />
                {feature}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
