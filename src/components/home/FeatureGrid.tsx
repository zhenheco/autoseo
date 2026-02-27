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
    gradient: string;
  }> = [
    {
      id: "keywordResearch",
      icon: Search,
      gridSpan: "col-span-1 md:col-span-6 lg:col-span-4",
      gradient: "from-blue-500/20 to-indigo-500/20",
    },
    {
      id: "webResearch",
      icon: Globe,
      gridSpan: "col-span-1 md:col-span-6 lg:col-span-4",
      gradient: "from-indigo-500/20 to-violet-500/20",
    },
    {
      id: "competitorAnalysis",
      icon: BarChart3,
      gridSpan: "col-span-1 md:col-span-12 lg:col-span-4",
      gradient: "from-violet-500/20 to-fuchsia-500/20",
    },
    {
      id: "aiWriting",
      icon: PenTool,
      gridSpan: "col-span-1 md:col-span-12 lg:col-span-8",
      gradient: "from-fuchsia-500/20 to-rose-500/20",
    },
    {
      id: "structureGeneration",
      icon: Layout,
      gridSpan: "col-span-1 md:col-span-12 lg:col-span-4",
      gradient: "from-rose-500/20 to-orange-500/20",
    },
    {
      id: "imageGeneration",
      icon: ImageIcon,
      gridSpan: "col-span-1 md:col-span-6 lg:col-span-3",
      gradient: "from-emerald-500/20 to-teal-500/20",
    },
    {
      id: "linkOptimization",
      icon: Link2,
      gridSpan: "col-span-1 md:col-span-6 lg:col-span-3",
      gradient: "from-teal-500/20 to-cyan-500/20",
    },
    {
      id: "aiSearchOptimization",
      icon: Zap,
      gridSpan: "col-span-1 md:col-span-6 lg:col-span-3",
      gradient: "from-amber-500/20 to-yellow-500/20",
    },
    {
      id: "autoPublish",
      icon: Send,
      gridSpan: "col-span-1 md:col-span-6 lg:col-span-3",
      gradient: "from-sky-500/20 to-blue-500/20",
    },
  ];

  return (
    <section
      id="features"
      className="relative py-32 bg-slate-950 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] bg-repeat pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-24 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-sm font-bold text-indigo-400 uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            {t("coreCapabilities")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight">
            {t("completeWorkflow")}
            <span className="block md:inline-block md:ml-3 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              {t("fullAutomation")}
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">
            {t("nineFeatures")}
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-7xl mx-auto"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.id}
              variants={fadeUpVariants}
              className={`group relative ${feature.gridSpan} bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-slate-800 hover:border-slate-700 transition-all duration-300 hover:shadow-2xl overflow-hidden`}
            >
              {/* Hover Gradient Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />

              <div className="relative z-10 p-8 h-full flex flex-col">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-800 text-indigo-400 group-hover:scale-110 group-hover:text-white group-hover:bg-indigo-500 transition-all duration-300 mb-6 shadow-inner">
                  <feature.icon className="w-7 h-7" />
                </div>
                <div className="space-y-3 mt-auto">
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-200 transition-colors duration-300">
                    {t(`features.${feature.id}`)}
                  </h3>
                  <p className="text-slate-400 text-base leading-relaxed">
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
