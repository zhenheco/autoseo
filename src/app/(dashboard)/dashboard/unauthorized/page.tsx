import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldAlert, Sparkles, Check, ArrowRight } from "lucide-react";
import { getUserSubscriptionTier } from "@/lib/permissions";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const subscriptionTier = await getUserSubscriptionTier();
  const isFreePlan =
    params.reason === "free-plan" || subscriptionTier === "free";

  // 免費方案限制的友善提示
  if (isFreePlan) {
    return (
      <div className="container mx-auto p-8 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-2xl w-full border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">升級解鎖網站連接功能</CardTitle>
            <CardDescription className="text-base mt-2">
              免費方案僅支持文章生成功能，升級至付費方案即可連接 WordPress 網站
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* STARTER 方案特色 */}
            <div className="p-6 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <h3 className="font-semibold text-lg mb-4">
                升級至 STARTER 方案即可享有：
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {[
                  "連接 1 個 WordPress 網站",
                  "25,000 tokens/月（多 150%）",
                  "使用全部 AI 模型",
                  "每篇文章無限圖片",
                  "優先客服支援",
                  "品牌聲音設定",
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* 價格 */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold">NT$ 699</span>
                <span className="text-sm text-muted-foreground">/月</span>
                <span className="text-xs text-muted-foreground ml-2">
                  年繳享 83 折
                </span>
              </div>

              {/* CTA */}
              <div className="flex gap-3">
                <Button
                  asChild
                  className="flex-1 bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <Link href="/dashboard/subscription#plans">
                    立即升級
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/pricing">查看所有方案</Link>
                </Button>
              </div>
            </div>

            {/* 返回按鈕 */}
            <div className="text-center">
              <Link href="/dashboard/articles">
                <Button variant="ghost">返回文章管理</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 一般權限錯誤（角色不足）
  return (
    <div className="container mx-auto p-8 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">沒有權限</CardTitle>
          <CardDescription className="text-base mt-2">
            您沒有權限查看這個頁面
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            如果您認為這是錯誤，請聯絡您的管理員以獲取相應的權限。
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard/articles">
              <Button variant="outline">返回文章管理</Button>
            </Link>
            <Link href="/dashboard">
              <Button>返回首頁</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
