"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  containerVariants,
  fadeUpVariants,
  defaultViewport,
} from "@/lib/animations";
import { Star, MessageCircleHeart } from "lucide-react";

export function SocialProof() {
  const t = useTranslations("home");

  const testimonials = [
    "item0",
    "item1",
    "item2",
    "item3",
    "item4",
    "item5",
  ].map((item) => ({
    name: t(`testimonials.${item}.name`),
    role: t(`testimonials.${item}.role`),
    company: t(`testimonials.${item}.company`),
    content: t(`testimonials.${item}.content`),
  }));

  return (
    <section className="dark-section section-padding">
      <div className="container-section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          variants={containerVariants}
          className="text-center mb-16"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 bg-primary/20 text-secondary text-sm font-bold px-4 py-1.5 rounded-full mb-4"
          >
            <MessageCircleHeart className="w-4 h-4" />
            {t("newDesign.testimonialTitle")}
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="text-3xl md:text-4xl font-bold"
          >
            {t("story.socialProof.title")}
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="text-lg md:text-xl max-w-2xl mx-auto"
          >
            {t("newDesign.testimonialDesc")}
          </motion.p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {testimonials.map((item, i) => (
            <motion.div
              key={i}
              variants={fadeUpVariants}
              className="dark bg-card border border-border rounded-card p-6 flex flex-col h-full hover:-translate-y-1 transition-transform duration-200"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-5 h-5 fill-cta text-cta" />
                ))}
              </div>
              <p className="text-foreground/80 leading-relaxed flex-1 mb-6">
                &quot;{item.content}&quot;
              </p>
              <div className="flex items-center pt-4 border-t border-border mt-auto">
                <div>
                  <div className="font-bold text-foreground">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.role}, {item.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
