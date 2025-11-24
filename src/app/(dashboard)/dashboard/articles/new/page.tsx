import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createArticle } from "./actions";
import { ArticleForm } from "./components/ArticleForm";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">生成新文章</h1>
        <p className="text-muted-foreground mt-2">
          填寫產業、地區等資訊，AI 將自動分析並生成 SEO 優化的文章
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>📝 文章設定</CardTitle>
          <CardDescription>
            告訴我們您的產業和目標市場，我們會自動分析並生成最佳內容
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArticleForm />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>生成流程</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Research Agent: 分析產業和競爭對手</li>
            <li>Strategy Agent: 規劃文章架構和內容策略</li>
            <li>Writing Agent: 撰寫完整的文章內容</li>
            <li>HTML Agent: 處理內部連結和格式優化</li>
            <li>Meta Agent: 生成 SEO 元數據</li>
            <li>Category Agent: 自動分類和標籤</li>
            <li>Quality Agent: 品質檢查和優化建議</li>
            <li>Publish Agent: 發布到 WordPress (如有設定)</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
