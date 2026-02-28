"use client";

import { motion } from "framer-motion";
import {
  User,
  ShieldCheck,
  Zap,
  DollarSign,
  Clock,
  LayoutGrid,
} from "lucide-react";
import { useTranslations } from "next-intl";

export function RoiComparison() {
  const t = useTranslations("home.v5.roi");

  const traditionalItems = [
    { icon: User, text: t("traditional.item1") },
    { icon: LayoutGrid, text: t("traditional.item2") },
    { icon: Clock, text: t("traditional.item3") },
    { icon: DollarSign, text: t("traditional.item4") },
  ];

  const oneWaySeoItems = [
    { icon: ShieldCheck, text: t("oneWaySeo.item1") },
    { icon: Zap, text: t("oneWaySeo.item2") },
    { icon: Clock, text: t("oneWaySeo.item3") },
    { icon: DollarSign, text: t("oneWaySeo.item4") },
  ];

  return (
    <section className="section-padding relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="container-section text-center mb-16">
        <h2 className="mb-4">{t("title")}</h2>
        <p className="text-text-sub max-w-2xl mx-auto text-lg">
          {t("description")}
        </p>
      </div>

      <div className="container-section grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Traditional Side */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative p-8 rounded-2xl border border-red-500/20 bg-red-500/5 group overflow-hidden"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2 opacity-70">
              {t("traditional.title")}
            </h3>
            <div className="text-4xl font-bold mb-8 text-red-400">
              {t("traditional.cost")}
              <span className="text-lg opacity-60 font-medium ml-1">
                {t("perMonth")}
              </span>
            </div>
            <ul className="space-y-4">
              {traditionalItems.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-text-sub">
                  <item.icon className="w-5 h-5 opacity-60" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* 1WaySEO Side */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative p-8 md:p-12 rounded-2xl border border-primary/40 bg-primary/10 shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] overflow-hidden scale-105 z-20 bg-card"
        >
          <div className="absolute top-0 right-0 px-4 py-1 bg-primary text-white text-xs font-bold rounded-bl-xl uppercase tracking-widest">
            {t("recommended")}
          </div>

          <div className="relative z-10">
            <h3 className="text-xl md:text-2xl font-bold mb-2">
              {t("oneWaySeo.title")}
            </h3>
            <div className="text-5xl md:text-6xl font-black mb-8 text-primary">
              {t("oneWaySeo.cost")}
              <span className="text-lg opacity-60 font-medium ml-1">
                {t("perMonth")}
              </span>
            </div>
            <ul className="space-y-4 mb-8">
              {oneWaySeoItems.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium">{item.text}</span>
                </li>
              ))}
            </ul>
            <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-between">
              <span className="text-sm text-text-dim uppercase tracking-wider font-bold">
                {t("monthlySavings")}
              </span>
              <span className="text-2xl font-bold text-secondary">
                {t("savingsAmount")}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
