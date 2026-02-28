"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function ContrastAnchor() {
  const t = useTranslations("home.v6.contrast");

  return (
    <section className="py-32 md:py-40">
      <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
        {["line1", "line2", "line3"].map((key, i) => (
          <motion.p
            key={key}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.3, duration: 0.6 }}
            className="text-xl md:text-2xl text-muted-foreground leading-relaxed"
          >
            {t(key)}
          </motion.p>
        ))}
      </div>
    </section>
  );
}
