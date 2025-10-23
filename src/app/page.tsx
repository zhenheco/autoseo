export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Auto Pilot SEO
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          AI 驅動的 SEO 寫文平台 - 正在建置中...
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">✨ 核心功能</h2>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>多租戶企業管理</li>
              <li>WordPress 自動發布</li>
              <li>AI 內容生成</li>
              <li>團隊協作權限</li>
            </ul>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">🚀 技術棧</h2>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Next.js 14 + TypeScript</li>
              <li>Supabase (Auth + DB)</li>
              <li>Tailwind CSS + shadcn/ui</li>
              <li>N8N Workflow</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
