import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArticleDetailPublish } from "./components/ArticleDetailPublish";

async function getArticle(articleId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("article_jobs")
    .select(
      `
      *,
      website_configs (
        site_name,
        site_url
      )
    `,
    )
    .eq("id", articleId)
    .single();

  if (error) throw error;

  return data;
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    redirect("/dashboard/articles?error=" + encodeURIComponent("找不到該文章"));
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {article.article_title || "未命名文章"}
          </h1>
          <p className="text-slate-400 mt-2">
            網站: {article.website_configs?.site_name || "未指定"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/articles/manage">
            <Button variant="outline">返回列表</Button>
          </Link>
          {(article.status === "completed" || article.status === "draft") && (
            <ArticleDetailPublish
              articleId={article.id}
              currentWebsiteId={article.website_id}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* 文章資訊 */}
        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">文章資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">狀態</span>
              <span
                className={`text-sm px-3 py-1 rounded-full ${
                  article.status === "published"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : article.status === "failed"
                      ? "bg-red-500/20 text-red-400"
                      : article.status === "processing"
                        ? "bg-cyber-cyan-500/20 text-cyber-cyan-400"
                        : "bg-slate-700 text-slate-300"
                }`}
              >
                {article.status === "published" && "已發布"}
                {article.status === "failed" && "失敗"}
                {article.status === "processing" && "處理中"}
                {article.status === "draft" && "草稿"}
                {article.status === "pending" && "待處理"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">輸入方式</span>
              <span className="text-white">
                {article.input_type === "keyword" && "關鍵字"}
                {article.input_type === "url" && "URL"}
                {article.input_type === "batch" && "批量"}
              </span>
            </div>

            {article.input_content && (
              <div className="flex justify-between">
                <span className="text-slate-400">輸入內容</span>
                <span className="text-sm text-white">
                  {article.input_content.keyword &&
                    article.input_content.keyword}
                  {article.input_content.url && (
                    <a
                      href={article.input_content.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyber-violet-400 hover:underline"
                    >
                      {article.input_content.url}
                    </a>
                  )}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-slate-400">建立時間</span>
              <span className="text-sm text-white">
                {new Date(article.created_at).toLocaleString("zh-TW")}
              </span>
            </div>

            {article.published_at && (
              <div className="flex justify-between">
                <span className="text-slate-400">發布時間</span>
                <span className="text-sm text-white">
                  {new Date(article.published_at).toLocaleString("zh-TW")}
                </span>
              </div>
            )}

            {article.wp_post_id && (
              <div className="flex justify-between">
                <span className="text-slate-400">WordPress ID</span>
                <span className="text-sm text-white">{article.wp_post_id}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 文章內容 */}
        {article.generated_content && (
          <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">生成內容</CardTitle>
              <CardDescription className="text-slate-400">
                AI 生成的文章內容預覽
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                {article.generated_content.title && (
                  <h2 className="text-2xl font-bold mb-4 text-white">
                    {article.generated_content.title}
                  </h2>
                )}
                {article.generated_content.content && (
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300"
                    dangerouslySetInnerHTML={{
                      __html: article.generated_content.content,
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 錯誤訊息 */}
        {article.error_message && (
          <Card className="border-red-500/30 bg-red-900/20">
            <CardHeader>
              <CardTitle className="text-red-400">錯誤訊息</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-400">{article.error_message}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
