import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, X, Zap } from "lucide-react";
import { BackgroundGrid, CyberGlow } from "@/components/ui/background-effects";
import { GradientText } from "@/components/ui/shimmer-text";

const comparisons = [
  {
    category: "請專業寫手",
    traditional: "NT$3,000-8,000/篇",
    ours: "NT$50-150/篇",
    savings: "省下 95%",
  },
  {
    category: "SEO 代操公司",
    traditional: "NT$50,000+/月",
    ours: "NT$1,200/月起",
    savings: "省下 97%",
  },
  {
    category: "自己用 ChatGPT",
    traditional: "需人工校對 2-4 小時",
    ours: "全自動 SEO 優化",
    savings: "省下 90%",
  },
  {
    category: "內容產出時間",
    traditional: "4-8 小時/篇",
    ours: "10 分鐘/篇",
    savings: "快 48 倍",
  },
];

const features = [
  { name: "關鍵字研究", traditional: false, ours: true },
  { name: "競爭對手分析", traditional: false, ours: true },
  { name: "SEO 優化結構", traditional: false, ours: true },
  { name: "自動圖片生成", traditional: false, ours: true },
  { name: "WordPress 一鍵發布", traditional: false, ours: true },
  { name: "排程自動發文", traditional: false, ours: true },
];

export function CostComparison() {
  return (
    <section className="relative py-20 bg-white dark:bg-indigo-950">
      <BackgroundGrid variant="dark" />
      <CyberGlow position="center" color="cyan" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-transparent px-4 py-2 text-sm font-medium text-cyber-cyan-600 dark:text-cyber-cyan-400">
            <Zap className="h-4 w-4" />
            <span>成本對比</span>
          </div>
          <h2 className="font-bold mb-4">
            <span className="text-slate-900 dark:text-white text-xl md:text-2xl">
              為什麼選擇
            </span>
            <GradientText
              as="span"
              gradient="cyan-violet-magenta"
              className="text-4xl md:text-5xl ml-2"
            >
              1WaySEO
            </GradientText>
            <span className="text-slate-900 dark:text-white text-xl md:text-2xl">
              ？
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            比傳統方式省下 90% 以上的成本和時間
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border-slate-200 dark:border-white/10 hover:border-cyber-cyan-500/50 transition-all duration-300">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-6 text-center text-slate-900 dark:text-white">
                成本對比
              </h3>
              <div className="space-y-4">
                {comparisons.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 gap-2 items-center p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {item.category}
                    </div>
                    <div className="text-sm text-slate-500 line-through text-center">
                      {item.traditional}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-cyber-cyan-400">
                        {item.ours}
                      </span>
                      <span className="block text-xs text-green-400">
                        {item.savings}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border-slate-200 dark:border-cyber-cyan-500/30 hover:border-cyber-cyan-500/50 transition-all duration-300">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-6 text-center text-slate-900 dark:text-white">
                功能對比：傳統方式 vs 1WaySEO
              </h3>
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 gap-4 items-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="text-sm text-slate-900 dark:text-white">
                      {feature.name}
                    </div>
                    <div className="flex justify-center">
                      <X className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="flex justify-center">
                      <CheckCircle2 className="h-5 w-5 text-cyber-cyan-400" />
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-4 items-center pt-4 border-t border-white/10">
                  <div />
                  <div className="text-center text-sm text-slate-500">
                    傳統方式
                  </div>
                  <GradientText
                    as="span"
                    gradient="cyan-violet"
                    className="text-center text-sm font-bold block"
                  >
                    1WaySEO
                  </GradientText>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
