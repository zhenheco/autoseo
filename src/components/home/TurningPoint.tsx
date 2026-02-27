"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  containerVariants,
  fadeUpVariants,
  defaultViewport,
} from "@/lib/animations";
import { XCircle, CheckCircle2, AlertTriangle } from "lucide-react";

export function TurningPoint() {
  const t = useTranslations("home");

  const traditionalPoints = [
    { title: "expensiveWriters", desc: "expensiveWritersDesc" },
    { title: "slowWriting", desc: "slowWritingDesc" },
    { title: "unstableResults", desc: "unstableResultsDesc" },
  ];

  const newWayPoints = [
    {
      title: "newWay.costDrop",
      desc: "story.results.scene2.desc",
      icon: CheckCircle2,
    },
    {
      title: "newWay.tenMinArticle",
      desc: "story.threeSteps.step2.desc",
      icon: CheckCircle2,
    },
    {
      title: "newWay.consistentQuality",
      desc: "story.socialProof.chat2.message",
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="bg-bg-subtle section-padding">
      <div className="container-section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          variants={containerVariants}
          className="text-center mb-16"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-sm font-bold px-4 py-1.5 rounded-full mb-4"
          >
            <AlertTriangle className="w-4 h-4" />
            {t("story.turningPoint.badge")}
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="text-3xl md:text-4xl font-bold text-text-main"
          >
            {t("newDesign.painPointTitle")}
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="text-lg md:text-xl text-text-subtle max-w-2xl mx-auto"
          >
            {t("newDesign.painPointDesc")}
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch"
        >
          {/* Traditional Way */}
          <motion.div
            variants={fadeUpVariants}
            className="card-base p-8 flex flex-col"
          >
            <h3 className="text-2xl font-bold text-text-main mb-6 flex items-center gap-3">
              <span className="p-2 bg-red-100 text-red-600 rounded-lg">
                <XCircle className="w-6 h-6" />
              </span>
              {t("newDesign.traditional")}
            </h3>

            <ul className="space-y-4 flex-1">
              {traditionalPoints.map((point) => (
                <li key={point.title} className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-text-main">
                      {t(`painPoints.${point.title}`)}
                    </h4>
                    <p className="text-text-subtle text-sm">
                      {t(`painPoints.${point.desc}`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* 1WaySEO Way */}
          <motion.div
            variants={fadeUpVariants}
            className="bg-primary text-white rounded-card p-8 shadow-lg flex flex-col"
          >
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="p-2 bg-white/20 rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </span>
              {t("newDesign.1wayseo")}
            </h3>

            <ul className="space-y-4 flex-1">
              {newWayPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.title} className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-emerald-300 shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-white">
                        {t(point.title)}
                      </h4>
                      <p className="text-primary-foreground/80 text-sm">
                        {t(point.desc)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
