"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import {
  createCardStyle,
  createHeadingStyle,
  createTextStyle,
  gradientTextStyles,
} from "@/lib/styles";
import { TrendingUp, Clock, Wallet, BarChart3, Star } from "lucide-react";

// Refined SVG Chart Component
function AnimatedChart() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(100);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const beforePoints =
    "M 0 80 L 50 78 L 100 82 L 150 78 L 200 81 L 250 79 L 300 82";
  const afterPoints =
    "M 0 80 L 50 65 L 100 45 L 150 25 L 200 15 L 250 10 L 300 5";

  return (
    <div className="relative w-full aspect-[21/9] md:aspect-[3/1] bg-slate-900/40 rounded-[2.5rem] p-8 md:p-12 border border-white/5 backdrop-blur-3xl overflow-hidden group">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-mp-success" />
              SEO 流量翻倍成長
            </h3>
            <p className="text-sm text-slate-400 font-medium">
              基於 1000+ 真實用戶使用 3 個月後的平均數據
            </p>
          </div>
          <div className="px-5 py-2.5 rounded-2xl bg-mp-success/10 border border-mp-success/20 text-mp-success font-bold text-lg md:text-xl shadow-2xl shadow-mp-success/10">
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
                <stop offset="100%" stopColor="#10B981" stopOpacity="1" />
              </linearGradient>
              <linearGradient
                id="chartAreaGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Before Line (Dashed) */}
            <motion.path
              d={beforePoints}
              stroke="#475569"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4,4"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 0.5 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5 }}
            />

            {/* After Area */}
            <motion.path
              d={`${afterPoints} L 300 100 L 0 100 Z`}
              fill="url(#chartAreaGradient)"
              initial={{ opacity: 0, scaleY: 0 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, delay: 0.5, ease: "easeOut" }}
              style={{ originY: 1 }}
            />

            {/* After Line */}
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

            {/* Pulsing Data Point at the end */}
            <motion.circle
              cx="300"
              cy="5"
              r="6"
              fill="#10B981"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 2.2, type: "spring" }}
            />
            <motion.circle
              cx="300"
              cy="5"
              r="12"
              stroke="#10B981"
              strokeWidth="2"
              fill="none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 2], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 2.5 }}
            />
          </svg>
        </div>

        <div className="flex items-center justify-between mt-8 text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-500">
          <span>Month 1</span>
          <span>Month 2</span>
          <span>Month 3 (Today)</span>
        </div>
      </div>
    </div>
  );
}

export function Results() {
  const t = useTranslations("home");

  const results = [
    {
      id: "scene1",
      icon: Clock,
      color: "primary",
    },
    {
      id: "scene2",
      icon: Wallet,
      color: "success",
    },
    {
      id: "scene3",
      icon: TrendingUp,
      color: "accent",
    },
  ];

  return (
    <section className="relative py-32 bg-slate-950 overflow-hidden">
      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mp-success/10 border border-mp-success/20 text-xs font-bold text-mp-success uppercase tracking-[0.2em]">
            <Star className="w-3 h-3 fill-current" />
            The Success Story
          </div>
          <h2
            className={createHeadingStyle(
              "hero",
              "text-4xl md:text-6xl text-white font-bold",
            )}
          >
            {t("story.results.title")}
          </h2>
        </motion.div>

        {/* Chart */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="max-w-6xl mx-auto mb-20"
        >
          <AnimatedChart />
        </motion.div>

        {/* Narrative Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {results.map((item, index) => (
            <motion.div
              key={item.id}
              variants={fadeUpVariants}
              className={`group relative ${createCardStyle(item.color as any, "p-10 flex flex-col justify-between min-h-[320px]")}`}
            >
              <div className="space-y-6">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    item.color === "primary"
                      ? "bg-mp-primary/10 text-mp-primary"
                      : item.color === "success"
                        ? "bg-mp-success/10 text-mp-success"
                        : "bg-mp-accent/10 text-mp-accent"
                  }`}
                >
                  <item.icon className="w-8 h-8" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-white group-hover:text-mp-primary transition-colors">
                    {t(`story.results.${item.id}.title`)}
                  </h3>
                  <p className="text-slate-400 text-lg leading-relaxed group-hover:text-slate-300 transition-colors">
                    {t(`story.results.${item.id}.desc`)}
                  </p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 mt-auto">
                <div
                  className={`text-4xl font-black font-geist ${
                    item.color === "primary"
                      ? "text-mp-primary"
                      : item.color === "success"
                        ? "text-mp-success"
                        : "text-mp-accent"
                  }`}
                >
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
