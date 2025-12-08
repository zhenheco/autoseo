"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, X, Zap } from "lucide-react";
import { BackgroundGrid, CyberGlow } from "@/components/ui/background-effects";
import { GradientText } from "@/components/ui/shimmer-text";

const comparisonKeys = [
  "professionalWriter",
  "seoAgency",
  "chatgptManual",
  "productionTime",
] as const;

const featureKeys = [
  "keywordResearch",
  "competitorAnalysis",
  "seoStructure",
  "autoImageGen",
  "wordpressPublish",
  "scheduledPost",
] as const;

export function CostComparison() {
  const t = useTranslations("home.costComparison");

  return (
    <section className="relative py-20 bg-white dark:bg-indigo-950">
      <BackgroundGrid variant="dark" />
      <CyberGlow position="center" color="cyan" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-transparent px-4 py-2 text-sm font-medium text-cyber-cyan-600 dark:text-cyber-cyan-400">
            <Zap className="h-4 w-4" />
            <span>{t("badge")}</span>
          </div>
          <h2 className="font-bold mb-4">
            <span className="text-slate-900 dark:text-white text-xl md:text-2xl">
              {t("whyChoose")}
            </span>
            <GradientText
              as="span"
              gradient="cyan-violet-magenta"
              className="text-4xl md:text-5xl ml-2"
            >
              1WaySEO
            </GradientText>
            <span className="text-slate-900 dark:text-white text-xl md:text-2xl">
              ?
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border-slate-200 dark:border-white/10 hover:border-cyber-cyan-500/50 transition-all duration-300">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-6 text-center text-slate-900 dark:text-white">
                {t("costTitle")}
              </h3>
              <div className="space-y-4">
                {comparisonKeys.map((key) => (
                  <div
                    key={key}
                    className="grid grid-cols-3 gap-2 items-center p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {t(`comparisons.${key}.category`)}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-500 line-through text-center">
                      {t(`comparisons.${key}.traditional`)}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-cyber-cyan-400">
                        {t(`comparisons.${key}.ours`)}
                      </span>
                      <span className="block text-xs text-green-400">
                        {t(`comparisons.${key}.savings`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border-slate-200 dark:border-cyber-cyan-500/30 hover:border-cyber-cyan-500/50 transition-all duration-300">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-6 text-center text-slate-900 dark:text-white">
                {t("featureTitle")}
              </h3>
              <div className="space-y-3">
                {featureKeys.map((key) => (
                  <div
                    key={key}
                    className="grid grid-cols-3 gap-4 items-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="text-sm text-slate-900 dark:text-white">
                      {t(`features.${key}`)}
                    </div>
                    <div className="flex justify-center">
                      <X className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="flex justify-center">
                      <CheckCircle2 className="h-5 w-5 text-cyber-cyan-400" />
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-4 items-center pt-4 border-t border-white/10">
                  <div />
                  <div className="text-center text-sm text-slate-600 dark:text-slate-500">
                    {t("traditional")}
                  </div>
                  <GradientText
                    as="span"
                    gradient="cyan-violet"
                    className="text-center text-sm font-bold block"
                  >
                    1WaySEO
                  </GradientText>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
