import { getUser, getUserPrimaryCompany } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createArticle } from './actions'

async function getCompanyWebsites(companyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('website_configs')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data
}

export default async function NewArticlePage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const company = await getUserPrimaryCompany(user.id)

  if (!company) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">您尚未加入任何公司</p>
      </div>
    )
  }

  const websites = await getCompanyWebsites(company.id)

  if (!websites || websites.length === 0) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              您還沒有新增任何 WordPress 網站，請先新增網站才能生成文章。
            </p>
            <Button onClick={() => window.location.href = '/dashboard/websites/new'}>
              新增網站
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">生成新文章</h1>
        <p className="text-muted-foreground mt-2">
          選擇輸入方式來生成 SEO 優化的文章
        </p>
      </div>

      <div className="grid gap-6">
        {/* 方式 1: 關鍵字輸入 */}
        <Card>
          <CardHeader>
            <CardTitle>📝 關鍵字輸入</CardTitle>
            <CardDescription>
              輸入主要關鍵字，AI 將自動生成相關文章
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createArticle} className="space-y-4">
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="inputType" value="keyword" />

              <div className="space-y-2">
                <Label htmlFor="website-keyword">選擇網站</Label>
                <select
                  id="website-keyword"
                  name="websiteId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">請選擇...</option>
                  {websites.map((site: any) => (
                    <option key={site.id} value={site.id}>
                      {site.site_name}
                    </option>
                  ))}
                </select>
              </div>

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
                開始生成
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 方式 2: URL 輸入 */}
        <Card>
          <CardHeader>
            <CardTitle>🔗 URL 輸入</CardTitle>
            <CardDescription>
              輸入參考網址，AI 將分析並生成類似主題的文章
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createArticle} className="space-y-4">
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="inputType" value="url" />

              <div className="space-y-2">
                <Label htmlFor="website-url">選擇網站</Label>
                <select
                  id="website-url"
                  name="websiteId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">請選擇...</option>
                  {websites.map((site: any) => (
                    <option key={site.id} value={site.id}>
                      {site.site_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">參考 URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://example.com/article"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  輸入您想要參考的文章網址
                </p>
              </div>

              <Button type="submit" className="w-full">
                開始生成
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 方式 3: 批量關鍵字 */}
        <Card>
          <CardHeader>
            <CardTitle>📋 批量關鍵字</CardTitle>
            <CardDescription>
              一次輸入多個關鍵字，批量生成多篇文章
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createArticle} className="space-y-4">
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="inputType" value="batch" />

              <div className="space-y-2">
                <Label htmlFor="website-batch">選擇網站</Label>
                <select
                  id="website-batch"
                  name="websiteId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">請選擇...</option>
                  {websites.map((site: any) => (
                    <option key={site.id} value={site.id}>
                      {site.site_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">關鍵字列表</Label>
                <textarea
                  id="keywords"
                  name="keywords"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px]"
                  placeholder="每行一個關鍵字&#10;例如:&#10;Next.js 教學&#10;React 入門&#10;TypeScript 基礎"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  每行輸入一個關鍵字，最多 10 個
                </p>
              </div>

              <Button type="submit" className="w-full">
                批量生成
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
