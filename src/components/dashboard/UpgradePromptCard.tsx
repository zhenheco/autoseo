'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface UpgradePromptCardProps {
  currentTier: 'free' | 'basic' | 'pro' | 'enterprise'
  tokenBalance: number
}

export function UpgradePromptCard({ currentTier, tokenBalance }: UpgradePromptCardProps) {
  // 只對免費用戶顯示
  if (currentTier !== 'free') {
    return null
  }

  const starterFeatures = [
    '25,000 tokens/月（多 25%）',
    '連接 1 個 WordPress 網站',
    '使用全部 AI 模型',
    '每篇文章無限圖片'
  ]

  const isLowBalance = tokenBalance < 5000

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">升級至 STARTER 方案</CardTitle>
            <CardDescription>
              {isLowBalance
                ? '您的 Token 即將用完，升級獲得更多配額！'
                : '解鎖更多功能，讓您的 SEO 更上一層樓'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 特色功能列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {starterFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm text-foreground">{feature}</span>
              </div>
            ))}
          </div>

          {/* 價格資訊 */}
          <div className="p-4 rounded-lg bg-card/50 border border-border">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">NT$ 699</span>
              <span className="text-sm text-muted-foreground">/月</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">年繳享 83 折優惠</p>
          </div>

          {/* CTA 按鈕 */}
          <div className="flex gap-3">
            <Button asChild className="flex-1 bg-primary hover:bg-primary/90" size="lg">
              <Link href="/dashboard/subscription#plans">
                立即升級
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/pricing">
                查看所有方案
              </Link>
            </Button>
          </div>

          {/* 額外提示 */}
          <p className="text-xs text-center text-muted-foreground">
            隨時可以取消，無需綁約
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
