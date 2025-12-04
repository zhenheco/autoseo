import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
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
    <Suspense fallback={null}>
      <ArticleFilters />
    </Suspense>
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
      <div className="container mx-auto px-4 py-4 max-w-[1600px]">
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
