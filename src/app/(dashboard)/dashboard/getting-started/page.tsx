import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Key,
  FileText,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const steps = [
  {
    id: 1,
    title: "新增網站",
    description: "連接您的 WordPress 網站到 1waySEO",
    icon: Globe,
    color: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-500",
    href: "/dashboard/websites/new",
    buttonText: "開始設定",
    details: [
      "輸入網站名稱和 WordPress URL",
      "設定 WordPress 應用程式密碼",
      "測試連線確認設定正確",
    ],
  },
  {
    id: 2,
    title: "連線",
    description: "確認您的網站已成功連線並可以發布文章",
    icon: CheckCircle2,
    color: "from-green-500/20 to-green-600/5",
    iconColor: "text-green-500",
    details: [
      "驗證 WordPress API 連線狀態",
      "確認發布權限設定",
      "測試文章發布功能",
    ],
  },
  {
    id: 3,
    title: "設定關鍵字",
    description: "新增您想要優化的 SEO 關鍵字",
    icon: Key,
    color: "from-amber-500/20 to-amber-600/5",
    iconColor: "text-amber-500",
    href: "/dashboard/keywords",
    buttonText: "管理關鍵字",
    details: [
      "新增主要關鍵字",
      "設定目標地區（台灣、香港、美國等）",
      "設定關鍵字優先級",
    ],
  },
  {
    id: 4,
    title: "寫文章",
    description: "使用 AI 自動生成高品質 SEO 文章",
    icon: FileText,
    color: "from-violet-500/20 to-violet-600/5",
    iconColor: "text-violet-500",
    href: "/dashboard/articles/generate",
    buttonText: "開始生成",
    details: ["選擇要使用的關鍵字", "設定文章類型和長度", "一鍵生成並發布文章"],
  },
];

export default async function GettingStartedPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4 py-8 md:px-6 lg:px-8 max-w-5xl">
        <div className="mb-12 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">快速開始</h1>
              <p className="text-muted-foreground/80 mt-2 text-lg">
                一步步引導您完成平台設定
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 relative">
          <div className="absolute left-7 top-16 bottom-16 w-0.5 bg-gradient-to-b from-border via-border to-transparent hidden md:block" />

          {steps.map((step, index) => {
            const IconComponent = step.icon;

            return (
              <Card
                key={step.id}
                className="group relative border-muted/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-5">
                    <div
                      className={`relative h-14 w-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shrink-0`}
                    >
                      <IconComponent className={`h-7 w-7 ${step.iconColor}`} />
                      <div className="absolute -top-2 -right-2">
                        <Badge
                          variant="secondary"
                          className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-background border border-border"
                        >
                          <span className="text-xs font-bold">{step.id}</span>
                        </Badge>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-2xl font-bold mb-2">
                        {step.title}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {step.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="md:ml-19">
                  <ul className="space-y-3 mb-6">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-3 group/item">
                        <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5 group-hover/item:bg-primary/10 transition-colors">
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 group-hover/item:bg-primary transition-colors" />
                        </div>
                        <span className="text-sm text-muted-foreground/80 group-hover/item:text-foreground/80 transition-colors">
                          {detail}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {step.href && (
                    <Link href={step.href}>
                      <Button className="group/btn">
                        {step.buttonText}
                        <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-0.5 transition-transform" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 p-8 bg-gradient-to-br from-muted/50 to-muted/20 rounded-2xl border border-border/50 backdrop-blur-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">需要協助？</h3>
              <p className="text-sm text-muted-foreground/80 mb-6">
                如果在設定過程中遇到任何問題，請參考我們的文檔或聯繫客服團隊。
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/50"
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  查看文檔
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/50"
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  聯繫客服
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/dashboard">
            <Button variant="ghost" className="group/back">
              <svg
                className="h-4 w-4 mr-2 group-hover/back:-translate-x-0.5 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              返回儀表板
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
