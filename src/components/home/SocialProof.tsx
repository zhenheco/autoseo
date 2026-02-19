"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const chats = [
  { key: "chat1", color: "from-blue-500 to-indigo-500" },
  { key: "chat2", color: "from-pink-500 to-rose-500" },
  { key: "chat3", color: "from-emerald-500 to-teal-500" },
] as const;

export function SocialProof() {
  const t = useTranslations("home");

  return (
    <section className="py-20 px-4 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-bold text-center text-slate-800 dark:text-white mb-12"
        >
          {t("story.socialProof.title")}
        </motion.h2>

        <div className="space-y-6">
          {chats.map((chat, index) => (
            <motion.div
              key={chat.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="flex gap-3"
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${chat.color} flex items-center justify-center text-white text-sm font-bold`}
              >
                {t(`story.socialProof.${chat.key}.name`).charAt(0)}
              </div>

              {/* Bubble */}
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800 dark:text-white">
                    {t(`story.socialProof.${chat.key}.name`)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {t(`story.socialProof.${chat.key}.role`)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t(`story.socialProof.${chat.key}.message`)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats line */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center text-sm text-slate-400 mt-10"
        >
          {t("story.socialProof.stats")}
        </motion.p>
      </div>
    </section>
  );
}
