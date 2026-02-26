"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { MessageSquare, Heart, Check, Users } from "lucide-react";

const chats = [
  { key: "chat1", color: "from-blue-500 to-blue-600", time: "10:24 AM" },
  { key: "chat2", color: "from-orange-500 to-orange-600", time: "11:05 AM" },
  { key: "chat3", color: "from-green-500 to-green-600", time: "2:40 PM" },
] as const;

export function SocialProof() {
  const t = useTranslations("home");

  return (
    <section className="relative py-32 bg-slate-50 overflow-hidden">
      <div className="container relative z-10 mx-auto max-w-4xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-800 uppercase tracking-widest shadow-sm">
            <Users className="w-4 h-4 text-blue-600" />
            {t("customerTestimonials")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl text-slate-900 font-bold tracking-tight">
            {t("story.socialProof.title")}
          </h2>
        </motion.div>

        {/* Chat Interface Mockup */}
        <div className="relative bg-white border border-slate-200 rounded-[3rem] p-6 md:p-10 shadow-xl overflow-hidden group">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="space-y-10"
          >
            {chats.map((chat) => (
              <motion.div
                key={chat.key}
                variants={fadeUpVariants}
                className="flex gap-4 md:gap-6 group/item"
              >
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${chat.color} flex items-center justify-center text-white text-xl font-black shadow-md border border-white/20`}
                  >
                    {t(`story.socialProof.${chat.key}.name`).charAt(0)}
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-base md:text-lg font-bold text-slate-900 tracking-tight">
                      {t(`story.socialProof.${chat.key}.name`)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-tighter border border-slate-200">
                      {t(`story.socialProof.${chat.key}.role`)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {chat.time}
                    </span>
                  </div>

                  <div className="relative bg-slate-50 rounded-2xl rounded-tl-none p-5 md:p-6 border border-slate-200 shadow-sm transition-colors duration-200 hover:border-blue-300">
                    <p className="text-slate-700 text-base md:text-lg leading-relaxed font-medium">
                      {t(`story.socialProof.${chat.key}.message`)}
                    </p>

                    <div className="mt-4 flex items-center gap-4 opacity-50 hover:opacity-100 transition-opacity duration-200">
                      <button className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-orange-500 transition-colors">
                        <Heart className="w-3 h-3" />
                        {t("story.socialProof.react")}
                      </button>
                      <button className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors">
                        <MessageSquare className="w-3 h-3" />
                        {t("story.socialProof.reply")}
                      </button>
                      <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-tighter">
                        <Check className="w-3 h-3" />
                        {t("story.socialProof.verifiedResult")}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ delay: 0.5 }}
          className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16"
        >
          {t("story.socialProof.stats")
            .split(" | ")
            .map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter italic">
                  {stat.split(" ")[0]}
                </span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                  {stat.split(" ").slice(1).join(" ")}
                </span>
              </div>
            ))}
        </motion.div>
      </div>
    </section>
  );
}
