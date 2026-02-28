"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const AI_ENGINES = [
  { name: "GPT-4o", label: "OpenAI" },
  { name: "Claude 3.5 Sonnet", label: "Anthropic" },
  { name: "Gemini 1.5 Pro", label: "Google" },
  { name: "Llama 3.1", label: "Meta" },
  { name: "DeepSeek-V3", label: "DeepSeek" },
  { name: "Mistral Large 2", label: "Mistral" },
];

export function LogoWall() {
  const t = useTranslations("home.v6.trust");

  return (
    <section className="py-20 border-y border-border relative overflow-hidden">
      <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-background to-transparent z-10" />

      <div className="max-w-3xl mx-auto px-6 mb-10 text-center relative z-20">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-lg md:text-xl text-foreground/70"
        >
          {t("metric")}
        </motion.p>
      </div>

      <div className="flex overflow-hidden">
        <motion.div
          animate={{ x: [0, -1000] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 25,
              ease: "linear",
            },
          }}
          className="flex flex-none items-center gap-16 md:gap-32 pr-16 md:pr-32"
        >
          {[...AI_ENGINES, ...AI_ENGINES, ...AI_ENGINES].map((engine, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-300 cursor-default"
            >
              <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center font-bold text-lg text-foreground/80">
                {engine.name[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-foreground/90 font-semibold whitespace-nowrap text-sm">
                  {engine.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {engine.label}
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
