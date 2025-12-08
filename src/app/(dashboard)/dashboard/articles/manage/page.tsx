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
  searchParams: Promise<{ filter?: string; website?: string }>;
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
  websiteId,
}: {
  filter: "all" | "unpublished" | "published" | "scheduled";
  websiteId?: string;
}) {
  const { articles, error } = await getArticles(filter, websiteId);

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
  const websiteId = params.website;

  return (
    <AutoRefreshWrapper intervalMs={30 * 1000}>
      <div className="container mx-auto px-4 py-4 max-w-[1600px] h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        <Suspense
          fallback={
            <div className="text-center py-8 text-muted-foreground">
              載入中...
            </div>
          }
        >
          <ArticleListContent filter={filter} websiteId={websiteId} />
        </Suspense>
      </div>
    </AutoRefreshWrapper>
  );
}
