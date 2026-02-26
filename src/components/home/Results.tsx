"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { fadeUpVariants, defaultViewport } from "@/lib/animations";
import {
  createCardStyle,
  createHeadingStyle,
  createTextStyle,
  gradientTextStyles,
  badgeStyles,
} from "@/lib/styles";

// Animated SVG Chart Component
function AnimatedChart() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(100);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Chart data points
  const beforePoints =
    "M 0 80 L 50 75 L 100 78 L 150 73 L 200 76 L 250 74 L 300 77";
  const afterPoints =
    "M 0 80 L 50 70 L 100 55 L 150 40 L 200 25 L 250 15 L 300 10";

  return (
    <div className="relative w-full h-64 bg-gradient-to-br from-mp-surface/60 to-mp-surface/40 rounded-2xl p-6 border border-mp-primary/20 backdrop-blur-sm">
      {/* Chart Background */}
      <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px] rounded-2xl" />

      {/* Chart Title */}
      <div className="relative z-10 mb-6">
        <h3 className="text-lg font-bold text-mp-text mb-1">網站流量成長</h3>
        <p className="text-sm text-mp-text-secondary">使用 1WaySEO 前後對比</p>
      </div>

      {/* SVG Chart */}
      <svg
        className="w-full h-32"
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
      >
        {/* Grid Lines */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Before Line */}
        <motion.path
          d={beforePoints}
          stroke="#94A3B8"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5,5"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
        />

        {/* After Line with Area */}
        <motion.path
          d={`${afterPoints} L 300 100 L 0 100 Z`}
          fill="url(#areaGradient)"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, delay: 1 }}
        />

        <motion.path
          d={afterPoints}
          stroke="url(#gradient)"
          strokeWidth="3"
          fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, delay: 1 }}
        />

        {/* Data Points */}
        {[50, 100, 150, 200, 250].map((x, i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={afterPoints.split(" ")[i * 3 + 2]}
            r="4"
            fill="#10B981"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.5 + i * 0.1, duration: 0.3 }}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-0.5 bg-mp-text-secondary opacity-60"
              style={{ borderTop: "2px dashed" }}
            />
            <span className="text-mp-text-secondary">使用前</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-mp-success" />
            <span className="text-mp-success">使用 1WaySEO 後</span>
          </div>
        </div>
        <div className="text-mp-success font-semibold">+247% 流量增長</div>
      </div>
    </div>
  );
}

export function Results() {
  const t = useTranslations("home");

  const stats = [
    {
      icon: "📈",
      value: "+247%",
      label: "平均流量增長",
      description: "使用後 3 個月內的平均表現",
      color: "text-mp-success",
      bgColor: "bg-mp-success/10",
      borderColor: "border-mp-success/30",
    },
    {
      icon: "⏱️",
      value: "10 分鐘",
      label: "平均生成時間",
      description: "從關鍵字輸入到文章完成",
      color: "text-mp-primary",
      bgColor: "bg-mp-primary/10",
      borderColor: "border-mp-primary/30",
    },
    {
      icon: "🎯",
      value: "#1-3",
      label: "平均搜尋排名",
      description: "目標關鍵字排名位置",
      color: "text-mp-accent",
      bgColor: "bg-mp-accent/10",
      borderColor: "border-mp-accent/30",
    },
  ];

  return (
    <section className="relative py-24 bg-mp-bg bg-noise overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-1/3 left-0 w-96 h-96 bg-mp-success/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-16"
        >
          <h2 className={createHeadingStyle("hero", "mb-6")}>
            數據證明
            <span className={`block ${gradientTextStyles.success}`}>
              真實成效
            </span>
          </h2>
          <p
            className={createTextStyle(
              "secondary",
              "",
              "text-xl max-w-2xl mx-auto",
            )}
          >
            超過 1000+ 創作者的真實使用數據，證明 AI 內容生成的驚人效果
          </p>
        </motion.div>

        {/* Chart Section */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="max-w-4xl mx-auto mb-16"
        >
          <AnimatedChart />
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              custom={index}
              variants={fadeUpVariants}
              initial="hidden"
              whileInView="visible"
              viewport={defaultViewport}
              className={`group relative ${createCardStyle("primary", `p-8 border-${stat.borderColor.split("-")[1]}-${stat.borderColor.split("-")[2]}`)} ${stat.borderColor}`}
            >
              {/* Icon */}
              <div
                className={`w-16 h-16 ${stat.bgColor} ${stat.borderColor} border rounded-2xl flex items-center justify-center mb-6 text-2xl`}
              >
                {stat.icon}
              </div>

              {/* Stats */}
              <div className="mb-4">
                <div
                  className={`text-4xl md:text-5xl font-bold font-geist ${stat.color} mb-2`}
                >
                  {stat.value}
                </div>
                <div className="text-lg font-semibold text-mp-text mb-2">
                  {stat.label}
                </div>
                <div className="text-sm text-mp-text-secondary">
                  {stat.description}
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="relative">
                <div className="w-full bg-mp-surface rounded-full h-2">
                  <motion.div
                    className={`h-2 rounded-full bg-gradient-to-r ${
                      stat.color === "text-mp-success"
                        ? "from-mp-success to-mp-primary"
                        : stat.color === "text-mp-primary"
                          ? "from-mp-primary to-mp-accent"
                          : "from-mp-accent to-mp-primary"
                    }`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${80 + index * 5}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + index * 0.2, duration: 1 }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="text-center mt-16"
        >
          <div className={badgeStyles.success}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            實際用戶數據，非模擬結果
          </div>
        </motion.div>
      </div>
    </section>
  );
}
