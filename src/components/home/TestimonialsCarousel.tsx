"use client";

import { Card } from "@/components/ui/card";
import { Quote, Star, TrendingUp, Clock, DollarSign } from "lucide-react";
import { useTranslations } from "next-intl";
import { LucideIcon } from "lucide-react";

// 見證資料的靜態配置（不含文字內容）
const testimonialConfigs = [
  {
    avatar: "ZM",
    avatarColor: "from-blue-500 to-cyan-500",
    metricIcon: TrendingUp,
    rating: 5,
  },
  {
    avatar: "YT",
    avatarColor: "from-purple-500 to-pink-500",
    metricIcon: DollarSign,
    rating: 5,
  },
  {
    avatar: "JH",
    avatarColor: "from-green-500 to-emerald-500",
    metricIcon: Clock,
    rating: 5,
  },
  {
    avatar: "ML",
    avatarColor: "from-orange-500 to-red-500",
    metricIcon: TrendingUp,
    rating: 5,
  },
  {
    avatar: "ZW",
    avatarColor: "from-indigo-500 to-violet-500",
    metricIcon: TrendingUp,
    rating: 5,
  },
  {
    avatar: "SF",
    avatarColor: "from-pink-500 to-rose-500",
    metricIcon: Clock,
    rating: 5,
  },
];

interface TestimonialData {
  name: string;
  role: string;
  company: string;
  content: string;
  metricValue: string;
  metricLabel: string;
  avatar: string;
  avatarColor: string;
  metricIcon: LucideIcon;
  rating: number;
}

export function TestimonialsCarousel() {
  const t = useTranslations("testimonials");

  // 組合翻譯文字與靜態配置
  const testimonials: TestimonialData[] = testimonialConfigs.map(
    (config, index) => ({
      name: t(`item${index}.name`),
      role: t(`item${index}.role`),
      company: t(`item${index}.company`),
      content: t(`item${index}.content`),
      metricValue: t(`item${index}.metricValue`),
      metricLabel: t(`item${index}.metricLabel`),
      ...config,
    })
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testimonials.map((testimonial, index) => (
          <Card
            key={index}
            className="bg-white dark:bg-slate-800/50 shadow-lg border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden"
          >
            {/* 引號裝飾 */}
            <Quote className="absolute top-4 right-4 h-8 w-8 text-slate-100 dark:text-slate-700" />

            {/* 評價星星 */}
            <div className="flex gap-0.5 mb-4">
              {[...Array(testimonial.rating)].map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-amber-400 text-amber-400"
                />
              ))}
            </div>

            {/* 內容 */}
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4 relative z-10">
              &ldquo;{testimonial.content}&rdquo;
            </p>

            {/* 具體數據指標 */}
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
              <testimonial.metricIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-bold text-blue-700 dark:text-blue-300">
                {testimonial.metricValue}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {testimonial.metricLabel}
              </span>
            </div>

            {/* 用戶資訊 */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.avatarColor} flex items-center justify-center text-white text-sm font-bold shadow-md`}
              >
                {testimonial.avatar}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-900 dark:text-white">
                  {testimonial.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {testimonial.role} · {testimonial.company}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
