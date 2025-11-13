import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createArticle } from './actions'

export const dynamic = 'force-dynamic'

export default async function NewArticlePage() {
  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">生成新文章</h1>
        <p className="text-muted-foreground mt-2">
          輸入關鍵字來生成 SEO 優化的文章
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>📝 關鍵字輸入</CardTitle>
          <CardDescription>
            輸入主要關鍵字，AI 將自動生成相關文章
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createArticle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">主要關鍵字</Label>
              <Input
                id="keyword"
                name="keyword"
                placeholder="例如: Next.js 教學"
                required
              />
              <p className="text-xs text-muted-foreground">
                輸入您想要優化的主要關鍵字
              </p>
            </div>

            <Button type="submit" className="w-full">
              開始生成文章
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>生成流程</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Research Agent: 分析關鍵字並收集相關資訊</li>
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
  )
}
