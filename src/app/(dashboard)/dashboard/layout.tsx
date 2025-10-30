import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { signOut } from '@/lib/auth'

async function logout() {
  'use server'
  await signOut()
  redirect('/login')
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 暫時停用認證檢查，允許未登入使用者訪問 dashboard
  // TODO: 未來需要重新啟用認證系統
  // const user = await getUser()

  // if (!user) {
  //   redirect('/login')
  // }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold hover:opacity-80 transition-opacity">
            Auto Pilot SEO
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/websites"
              className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all"
            >
              網站管理
            </Link>
            <Link
              href="/dashboard/articles"
              className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all"
            >
              文章管理
            </Link>
            <Link
              href="/dashboard/settings"
              className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all"
            >
              設定
            </Link>

            <div className="ml-2 flex items-center gap-2">
              <ThemeToggle />
              <form action={logout}>
                <Button variant="outline" size="sm" type="submit">
                  登出
                </Button>
              </form>
            </div>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
