"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  containerVariants,
  fadeUpVariants,
  defaultViewport,
} from "@/lib/animations";
import {
  XCircle,
  CheckCircle2,
  DollarSign,
  Clock,
  AlertTriangle,
} from "lucide-react";

export function TurningPoint() {
  const t = useTranslations("home");

  return (
    <section className="py-32 bg-slate-50 relative overflow-hidden">
      <div className="container relative z-10 mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 border border-rose-200 text-sm font-bold text-rose-600 uppercase tracking-widest">
            <AlertTriangle className="w-4 h-4" />
            {t("story.turningPoint.badge")}
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            {t("newDesign.painPointTitle")}
          </h2>
          <p className="text-xl text-slate-500 font-medium">
            {t("newDesign.painPointDesc")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* Traditional Way */}
          <motion.div
            variants={fadeUpVariants}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 inset-x-0 h-2 bg-rose-500" />
            <h3 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
              <span className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                <XCircle className="w-6 h-6" />
              </span>
              {t("newDesign.traditional")}
            </h3>

            <ul className="space-y-6 flex-1">
              <li className="flex items-start gap-4">
                <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">
                    {t("painPoints.expensiveWriters")}
                  </h4>
                  <p className="text-slate-500 mt-1">
                    {t("painPoints.expensiveWritersDesc")}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">
                    {t("painPoints.slowWriting")}
                  </h4>
                  <p className="text-slate-500 mt-1">
                    {t("painPoints.slowWritingDesc")}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">
                    {t("painPoints.unstableResults")}
                  </h4>
                  <p className="text-slate-500 mt-1">
                    {t("painPoints.unstableResultsDesc")}
                  </p>
                </div>
              </li>
            </ul>
          </motion.div>

          {/* 1WaySEO Way */}
          <motion.div
            variants={fadeUpVariants}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="bg-indigo-600 border border-indigo-500 rounded-[2.5rem] p-10 shadow-xl shadow-indigo-600/20 relative overflow-hidden flex flex-col text-white transform md:-translate-y-4"
          >
            <div className="absolute top-[-50%] right-[-50%] w-full h-full bg-gradient-to-b from-white/10 to-transparent rounded-full blur-3xl pointer-events-none" />
            <h3 className="text-2xl font-bold mb-8 flex items-center gap-3 relative z-10">
              <span className="p-2 bg-indigo-500 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </span>
              {t("newDesign.1wayseo")}
            </h3>

            <ul className="space-y-6 relative z-10 flex-1">
              <li className="flex items-start gap-4 bg-indigo-500/30 p-4 rounded-2xl border border-indigo-400/30">
                <DollarSign className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg text-white">
                    {t("newWay.costDrop")}
                  </h4>
                  <p className="text-indigo-200 mt-1">
                    {t("story.results.scene2.desc")}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4 bg-indigo-500/30 p-4 rounded-2xl border border-indigo-400/30">
                <Clock className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg text-white">
                    {t("newWay.tenMinArticle")}
                  </h4>
                  <p className="text-indigo-200 mt-1">
                    {t("story.threeSteps.step2.desc")}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4 bg-indigo-500/30 p-4 rounded-2xl border border-indigo-400/30">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg text-white">
                    {t("newWay.consistentQuality")}
                  </h4>
                  <p className="text-indigo-200 mt-1">
                    {t("story.socialProof.chat2.message")}
                  </p>
                </div>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
