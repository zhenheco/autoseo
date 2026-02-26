"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  containerVariants,
  fadeUpVariants,
  defaultViewport,
  scaleInVariants,
} from "@/lib/animations";
import {
  createCardStyle,
  createIconStyle,
  createHeadingStyle,
  createTextStyle,
  gradientTextStyles,
  backgroundStyles,
} from "@/lib/styles";

export function FeatureGrid() {
  const t = useTranslations("home");

  return (
    <section className="relative py-24 bg-mp-bg bg-noise">
      {/* Ambient Background */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-mp-accent/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-16"
        >
          <h2 className={createHeadingStyle("hero", "mb-6")}>
            強大功能，
            <span className={gradientTextStyles.primary}>簡單操作</span>
          </h2>
          <p
            className={createTextStyle(
              "secondary",
              "",
              "text-xl max-w-2xl mx-auto",
            )}
          >
            專為現代內容創作者設計的全方位 SEO 解決方案
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
        >
          {/* Large Card - AI 關鍵字研究 */}
          <motion.div
            variants={fadeUpVariants}
            className={`group lg:col-span-2 ${createCardStyle("primary", "p-8")}`}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className={createIconStyle("medium", "primary", "mb-4")}>
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h3 className={createHeadingStyle("card", "mb-3")}>
                  智慧關鍵字研究
                </h3>
                <p className={createTextStyle("secondary")}>
                  AI
                  驅動的關鍵字分析，自動找出高價值、低競爭的關鍵字組合，讓您的內容在搜尋結果中更容易被發現。
                </p>
              </div>
            </div>

            {/* Dynamic Keyword Cloud */}
            <div className="relative">
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  "SEO優化",
                  "內容行銷",
                  "關鍵字分析",
                  "搜尋引擎",
                  "網站流量",
                  "轉換率",
                ].map((keyword, index) => (
                  <motion.span
                    key={keyword}
                    variants={scaleInVariants}
                    initial="hidden"
                    whileInView="visible"
                    transition={{ delay: index * 0.1 }}
                    className="px-3 py-1.5 bg-mp-primary/10 text-mp-primary text-sm rounded-full border border-mp-primary/20 font-medium"
                  >
                    {keyword}
                  </motion.span>
                ))}
              </div>
              <div className="text-xs text-mp-text-secondary">
                找到 247+ 相關關鍵字，競爭度: 低
              </div>
            </div>
          </motion.div>

          {/* Medium Card - WordPress 同步 */}
          <motion.div
            variants={fadeUpVariants}
            className={`group ${createCardStyle("accent", "p-6")}`}
          >
            <div className={createIconStyle("small", "accent", "mb-4")}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.135-2.85-.135-.584-.031-.661.854-.082.899 0 0 .558.075 1.147.105l1.713 4.7-2.407 7.222-4.003-11.922c.645-.03 1.231-.105 1.231-.105.582-.075.515-.93-.067-.899 0 0-1.754.135-2.88.135-.203 0-.44-.006-.69-.015C3.566 2.52 6.608.825 10.146.825c2.67 0 5.1 1.02 6.9 2.685-.043-.003-.084-.009-.13-.009-.906 0-1.548.789-1.548 1.639 0 .76.44 1.548.908 2.37.345.645.75 1.472.75 2.67 0 .818-.315 1.83-.75 2.942l-.99 3.31zm-5.46 8.834c0-3.27-2.104-6.04-5.045-7.08l2.68 7.776c.495 1.425 1.335 3.616 1.335 3.616.015-.029.03-.057.03-.088v-.224zm-1.065-10.874c1.64 0 3.536.523 3.536.523.582.075.582-.93 0-.854 0 0-.553.075-1.172.105L4.4 16.942l.577 1.731.027-.008c2.266-5.98 4.026-10.709 4.026-10.709.645-.03 1.231-.105 1.231-.105z" />
              </svg>
            </div>
            <h3 className={createHeadingStyle("section", "mb-3")}>
              一鍵發佈 WordPress
            </h3>
            <p className={createTextStyle("secondary", "small", "mb-4")}>
              文章完成後自動發佈到您的 WordPress 網站，包含 SEO
              標籤、分類和圖片。
            </p>

            {/* Sync Animation */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-mp-accent/10 rounded-lg flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-mp-accent border-t-transparent rounded-full"
                />
              </div>
              <span className="text-xs text-mp-accent font-semibold">
                同步中...
              </span>
            </div>
          </motion.div>

          {/* Small Card - 多語系支援 */}
          <motion.div
            variants={fadeUpVariants}
            className={`group ${createCardStyle("success", "p-6")}`}
          >
            <div className={createIconStyle("small", "success", "mb-4")}>
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
            </div>
            <h3 className={createHeadingStyle("section", "mb-3")}>
              50+ 語系支援
            </h3>
            <p className={createTextStyle("secondary", "small", "mb-4")}>
              支援全球主要語言，讓您的內容觸及更廣泛的國際市場。
            </p>

            {/* Language Flags */}
            <div className="flex gap-1">
              {["🇹🇼", "🇺🇸", "🇯🇵", "🇰🇷", "🇩🇪", "🇫🇷"].map((flag, index) => (
                <motion.span
                  key={index}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                  className="text-lg"
                >
                  {flag}
                </motion.span>
              ))}
              <span className="text-mp-text-secondary text-sm self-center ml-1">
                +44
              </span>
            </div>
          </motion.div>

          {/* Medium Card - AI 內容優化 */}
          <motion.div
            variants={fadeUpVariants}
            className={`group ${createCardStyle("primary", "p-6")}`}
          >
            <div className={createIconStyle("small", "primary", "mb-4")}>
              <svg
                className="w-6 h-6"
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
            <h3 className={createHeadingStyle("section", "mb-3")}>
              AI 內容優化
            </h3>
            <p className={createTextStyle("secondary", "small", "mb-4")}>
              自動優化標題、meta 描述和內容結構，確保符合搜尋引擎最佳實踐。
            </p>

            {/* Optimization Score */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-mp-text-secondary">SEO 分數</span>
                <span className="text-mp-primary font-semibold">94/100</span>
              </div>
              <div className="w-full bg-mp-surface rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "94%" }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                  className="bg-gradient-to-r from-mp-primary to-mp-success h-2 rounded-full"
                />
              </div>
            </div>
          </motion.div>

          {/* Large Card - 成效追蹤 */}
          <motion.div
            variants={fadeUpVariants}
            className={`group lg:col-span-2 ${createCardStyle("success", "p-6")}`}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className={createIconStyle("small", "success", "mb-4")}>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className={createHeadingStyle("section", "mb-3")}>
                  即時成效追蹤
                </h3>
                <p className={createTextStyle("secondary", "small")}>
                  監控文章排名、流量變化和轉換成效，隨時掌握 SEO 表現。
                </p>
              </div>
            </div>

            {/* Mini Analytics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-mp-success">+247%</div>
                <div className="text-xs text-mp-text-secondary">流量增長</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-mp-primary">#3</div>
                <div className="text-xs text-mp-text-secondary">平均排名</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-mp-accent">87%</div>
                <div className="text-xs text-mp-text-secondary">點擊率</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
