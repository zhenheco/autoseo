"use client";

import { motion } from "framer-motion";
import { Star, MessageSquareQuote } from "lucide-react";
import { useTranslations } from "next-intl";

export function SocialProofSection() {
  const t = useTranslations("home.v5.socialProof");
  const tTestimonials = useTranslations("home.testimonials");

  const testimonials = [
    {
      nameKey: "item0.name",
      roleKey: "item0.role",
      quoteKey: "item0.content",
      initials: "CM",
      color: "from-indigo-500 to-violet-600",
      rating: 5,
    },
    {
      nameKey: "item1.name",
      roleKey: "item1.role",
      quoteKey: "item1.content",
      initials: "LM",
      color: "from-emerald-500 to-teal-600",
      rating: 5,
    },
    {
      nameKey: "item2.name",
      roleKey: "item2.role",
      quoteKey: "item2.content",
      initials: "WK",
      color: "from-amber-500 to-orange-600",
      rating: 5,
    },
    {
      nameKey: "item3.name",
      roleKey: "item3.role",
      quoteKey: "item3.content",
      initials: "ZY",
      color: "from-rose-500 to-pink-600",
      rating: 5,
    },
  ];

  return (
    <section className="section-padding relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-secondary/5 blur-[120px] rounded-full -z-10" />

      <div className="container-section mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-block px-4 py-1 rounded-full bg-foreground/5 border border-foreground/10 text-secondary text-xs font-bold uppercase tracking-widest mb-4"
        >
          {t("badge")}
        </motion.div>
        <h2 className="mb-4">{t("title")}</h2>
        <p className="text-text-sub max-w-2xl mx-auto">{t("description")}</p>
      </div>

      <div className="container-section grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {testimonials.map((testimonial, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex flex-col group hover:border-secondary/50 transition-colors duration-500"
          >
            <div className="flex gap-1 mb-4">
              {[...Array(testimonial.rating)].map((_, j) => (
                <Star
                  key={j}
                  className="w-4 h-4 fill-secondary text-secondary"
                />
              ))}
            </div>

            <p className="text-text-sub text-sm leading-relaxed flex-1 mb-8 italic">
              &ldquo;{tTestimonials(testimonial.quoteKey)}&rdquo;
            </p>

            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white text-sm font-bold border border-foreground/10`}
              >
                {testimonial.initials}
              </div>
              <div>
                <div className="font-bold text-sm text-foreground">
                  {tTestimonials(testimonial.nameKey)}
                </div>
                <div className="text-text-dim text-xs">
                  {tTestimonials(testimonial.roleKey)}
                </div>
              </div>
            </div>

            <div className="absolute top-6 right-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <MessageSquareQuote className="w-8 h-8" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Floating Badge */}
      <div className="mt-16 flex justify-center">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="px-6 py-3 rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center gap-3 backdrop-blur-md"
        >
          <div className="flex -space-x-2">
            {["#6366F1", "#10B981", "#F59E0B", "#EC4899"].map((bg, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: bg }}
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          <div className="text-sm font-medium">
            {t("joinUsers", { count: "500" })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
