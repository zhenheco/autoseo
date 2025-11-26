import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenSquare, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getArticles } from "./actions";
import { ArticleList } from "./components/ArticleList";
import { ArticleFilters } from "./components/ArticleFilters";

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

  return <ArticleList articles={articles} />;
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
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">文章管理</h1>
          <p className="text-muted-foreground mt-2">
            管理所有生成的文章，選擇要發布到哪個網站
          </p>
        </div>
        <div className="flex gap-2">
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>文章列表</CardTitle>
              <CardDescription>
                查看所有文章的狀態，並決定發布到哪個網站
              </CardDescription>
            </div>
            <Suspense fallback={null}>
              <ArticleFilters />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="text-center py-8 text-muted-foreground">
                載入中...
              </div>
            }
          >
            <ArticleListContent filter={filter} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
