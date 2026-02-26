"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { createHeadingStyle } from "@/lib/styles";
import { MessageSquare, Heart, Check, Users } from "lucide-react";

const chats = [
  { key: "chat1", color: "from-blue-500 to-indigo-500", time: "10:24 AM" },
  { key: "chat2", color: "from-pink-500 to-rose-500", time: "11:05 AM" },
  { key: "chat3", color: "from-emerald-500 to-teal-500", time: "2:40 PM" },
] as const;

export function SocialProof() {
  const t = useTranslations("home");

  return (
    <section className="relative py-32 bg-slate-950 overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <div className="container relative z-10 mx-auto max-w-4xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-20 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mp-primary/10 border border-mp-primary/20 text-xs font-bold text-mp-primary uppercase tracking-widest">
            <Users className="w-4 h-4" />
            Social Proof
          </div>
          <h2
            className={createHeadingStyle(
              "hero",
              "text-4xl md:text-5xl lg:text-6xl text-white font-bold",
            )}
          >
            {t("story.socialProof.title")}
          </h2>
        </motion.div>

        {/* Chat Interface Mockup */}
        <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[3rem] p-6 md:p-10 shadow-2xl overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-mp-primary/50 to-transparent opacity-50" />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="space-y-10"
          >
            {chats.map((chat, index) => (
              <motion.div
                key={chat.key}
                variants={fadeUpVariants}
                className="flex gap-4 md:gap-6 group/item"
              >
                {/* Avatar with Glow */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${chat.color} blur-lg opacity-40 group-hover/item:opacity-70 transition-opacity`}
                  />
                  <div
                    className={`relative w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${chat.color} flex items-center justify-center text-white text-xl font-black shadow-xl border border-white/20`}
                  >
                    {t(`story.socialProof.${chat.key}.name`).charAt(0)}
                  </div>
                </div>

                {/* Message Bubble */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-base md:text-lg font-bold text-white tracking-tight">
                      {t(`story.socialProof.${chat.key}.name`)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter border border-white/5">
                      {t(`story.socialProof.${chat.key}.role`)}
                    </span>
                    <span className="text-[10px] text-slate-600 font-medium">
                      {chat.time}
                    </span>
                  </div>

                  <div className="relative group/bubble">
                    <div className="absolute -inset-1 bg-gradient-to-r from-mp-primary/10 to-mp-accent/10 rounded-2xl blur opacity-0 group-hover/bubble:opacity-100 transition-opacity" />
                    <div className="relative bg-slate-950/50 backdrop-blur-md rounded-2xl rounded-tl-none p-5 md:p-6 border border-white/5 group-hover:border-white/10 transition-colors shadow-inner">
                      <p className="text-slate-300 text-base md:text-lg leading-relaxed font-medium">
                        {t(`story.socialProof.${chat.key}.message`)}
                      </p>

                      {/* Interaction Bar */}
                      <div className="mt-4 flex items-center gap-4 opacity-30 group-hover/bubble:opacity-100 transition-opacity">
                        <button className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-mp-accent transition-colors">
                          <Heart className="w-3 h-3" />
                          React
                        </button>
                        <button className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-mp-primary transition-colors">
                          <MessageSquare className="w-3 h-3" />
                          Reply
                        </button>
                        <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-mp-success/50 uppercase tracking-tighter">
                          <Check className="w-3 h-3" />
                          Verified Result
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Typing Indicator for "Xiao Mei" or next user */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={defaultViewport}
              transition={{ delay: 1 }}
              className="flex items-center gap-3 pl-2"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="w-1.5 h-1.5 rounded-full bg-mp-primary/40"
                  />
                ))}
              </div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                More users joining...
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* Global Trust Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ delay: 1.2 }}
          className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16"
        >
          {t("story.socialProof.stats")
            .split(" | ")
            .map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-2xl md:text-3xl font-black text-white tracking-tighter italic">
                  {stat.split(" ")[0]}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  {stat.split(" ").slice(1).join(" ")}
                </span>
              </div>
            ))}
        </motion.div>
      </div>
    </section>
  );
}
