"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { fadeUpVariants, defaultViewport } from "@/lib/animations";
import {
  createHeadingStyle,
  createTextStyle,
  buttonStyles,
  gradientTextStyles,
  backgroundStyles,
} from "@/lib/styles";

export function HeroStory() {
  const t = useTranslations("home");

  return (
    <section className="relative min-h-screen bg-mp-bg bg-noise flex items-center justify-center overflow-hidden">
      {/* Ambient Glow Effects */}
      <div className="absolute top-20 -left-20 w-96 h-96 bg-mp-primary/20 rounded-full blur-3xl animate-float-orb" />
      <div
        className="absolute bottom-40 -right-32 w-80 h-80 bg-mp-accent/15 rounded-full blur-3xl animate-float-orb"
        style={{ animationDelay: "2s" }}
      />

      <div className="container mx-auto px-4 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
          {/* Left Column - Content */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="space-y-8"
          >
            {/* Main Headline */}
            <motion.h1
              custom={0}
              variants={fadeUpVariants}
              className={createHeadingStyle(
                "hero",
                "text-6xl lg:text-7xl tracking-tight leading-[1.1]",
              )}
            >
              10 分鐘生成
              <span className={`block ${gradientTextStyles.primary}`}>
                排名前 1%
              </span>
              <span className="block">的 SEO 文章</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              custom={1}
              variants={fadeUpVariants}
              className={createTextStyle(
                "secondary",
                "",
                "text-lg md:text-xl max-w-lg",
              )}
            >
              使用 AI
              驅動的智慧內容生成系統，讓您的網站在搜尋結果中脫穎而出。無需複雜設定，一鍵發布至
              WordPress。
            </motion.p>

            {/* CTA Button */}
            <motion.div
              custom={2}
              variants={fadeUpVariants}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a
                href="/signup"
                className={`${buttonStyles.primary} gap-3 px-8 py-4 text-lg animate-pulse-glow`}
              >
                立即開始免費試用
                <svg
                  className="w-5 h-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>

              <a
                href="#demo"
                className={`${buttonStyles.secondary} gap-2 px-8 py-4 text-lg rounded-2xl`}
              >
                觀看示範
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1M9 10V9a3 3 0 116 0v1M9 10c0 1.105.895 2 2 2h2c1.105 0 2-.895 2-2M9 10c0 1.105.895 2 2 2h2c1.105 0 2-.895 2-2"
                  />
                </svg>
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              custom={3}
              variants={fadeUpVariants}
              className="flex flex-wrap gap-8 pt-8"
            >
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-mp-primary">
                  10 分鐘
                </div>
                <div className="text-sm text-mp-text-secondary">
                  平均生成時間
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-mp-success">
                  50+
                </div>
                <div className="text-sm text-mp-text-secondary">支援語系</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-mp-accent">
                  1000+
                </div>
                <div className="text-sm text-mp-text-secondary">滿意用戶</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Product Preview */}
          <motion.div
            custom={2}
            variants={fadeUpVariants}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="relative"
          >
            {/* Mock Dashboard Interface */}
            <div className="relative bg-gradient-to-br from-mp-surface/80 to-mp-surface/60 backdrop-blur-xl border border-mp-primary/10 rounded-3xl p-8 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
                <div className="text-sm text-mp-text-secondary">
                  1WaySEO Dashboard
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4">
                <div className="h-4 bg-mp-primary/20 rounded animate-shimmer" />
                <div
                  className="h-4 bg-mp-accent/20 rounded w-3/4 animate-shimmer"
                  style={{ animationDelay: "0.5s" }}
                />
                <div
                  className="h-4 bg-mp-success/20 rounded w-1/2 animate-shimmer"
                  style={{ animationDelay: "1s" }}
                />

                <div className="mt-8 p-4 bg-mp-primary/10 rounded-xl border border-mp-primary/20">
                  <div className="text-sm text-mp-primary font-semibold mb-2">
                    ✨ 文章生成中...
                  </div>
                  <div className="w-full bg-mp-surface rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-mp-primary to-mp-accent h-2 rounded-full animate-pulse"
                      style={{ width: "75%" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-mp-success/20 rounded-xl backdrop-blur-sm border border-mp-success/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-mp-success"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-mp-accent/20 rounded-2xl backdrop-blur-sm border border-mp-accent/30 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-mp-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
