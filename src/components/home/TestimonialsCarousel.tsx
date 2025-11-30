import { Card } from "@/components/ui/card";
import { User } from "lucide-react";

const testimonials = [
  {
    name: "張經理",
    company: "數位行銷",
    content: "內容產出效率提升 300%，SEO 排名顯著改善！",
  },
  {
    name: "李總監",
    company: "電商企業",
    content: "AI 生成的文章品質超乎想像，完全改變內容策略！",
  },
  {
    name: "王創辦人",
    company: "新創公司",
    content: "自動化功能太好用，內容團隊效率翻倍！",
  },
  {
    name: "陳主管",
    company: "科技公司",
    content: "終身方案超划算，每月固定配額用不完！",
  },
  {
    name: "林執行長",
    company: "媒體集團",
    content: "一鍵發布 WordPress，省下大量人力成本！",
  },
  {
    name: "黃經理",
    company: "行銷代理",
    content: "關鍵字研究功能強大，找到很多藍海機會！",
  },
  {
    name: "吳總監",
    company: "零售業",
    content: "圖片自動生成超方便，不用再找素材！",
  },
  {
    name: "蔡創辦人",
    company: "教育平台",
    content: "文章架構 AI 自動規劃，品質穩定可靠！",
  },
  {
    name: "許經理",
    company: "金融服務",
    content: "競爭分析功能讓我們找到差異化優勢！",
  },
];

export function TestimonialsCarousel() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((testimonial, index) => (
          <Card
            key={index}
            className="bg-white dark:bg-transparent dark:glass shadow-lg dark:shadow-none border-slate-200 dark:border-white/10 p-5 hover:border-cyber-violet-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-cyber-cyan-500 to-cyber-violet-500 flex items-center justify-center ring-2 ring-cyber-violet-500/30 shadow-md">
                <User className="h-5 w-5 text-white drop-shadow-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {testimonial.name}
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  {testimonial.company}
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  &ldquo;{testimonial.content}&rdquo;
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
