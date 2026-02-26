"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  containerVariants,
  fadeUpVariants,
  defaultViewport,
} from "@/lib/animations";
import {
  createCardStyle,
  createHeadingStyle,
  createTextStyle,
  gradientTextStyles,
  cardStyles,
} from "@/lib/styles";
import {
  Search,
  Globe,
  BarChart3,
  Layout,
  PenTool,
  Image as ImageIcon,
  Link2,
  Zap,
  Send,
  Sparkles,
  LucideIcon,
} from "lucide-react";

export function FeatureGrid() {
  const t = useTranslations("home");

  const features: Array<{
    id: string;
    icon: LucideIcon;
    variant: keyof typeof cardStyles;
    gridSpan: string;
  }> = [
    {
      id: "keywordResearch",
      icon: Search,
      variant: "primary",
      gridSpan: "lg:col-span-4 md:col-span-6",
    },
    {
      id: "webResearch",
      icon: Globe,
      variant: "accent",
      gridSpan: "lg:col-span-4 md:col-span-6",
    },
    {
      id: "competitorAnalysis",
      icon: BarChart3,
      variant: "success",
      gridSpan: "lg:col-span-4 md:col-span-12",
    },
    {
      id: "aiWriting",
      icon: PenTool,
      variant: "primary",
      gridSpan: "lg:col-span-8 md:col-span-12",
    },
    {
      id: "structureGeneration",
      icon: Layout,
      variant: "accent",
      gridSpan: "lg:col-span-4 md:col-span-12",
    },
    {
      id: "imageGeneration",
      icon: ImageIcon,
      variant: "success",
      gridSpan: "lg:col-span-3 md:col-span-6",
    },
    {
      id: "linkOptimization",
      icon: Link2,
      variant: "primary",
      gridSpan: "lg:col-span-3 md:col-span-6",
    },
    {
      id: "aiSearchOptimization",
      icon: Zap,
      variant: "accent",
      gridSpan: "lg:col-span-3 md:col-span-6",
    },
    {
      id: "autoPublish",
      icon: Send,
      variant: "success",
      gridSpan: "lg:col-span-3 md:col-span-6",
    },
  ];

  return (
    <section className="relative py-32 bg-slate-950 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.03),transparent_50%)]" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mp-primary/10 border border-mp-primary/20 text-xs font-bold text-mp-primary tracking-widest uppercase">
            <Sparkles className="w-3 h-3" />
            {t("coreCapabilities")}
          </div>
          <h2
            className={createHeadingStyle(
              "hero",
              "text-4xl md:text-5xl lg:text-6xl text-white",
            )}
          >
            {t("completeWorkflow")}
            <span
              className={`block md:inline-block ml-0 md:ml-3 ${gradientTextStyles.primary}`}
            >
              {t("fullAutomation")}
            </span>
          </h2>
          <p
            className={createTextStyle(
              "secondary",
              "",
              "text-xl text-slate-400 max-w-2xl mx-auto",
            )}
          >
            {t("nineFeatures")}
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-12 lg:grid-cols-12 gap-6 max-w-7xl mx-auto"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              variants={fadeUpVariants}
              className={`group relative ${feature.gridSpan} ${createCardStyle(feature.variant, "p-8 overflow-hidden")}`}
            >
              {/* Card Glow Effect */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-current opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500" />

              <div className="relative z-10 space-y-6">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${
                    feature.variant === "primary"
                      ? "bg-mp-primary/10 text-mp-primary border border-mp-primary/20"
                      : feature.variant === "accent"
                        ? "bg-mp-accent/10 text-mp-accent border border-mp-accent/20"
                        : "bg-mp-success/10 text-mp-success border border-mp-success/20"
                  }`}
                >
                  <feature.icon className="w-6 h-6" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white group-hover:text-mp-primary transition-colors">
                    {t(`features.${feature.id}`)}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed line-clamp-3 group-hover:text-slate-300 transition-colors">
                    {t(`features.${feature.id}Desc`)}
                  </p>
                </div>

                {/* Interactive Footer (Optional decoration) */}
                <div className="pt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="text-[10px] font-bold text-mp-primary uppercase tracking-tighter">
                    {t("learnMore")}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
