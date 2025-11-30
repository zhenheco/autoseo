import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuotaStatus, getFreeTrialStatus } from "./actions";
import { ArticleFormTabs } from "./components/ArticleFormTabs";
import { FreeTrialBanner } from "@/components/articles/FreeTrialBanner";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ website?: string }>;
}

export default async function ArticlesPage({ searchParams }: PageProps) {
  const [quotaStatus, freeTrialStatus] = await Promise.all([
    getQuotaStatus(),
    getFreeTrialStatus(),
  ]);
  const { website: websiteId } = await searchParams;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">生成新文章</h1>
      </div>

      {freeTrialStatus && !freeTrialStatus.isUnlimited && (
        <FreeTrialBanner
          used={freeTrialStatus.used}
          limit={freeTrialStatus.limit}
          remaining={freeTrialStatus.remaining}
          isUnlimited={freeTrialStatus.isUnlimited}
        />
      )}

      <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-white">📝 文章設定</CardTitle>
        </CardHeader>
        <CardContent>
          <ArticleFormTabs
            quotaStatus={quotaStatus}
            initialWebsiteId={websiteId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
