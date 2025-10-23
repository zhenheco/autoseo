import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="text-xl font-bold">
            Auto Pilot SEO
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/websites"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              網站管理
            </Link>
            <Link
              href="/dashboard/articles"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              文章管理
            </Link>
            <Link
              href="/dashboard/settings"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              設定
            </Link>

            <form action={logout}>
              <Button variant="outline" size="sm" type="submit">
                登出
              </Button>
            </form>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
