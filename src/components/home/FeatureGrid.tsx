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

export function FeatureGrid() {
  const t = useTranslations("home");

  const features: Array<{
    id: string;
    icon: LucideIcon;
    gridSpan: string;
  }> = [
    {
      id: "keywordResearch",
      icon: Search,
      gridSpan: "lg:col-span-4 md:col-span-6",
    },
    { id: "webResearch", icon: Globe, gridSpan: "lg:col-span-4 md:col-span-6" },
    {
      id: "competitorAnalysis",
      icon: BarChart3,
      gridSpan: "lg:col-span-4 md:col-span-12",
    },
    {
      id: "aiWriting",
      icon: PenTool,
      gridSpan: "lg:col-span-8 md:col-span-12",
    },
    {
      id: "structureGeneration",
      icon: Layout,
      gridSpan: "lg:col-span-4 md:col-span-12",
    },
    {
      id: "imageGeneration",
      icon: ImageIcon,
      gridSpan: "lg:col-span-3 md:col-span-6",
    },
    {
      id: "linkOptimization",
      icon: Link2,
      gridSpan: "lg:col-span-3 md:col-span-6",
    },
    {
      id: "aiSearchOptimization",
      icon: Zap,
      gridSpan: "lg:col-span-3 md:col-span-6",
    },
    { id: "autoPublish", icon: Send, gridSpan: "lg:col-span-3 md:col-span-6" },
  ];

  return (
    <section className="relative py-32 bg-slate-900 overflow-hidden">
      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-sm font-bold text-white uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-blue-500" />
            {t("coreCapabilities")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white">
            {t("completeWorkflow")}
            <span className="block md:inline-block ml-0 md:ml-3 text-blue-500">
              {t("fullAutomation")}
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto font-medium">
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
          {features.map((feature) => (
            <motion.div
              key={feature.id}
              variants={fadeUpVariants}
              className={`group relative ${feature.gridSpan} bg-slate-800 p-8 rounded-3xl border border-slate-700 hover:border-blue-500 transition-colors duration-200 hover:shadow-xl cursor-pointer`}
            >
              <div className="relative z-10 space-y-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-700 text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                  <feature.icon className="w-7 h-7" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white">
                    {t(`features.${feature.id}`)}
                  </h3>
                  <p className="text-slate-300 text-base leading-relaxed">
                    {t(`features.${feature.id}Desc`)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
