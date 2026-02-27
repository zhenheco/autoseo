"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  containerVariants,
  defaultViewport,
} from "@/lib/animations";
import { TrendingUp, Users, FileText, Clock } from "lucide-react";

export function Results() {
  const t = useTranslations("home");

  const stats = [
    {
      icon: Users,
      value: t("newDesign.statsUsers"),
      label: t("newDesign.statsUsersLabel"),
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      icon: FileText,
      value: t("newDesign.statsArticles"),
      label: t("newDesign.statsArticlesLabel"),
      color: "text-indigo-400",
      bg: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      icon: Clock,
      value: t("newDesign.statsTime"),
      label: t("newDesign.statsTimeLabel"),
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
    {
      icon: TrendingUp,
      value: "+340%",
      label: t("story.results.scene3.stat"),
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <section className="py-32 bg-slate-950 relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] bg-repeat pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-600/20 blur-[120px] rounded-[100%] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-sm font-bold text-slate-300 uppercase tracking-widest shadow-sm">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            {t("story.results.badge")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight">
            {t("story.results.title")}
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              variants={fadeUpVariants}
              className={`flex flex-col items-center justify-center p-8 rounded-3xl border backdrop-blur-sm transition-transform duration-300 hover:-translate-y-2 ${stat.bg}`}
            >
              <stat.icon className={`w-8 h-8 mb-6 ${stat.color}`} />
              <div className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tighter">
                {stat.value}
              </div>
              <div className="text-sm md:text-base font-medium text-slate-400 text-center">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
