"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  containerVariants,
  fadeUpVariants,
  defaultViewport,
} from "@/lib/animations";
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

interface Feature {
  id: string;
  icon: LucideIcon;
  gridSpan: string;
}

const features: Feature[] = [
  { id: "keywordResearch", icon: Search, gridSpan: "lg:col-span-4" },
  { id: "webResearch", icon: Globe, gridSpan: "lg:col-span-4" },
  { id: "competitorAnalysis", icon: BarChart3, gridSpan: "lg:col-span-4" },
  { id: "aiWriting", icon: PenTool, gridSpan: "lg:col-span-8" },
  { id: "structureGeneration", icon: Layout, gridSpan: "lg:col-span-4" },
  { id: "imageGeneration", icon: ImageIcon, gridSpan: "lg:col-span-3" },
  { id: "linkOptimization", icon: Link2, gridSpan: "lg:col-span-3" },
  { id: "aiSearchOptimization", icon: Zap, gridSpan: "lg:col-span-3" },
  { id: "autoPublish", icon: Send, gridSpan: "lg:col-span-3" },
];

export function FeatureGrid() {
  const t = useTranslations("home");

  return (
    <section id="features" className="bg-bg-subtle section-padding">
      <div className="container-section">
        {/* Header */}
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
            <Sparkles className="w-4 h-4" />
            {t("coreCapabilities")}
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="text-3xl md:text-4xl font-bold text-text-main"
          >
            {t("completeWorkflow")}
            <span className="text-primary"> {t("fullAutomation")}</span>
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="text-lg md:text-xl text-text-subtle max-w-2xl mx-auto"
          >
            {t("nineFeatures")}
          </motion.p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.id}
              variants={fadeUpVariants}
              className={`card-base card-hover-lift p-6 ${feature.gridSpan}`}
            >
              <div className="flex flex-col h-full">
                <div className="bg-accent rounded-lg p-2 w-fit mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-text-main mb-1">
                  {t(`features.${feature.id}`)}
                </h3>
                <p className="text-text-subtle leading-snug">
                  {t(`features.${feature.id}Desc`)}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
