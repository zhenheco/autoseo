"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  const t = useTranslations("home.v6.hero");

  return (
    <section className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8"
        >
          {t("headline")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
        >
          {t("subheadline")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Link href="/signup">
            <Button
              size="lg"
              className="px-10 py-6 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all"
            >
              {t("cta")}
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
