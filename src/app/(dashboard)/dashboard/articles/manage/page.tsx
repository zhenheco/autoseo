import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenSquare, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getArticles } from "./actions";
import { ArticleListWrapper } from "./components/ArticleListWrapper";
import { ArticleFilters } from "./components/ArticleFilters";
import { ArticlePreview } from "./components/ArticlePreview";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
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
    <ArticleListWrapper articles={articles}>
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
    <div className="container mx-auto p-8 max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">文章管理</h1>
          <p className="text-muted-foreground mt-2">
            管理所有生成的文章，選擇要發布到哪個網站
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <ArticleFilters />
          </Suspense>
          <Button variant="outline" asChild>
            <Link href="/dashboard/articles/manage">
              <RefreshCw className="mr-2 h-4 w-4" />
              重新整理
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/articles">
              <PenSquare className="mr-2 h-4 w-4" />
              生成新文章
            </Link>
          </Button>
        </div>
      </div>

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
  );
}
