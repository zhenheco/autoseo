"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ClosingCTANew() {
  const t = useTranslations("home.v6.cta");

  return (
    <section className="py-32 md:py-40">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-5xl font-bold tracking-tight mb-10 text-balance"
        >
          {t("headline")}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-6"
        >
          <Link href="/signup">
            <Button
              size="lg"
              className="px-10 py-6 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all"
            >
              {t("button")}
            </Button>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-sm text-muted-foreground"
        >
          {t("note")}
        </motion.p>
      </div>
    </section>
  );
}
