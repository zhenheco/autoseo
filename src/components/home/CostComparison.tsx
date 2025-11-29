import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, X, Zap } from "lucide-react";

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
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 dark:bg-green-950/30 px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400">
            <Zap className="h-4 w-4" />
            <span>成本對比</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
            為什麼選擇 <span className="text-primary">1waySEO</span>？
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            比傳統方式省下 90% 以上的成本和時間
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="border-2 border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-6 text-center">成本對比</h3>
              <div className="space-y-4">
                {comparisons.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 gap-2 items-center p-3 rounded-lg bg-muted/50"
                  >
                    <div className="text-sm font-medium">{item.category}</div>
                    <div className="text-sm text-muted-foreground line-through text-center">
                      {item.traditional}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-primary">
                        {item.ours}
                      </span>
                      <span className="block text-xs text-green-600 dark:text-green-400">
                        {item.savings}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-6 text-center">
                功能對比：傳統方式 vs 1waySEO
              </h3>
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 gap-4 items-center p-2"
                  >
                    <div className="text-sm">{feature.name}</div>
                    <div className="flex justify-center">
                      <X className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-4 items-center pt-4 border-t">
                  <div />
                  <div className="text-center text-sm text-muted-foreground">
                    傳統方式
                  </div>
                  <div className="text-center text-sm font-bold text-primary">
                    1waySEO
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
