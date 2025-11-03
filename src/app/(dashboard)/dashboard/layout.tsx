import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/auth'
import { User, Settings, Bell, Search } from 'lucide-react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Input } from '@/components/ui/input'
import { DashboardLayoutClient, MainContent } from '@/components/dashboard/dashboard-layout-client'
import { LogoutButton } from '@/components/dashboard/logout-button'

async function performLogout() {
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
    <DashboardLayoutClient>
      <div className="min-h-screen bg-background">
        <Sidebar />

        <MainContent>
          <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-full items-center justify-between px-6">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋功能、文章或設定..."
                    className="pl-9 h-9 bg-muted/50 border-border focus:bg-background transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 relative hover:bg-accent"
                >
                  <Bell className="h-5 w-5 text-foreground/70" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
                </Button>

                <ThemeToggle />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src="" alt="User avatar" />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">使用者帳號</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          user@example.com
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>設定</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <form action={performLogout} id="logout-form">
                      <LogoutButton />
                    </form>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </MainContent>
      </div>
    </DashboardLayoutClient>
  )
}
