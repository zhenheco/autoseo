"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { TrendingUp, Users, FileText, Clock, LucideIcon } from "lucide-react";

interface Stat {
  icon: LucideIcon;
  value: string;
  label: string;
}

export function Results() {
  const t = useTranslations("home");

  const stats: Stat[] = [
    {
      icon: Users,
      value: t("newDesign.statsUsers"),
      label: t("newDesign.statsUsersLabel"),
    },
    {
      icon: FileText,
      value: t("newDesign.statsArticles"),
      label: t("newDesign.statsArticlesLabel"),
    },
    {
      icon: Clock,
      value: t("newDesign.statsTime"),
      label: t("newDesign.statsTimeLabel"),
    },
    {
      icon: TrendingUp,
      value: "+340%",
      label: t("story.results.scene3.stat"),
    },
  ];

  return (
    <section className="bg-bg-main section-padding">
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
            className="inline-flex items-center gap-2 bg-accent text-primary-dark text-sm font-bold px-4 py-1.5 rounded-full mb-4"
          >
            <TrendingUp className="w-4 h-4 text-primary" />
            {t("story.results.badge")}
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="text-3xl md:text-4xl font-bold text-text-main"
          >
            {t("story.results.title")}
          </motion.h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              variants={fadeUpVariants}
              className="card-base card-hover-lift p-6 text-center"
            >
              <div className="w-fit mx-auto bg-accent rounded-lg p-2 mb-4">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-4xl font-bold text-primary tracking-tight">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-text-subtle mt-1">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
