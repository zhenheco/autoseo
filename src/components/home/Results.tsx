"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { TrendingUp, Clock, Wallet, Star } from "lucide-react";

function AnimatedChart({ t }: { t: (key: string) => string }) {
  const beforePoints =
    "M 0 80 L 50 78 L 100 82 L 150 78 L 200 81 L 250 79 L 300 82";
  const afterPoints =
    "M 0 80 L 50 65 L 100 45 L 150 25 L 200 15 L 250 10 L 300 5";

  return (
    <div className="relative w-full aspect-[21/9] md:aspect-[3/1] bg-slate-800 rounded-3xl p-8 md:p-12 border border-slate-700 overflow-hidden group shadow-lg">
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              {t("story.results.chartTitle")}
            </h3>
            <p className="text-sm text-slate-300 font-medium">
              {t("story.results.chartDesc")}
            </p>
          </div>
          <div className="px-5 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold text-lg md:text-xl">
            +340.2% Growth
          </div>
        </div>

        <div className="relative flex-1 mt-10">
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 300 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id="chartGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="1" />
              </linearGradient>
              <linearGradient
                id="chartAreaGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d={beforePoints}
              stroke="#64748B"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4,4"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 0.5 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5 }}
            />
            <motion.path
              d={`${afterPoints} L 300 100 L 0 100 Z`}
              fill="url(#chartAreaGradient)"
              initial={{ opacity: 0, scaleY: 0 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, delay: 0.5, ease: "easeOut" }}
              style={{ originY: 1 }}
            />
            <motion.path
              d={afterPoints}
              stroke="url(#chartGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, delay: 0.2, ease: "easeInOut" }}
            />
            <motion.circle
              cx="300"
              cy="5"
              r="6"
              fill="#2563EB"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 2.2, type: "spring" }}
            />
          </svg>
        </div>
        <div className="flex items-center justify-between mt-8 text-xs font-bold uppercase tracking-widest text-slate-300">
          <span>{t("story.results.month1")}</span>
          <span>{t("story.results.month2")}</span>
          <span>{t("story.results.month3")}</span>
        </div>
      </div>
    </div>
  );
}

export function Results() {
  const t = useTranslations("home");

  const results = [
    { id: "scene1", icon: Clock },
    { id: "scene2", icon: Wallet },
    { id: "scene3", icon: TrendingUp },
  ];

  return (
    <section className="relative py-32 bg-slate-900 overflow-hidden">
      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-sm font-bold text-white uppercase tracking-widest">
            <Star className="w-4 h-4 text-orange-500 fill-current" />
            {t("story.results.badge")}
          </div>
          <h2 className="text-4xl md:text-6xl font-bold text-white">
            {t("story.results.title")}
          </h2>
        </motion.div>

        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="max-w-6xl mx-auto mb-20"
        >
          <AnimatedChart t={t} />
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {results.map((item) => (
            <motion.div
              key={item.id}
              variants={fadeUpVariants}
              className="group relative bg-slate-800 p-10 rounded-3xl border border-slate-700 flex flex-col justify-between min-h-[320px] hover:border-blue-500 transition-colors duration-200 hover:shadow-xl cursor-pointer"
            >
              <div className="space-y-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-700 text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                  <item.icon className="w-8 h-8" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white">
                    {t(`story.results.${item.id}.title`)}
                  </h3>
                  <p className="text-slate-300 text-base leading-relaxed">
                    {t(`story.results.${item.id}.desc`)}
                  </p>
                </div>
              </div>
              <div className="pt-8 border-t border-slate-700 mt-auto">
                <div className="text-3xl font-black text-blue-500">
                  {t(`story.results.${item.id}.stat`)}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
