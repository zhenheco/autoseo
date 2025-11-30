import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PenSquare, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getArticles } from "./actions";
import { ArticleListWrapper } from "./components/ArticleListWrapper";
import { ArticleFilters } from "./components/ArticleFilters";
import { ArticlePreview } from "./components/ArticlePreview";
import { AutoRefreshWrapper } from "./components/AutoRefreshWrapper";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

function HeaderFilters() {
  return (
    <div className="flex items-center gap-2">
      <Suspense fallback={null}>
        <ArticleFilters />
      </Suspense>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/articles/manage">
          <RefreshCw className="mr-1 h-3 w-3" />
          重新整理
        </Link>
      </Button>
      <Button size="sm" asChild>
        <Link href="/dashboard/articles">
          <PenSquare className="mr-1 h-3 w-3" />
          生成新文章
        </Link>
      </Button>
    </div>
  );
}

async function ArticleListContent({
  filter,
}: {
  filter: "all" | "unpublished" | "published";
}) {
  const { articles, error } = await getArticles(filter);

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        載入失敗: {error}
      </div>
    );
  }

  return (
    <ArticleListWrapper articles={articles} filters={<HeaderFilters />}>
      <ArticlePreview articles={articles} />
    </ArticleListWrapper>
  );
}

export default async function ArticleManagePage({ searchParams }: PageProps) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const filter =
    (params.filter as "all" | "unpublished" | "published") || "all";

  return (
    <AutoRefreshWrapper intervalMs={5 * 60 * 1000}>
      <div className="container mx-auto p-6 max-w-[1600px]">
        <Suspense
          fallback={
            <div className="text-center py-8 text-muted-foreground">
              載入中...
            </div>
          }
        >
          <ArticleListContent filter={filter} />
        </Suspense>
      </div>
    </AutoRefreshWrapper>
  );
}
