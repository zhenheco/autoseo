import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getQuotaStatus } from "./actions";
import { ArticleFormTabs } from "./components/ArticleFormTabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const quotaStatus = await getQuotaStatus();

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">生成新文章</h1>
        <p className="text-muted-foreground mt-2">
          填寫產業、地區等資訊，AI 將自動分析並生成 SEO 優化的文章
        </p>
      </div>

      {quotaStatus && !quotaStatus.canUseCompetitors && (
        <Alert className="mb-6">
          <AlertTitle>🔒 競爭對手分析功能已鎖定</AlertTitle>
          <AlertDescription>
            您當前的方案（{quotaStatus.plan.toUpperCase()}
            ）不支援競爭對手深度分析功能。
            <Link
              href="/dashboard/billing"
              className="underline ml-1 font-medium"
            >
              升級至 STARTER 或更高方案
            </Link>
            即可解鎖此功能。
          </AlertDescription>
        </Alert>
      )}

      {quotaStatus &&
        quotaStatus.canUseCompetitors &&
        quotaStatus.quota > 0 && (
          <Alert className="mb-6">
            <AlertTitle>📊 配額使用情況</AlertTitle>
            <AlertDescription>
              本月競爭對手分析配額：已使用 {quotaStatus.used} /{" "}
              {quotaStatus.quota} 次
              {quotaStatus.remaining <= 3 && quotaStatus.remaining > 0 && (
                <span className="text-orange-600 ml-2">
                  （剩餘 {quotaStatus.remaining} 次）
                </span>
              )}
              {quotaStatus.remaining === 0 && (
                <span className="text-red-600 ml-2">
                  （已達上限，請
                  <Link href="/dashboard/billing" className="underline mx-1">
                    升級方案
                  </Link>
                  或等待下月重置）
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

      <Card>
        <CardHeader>
          <CardTitle>📝 文章設定</CardTitle>
          <CardDescription>
            選擇生成模式：快速生成適合一般需求，進階生成可設定更多參數
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArticleFormTabs quotaStatus={quotaStatus} />
        </CardContent>
      </Card>
    </div>
  );
}
