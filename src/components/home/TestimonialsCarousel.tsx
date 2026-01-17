"use client";

import { Card } from "@/components/ui/card";
import { Quote, Star, TrendingUp, Clock, DollarSign } from "lucide-react";

// 更有說服力的見證資料 - 包含具體數據
const testimonials = [
  {
    name: "張志明",
    role: "行銷總監",
    company: "智慧零售 GoodRetail",
    avatar: "ZM",
    avatarColor: "from-blue-500 to-cyan-500",
    content:
      "導入 1WaySEO 後，我們的部落格從每月 3 篇提升到 30 篇，自然搜尋流量成長了 280%。原本要 5 人的內容團隊，現在只需要 1 人審核就好。",
    metric: { icon: TrendingUp, value: "280%", label: "流量成長" },
    rating: 5,
  },
  {
    name: "李雅婷",
    role: "創辦人",
    company: "旅遊新創 TripWow",
    avatar: "YT",
    avatarColor: "from-purple-500 to-pink-500",
    content:
      "以前請寫手一篇要 NT$5,000，現在用 1WaySEO 只要 NT$80，品質還更穩定。半年省下超過 NT$150,000 的內容成本！",
    metric: { icon: DollarSign, value: "NT$150K", label: "半年節省" },
    rating: 5,
  },
  {
    name: "王建華",
    role: "SEO 主管",
    company: "電商平台 ShopMax",
    avatar: "JH",
    avatarColor: "from-green-500 to-emerald-500",
    content:
      "最驚艷的是自動排程發布功能，設定好之後每天自動發文到 WordPress，讓我有更多時間專注在策略面。10 分鐘搞定一篇，太神了！",
    metric: { icon: Clock, value: "10 分鐘", label: "完成一篇" },
    rating: 5,
  },
  {
    name: "陳美玲",
    role: "內容經理",
    company: "科技媒體 TechDaily",
    avatar: "ML",
    avatarColor: "from-orange-500 to-red-500",
    content:
      "AI 生成的文章架構非常專業，內外連結建議也很精準。我們有 5 個關鍵字從第 3 頁升到第 1 頁，ROI 超乎預期！",
    metric: { icon: TrendingUp, value: "5 個關鍵字", label: "進入首頁" },
    rating: 5,
  },
  {
    name: "林志偉",
    role: "數位行銷顧問",
    company: "自由接案",
    avatar: "ZW",
    avatarColor: "from-indigo-500 to-violet-500",
    content:
      "幫客戶做 SEO 最頭痛的就是內容產出，現在我同時服務 8 個客戶都綽綽有餘。推薦給所有行銷人！",
    metric: { icon: TrendingUp, value: "8 個客戶", label: "同時服務" },
    rating: 5,
  },
  {
    name: "黃淑芬",
    role: "電商經理",
    company: "美妝品牌 GlowUp",
    avatar: "SF",
    avatarColor: "from-pink-500 to-rose-500",
    content:
      "品牌聲音設定超貼心，AI 生成的文章完全符合我們年輕活潑的調性。圖片自動生成也省了很多設計師的時間！",
    metric: { icon: Clock, value: "70%", label: "時間節省" },
    rating: 5,
  },
];

export function TestimonialsCarousel() {
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
              <testimonial.metric.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-bold text-blue-700 dark:text-blue-300">
                {testimonial.metric.value}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {testimonial.metric.label}
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
