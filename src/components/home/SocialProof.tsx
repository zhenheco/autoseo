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
    {
      name: t("testimonials.item0.name"),
      role: t("testimonials.item0.role"),
      company: t("testimonials.item0.company"),
      content: t("testimonials.item0.content"),
      metric: t("testimonials.item0.metricValue"),
      metricLabel: t("testimonials.item0.metricLabel"),
    },
    {
      name: t("testimonials.item1.name"),
      role: t("testimonials.item1.role"),
      company: t("testimonials.item1.company"),
      content: t("testimonials.item1.content"),
      metric: t("testimonials.item1.metricValue"),
      metricLabel: t("testimonials.item1.metricLabel"),
    },
    {
      name: t("testimonials.item2.name"),
      role: t("testimonials.item2.role"),
      company: t("testimonials.item2.company"),
      content: t("testimonials.item2.content"),
      metric: t("testimonials.item2.metricValue"),
      metricLabel: t("testimonials.item2.metricLabel"),
    },
    {
      name: t("testimonials.item3.name"),
      role: t("testimonials.item3.role"),
      company: t("testimonials.item3.company"),
      content: t("testimonials.item3.content"),
      metric: t("testimonials.item3.metricValue"),
      metricLabel: t("testimonials.item3.metricLabel"),
    },
    {
      name: t("testimonials.item4.name"),
      role: t("testimonials.item4.role"),
      company: t("testimonials.item4.company"),
      content: t("testimonials.item4.content"),
      metric: t("testimonials.item4.metricValue"),
      metricLabel: t("testimonials.item4.metricLabel"),
    },
    {
      name: t("testimonials.item5.name"),
      role: t("testimonials.item5.role"),
      company: t("testimonials.item5.company"),
      content: t("testimonials.item5.content"),
      metric: t("testimonials.item5.metricValue"),
      metricLabel: t("testimonials.item5.metricLabel"),
    },
  ];

  return (
    <section className="py-32 bg-white relative overflow-hidden">
      <div className="container relative z-10 mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-sm font-bold text-blue-600 uppercase tracking-widest">
            <MessageCircleHeart className="w-4 h-4" />
            {t("newDesign.testimonialTitle")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight">
            {t("story.socialProof.title")}
          </h2>
          <p className="text-xl text-slate-500 font-medium">
            {t("newDesign.testimonialDesc")}
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {testimonials.map((item, i) => (
            <motion.div
              key={i}
              variants={fadeUpVariants}
              className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 hover:shadow-xl transition-all duration-300 flex flex-col h-full"
            >
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    className="w-5 h-5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="text-slate-700 text-lg leading-relaxed flex-1 mb-8">
                &quot;{item.content}&quot;
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-auto">
                <div>
                  <div className="font-bold text-slate-900">{item.name}</div>
                  <div className="text-sm text-slate-500">
                    {item.role}, {item.company}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-blue-600 text-lg">
                    {item.metric}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {item.metricLabel}
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
