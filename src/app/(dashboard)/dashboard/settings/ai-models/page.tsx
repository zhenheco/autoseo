import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getAIModels() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('獲取 AI 模型失敗:', error)
    return []
  }

  return data || []
}

async function getAgentConfigs() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('agent_configs')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('獲取 Agent 配置失敗:', error)
    return null
  }

  return data
}

export default async function AIModelsPage() {
  const models = await getAIModels()
  const config = await getAgentConfigs()

  const textModels = models.filter(m => m.model_type === 'text')
  const imageModels = models.filter(m => m.model_type === 'image')

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI 模型設定</h1>
        <p className="text-muted-foreground mt-2">
          配置各個 Agent 使用的 AI 模型
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Research Agent</CardTitle>
            <CardDescription>負責關鍵字研究和內容分析</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">當前模型</span>
                <span className="text-sm text-muted-foreground">
                  {config?.research_model || 'perplexity-sonar'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Temperature</span>
                <span className="text-sm text-muted-foreground">
                  {config?.research_temperature || 0.3}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tokens</span>
                <span className="text-sm text-muted-foreground">
                  {config?.research_max_tokens || 2000}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategy Agent</CardTitle>
            <CardDescription>負責內容策略規劃</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">當前模型</span>
                <span className="text-sm text-muted-foreground">
                  {config?.strategy_model || 'gpt-4'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Temperature</span>
                <span className="text-sm text-muted-foreground">
                  {config?.strategy_temperature || 0.7}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tokens</span>
                <span className="text-sm text-muted-foreground">
                  {config?.strategy_max_tokens || 3000}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Writing Agent</CardTitle>
            <CardDescription>負責文章撰寫</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">當前模型</span>
                <span className="text-sm text-muted-foreground">
                  {config?.writing_model || 'gpt-4'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Temperature</span>
                <span className="text-sm text-muted-foreground">
                  {config?.writing_temperature || 0.7}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tokens</span>
                <span className="text-sm text-muted-foreground">
                  {config?.writing_max_tokens || 4000}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta Agent</CardTitle>
            <CardDescription>負責 SEO 元數據生成</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">當前模型</span>
                <span className="text-sm text-muted-foreground">
                  {config?.meta_model || 'deepseek-chat'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Temperature</span>
                <span className="text-sm text-muted-foreground">
                  {config?.meta_temperature || 0.5}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tokens</span>
                <span className="text-sm text-muted-foreground">
                  {config?.meta_max_tokens || 500}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image Agent</CardTitle>
            <CardDescription>負責圖片生成</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">當前模型</span>
                <span className="text-sm text-muted-foreground">
                  {config?.image_model || 'dall-e-3'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">畫質</span>
                <span className="text-sm text-muted-foreground">
                  {config?.image_quality || 'standard'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">尺寸</span>
                <span className="text-sm text-muted-foreground">
                  {config?.image_size || '1024x1024'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">生成數量</span>
                <span className="text-sm text-muted-foreground">
                  {config?.image_count || 3}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>可用的 AI 模型</CardTitle>
            <CardDescription>系統中可用的所有 AI 模型</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">文字模型</h3>
                <div className="space-y-2">
                  {textModels.map((model) => (
                    <div key={model.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <div className="text-sm font-medium">{model.model_name}</div>
                        <div className="text-xs text-muted-foreground">{model.model_id}</div>
                      </div>
                      {model.is_featured && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          推薦
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {imageModels.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">圖片模型</h3>
                  <div className="space-y-2">
                    {imageModels.map((model) => (
                      <div key={model.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <div className="text-sm font-medium">{model.model_name}</div>
                          <div className="text-xs text-muted-foreground">{model.model_id}</div>
                        </div>
                        {model.is_featured && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            推薦
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800">
              ⚠️ 注意：AI 模型設定需要透過資料庫直接修改。未來版本將提供圖形界面編輯功能。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
