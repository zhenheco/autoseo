"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function ScenarioCards() {
  const t = useTranslations("home.v6.scenarios");

  const personas = ["persona1", "persona2", "persona3"] as const;

  return (
    <section className="py-32 md:py-40">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {personas.map((key, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="text-center md:text-left flex flex-col"
            >
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {t(`${key}.name`)} · {t(`${key}.role`)}
              </p>
              <p className="text-foreground leading-relaxed mb-4 flex-1">
                {t(`${key}.story`)}
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {t(`${key}.metric`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
