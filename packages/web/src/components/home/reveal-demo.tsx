"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function RevealDemo() {
  const t = useTranslations("home.v6.reveal");

  return (
    <section className="py-32 md:py-40">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-5xl font-bold tracking-tight mb-6"
        >
          {t("headline")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-lg md:text-xl text-muted-foreground"
        >
          {t("description")}
        </motion.p>
      </div>
    </section>
  );
}
