"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

const testimonials = [
  {
    name: "張經理",
    company: "數位行銷公司",
    content:
      "使用 1waySEO 後，我們的內容產出效率提升了 300%，SEO 排名也顯著改善！",
  },
  {
    name: "李總監",
    company: "電商企業",
    content: "這個平台完全改變了我們的內容策略，AI 生成的文章品質超乎想像！",
  },
  {
    name: "王創辦人",
    company: "新創公司",
    content: "自動化功能太好用了，讓我們的內容團隊效率翻倍！",
  },
];

export function TestimonialsCarousel() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border border-border bg-card shadow-lg p-12 relative overflow-hidden">
        {testimonials.map((testimonial, index) => (
          <div
            key={index}
            className={`transition-all duration-500 ${
              index === activeTestimonial
                ? "opacity-100"
                : "opacity-0 absolute inset-12"
            }`}
          >
            <p className="text-base leading-relaxed mb-8 text-foreground/90">
              &ldquo;{testimonial.content}&rdquo;
            </p>
            <div>
              <div className="font-bold text-base text-foreground">
                {testimonial.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {testimonial.company}
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveTestimonial(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === activeTestimonial
                  ? "w-8 bg-primary"
                  : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
