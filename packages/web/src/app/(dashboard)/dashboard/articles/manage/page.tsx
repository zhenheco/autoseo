import { Suspense } from "react";
import { getUser } from "@shared/auth";
import { redirect } from "next/navigation";
import { getArticles } from "./actions";
import { ArticleListWrapper } from "./components/ArticleListWrapper";
import { ArticleFilters } from "./components/ArticleFilters";
import { ArticlePreview } from "./components/ArticlePreview";
import { AutoRefreshWrapper } from "./components/AutoRefreshWrapper";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";

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
    return <ErrorState title="載入失敗" message={error} />;
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
      <div className="container mx-auto px-4 py-4 w-full max-w-[1600px] h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        <Suspense
          fallback={
            <div className="grid h-full gap-3 lg:grid-cols-[45%_1fr]">
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-[calc(100vh-14rem)] w-full" />
              </div>
              <Skeleton className="hidden h-full lg:block" />
            </div>
          }
        >
          <ArticleListContent filter={filter} websiteId={websiteId} />
        </Suspense>
      </div>
    </AutoRefreshWrapper>
  );
}
