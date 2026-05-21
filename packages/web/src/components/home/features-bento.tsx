"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  Search,
  Link as LinkIcon,
  Globe,
  BarChart3,
  Cpu,
} from "lucide-react";
import { useTranslations } from "next-intl";

export function FeaturesBento() {
  const t = useTranslations("home.v5.features");

  const features = [
    {
      titleKey: "aiBulkEngine" as const,
      descKey: "aiBulkEngineDesc" as const,
      icon: FileText,
      size: "md:col-span-2",
      accent: "bg-primary/20",
      color: "text-primary",
    },
    {
      titleKey: "visualAi" as const,
      descKey: "visualAiDesc" as const,
      icon: ImageIcon,
      size: "md:col-span-1",
      accent: "bg-secondary/20",
      color: "text-secondary",
    },
    {
      titleKey: "smartKeywords" as const,
      descKey: "smartKeywordsDesc" as const,
      icon: Search,
      size: "md:col-span-1",
      accent: "bg-indigo-500/20",
      color: "text-indigo-400",
    },
    {
      titleKey: "flowCore" as const,
      descKey: "flowCoreDesc" as const,
      icon: Cpu,
      size: "md:col-span-2",
      accent: "bg-foreground/10",
      color: "text-foreground",
    },
    {
      titleKey: "autoLinking" as const,
      descKey: "autoLinkingDesc" as const,
      icon: LinkIcon,
      size: "md:col-span-1",
      accent: "bg-blue-500/20",
      color: "text-blue-400",
    },
    {
      titleKey: "globalReach" as const,
      descKey: "globalReachDesc" as const,
      icon: Globe,
      size: "md:col-span-1",
      accent: "bg-emerald-500/20",
      color: "text-emerald-400",
    },
    {
      titleKey: "realtimeSerp" as const,
      descKey: "realtimeSerpDesc" as const,
      icon: BarChart3,
      size: "md:col-span-1",
      accent: "bg-purple-500/20",
      color: "text-purple-400",
    },
  ];

  return (
    <section className="section-padding relative" id="features">
      <div className="container-section mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-block px-4 py-1 rounded-full bg-foreground/5 border border-foreground/10 text-primary text-xs font-bold uppercase tracking-widest mb-4"
        >
          {t("badge")}
        </motion.div>
        <h2 className="mb-4">{t("title")}</h2>
        <p className="text-text-sub max-w-2xl mx-auto">{t("description")}</p>
      </div>

      <div className="container-section grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((feature, i) => (
          <motion.div
            key={feature.titleKey}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`relative group p-8 rounded-2xl border border-foreground/5 bg-card overflow-hidden hover:border-primary/50 transition-colors duration-500 ${feature.size}`}
          >
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500 ${feature.accent}`}
            >
              <feature.icon className={`w-6 h-6 ${feature.color}`} />
            </div>

            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors duration-500">
              {t(feature.titleKey)}
            </h3>
            <p className="text-text-sub leading-relaxed group-hover:text-foreground/80 transition-colors duration-500">
              {t(feature.descKey)}
            </p>

            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
              <feature.icon className="w-24 h-24" />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
