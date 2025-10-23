import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center">
        <h1 className="text-5xl font-bold text-center mb-4">
          Auto Pilot SEO
        </h1>
        <p className="text-center text-xl text-muted-foreground mb-12">
          AI 驅動的 SEO 寫文平台
        </p>

        <div className="flex justify-center gap-4 mb-16">
          <Button asChild size="lg">
            <Link href="/signup">開始使用</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">登入</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-4">✨ 核心功能</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                多租戶企業管理
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                WordPress 自動發布
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                AI 內容生成
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                團隊協作權限
              </li>
            </ul>
          </div>
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-4">🚀 技術棧</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Next.js 14 + TypeScript
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Supabase (Auth + DB)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Tailwind CSS + shadcn/ui
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                N8N Workflow
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
