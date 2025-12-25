import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth";
import { User, Settings } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import {
  DashboardLayoutClient,
  MainContent,
} from "@/components/dashboard/dashboard-layout-client";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { ArticleQuotaDisplay } from "@/components/billing/ArticleQuotaDisplay";
import { NewArticleButton } from "@/components/articles/NewArticleButton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { UILanguageSelector } from "@/components/common/UILanguageSelector";

async function performLogout() {
  "use server";
  await signOut();
  redirect("/login");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardLayoutClient>
      <div className="min-h-screen bg-background">
        {/* 桌面版側邊欄（手機隱藏） */}
        <Sidebar userEmail={user.email} />

        {/* 手機版底部導航 */}
        <MobileBottomNav userEmail={user.email} />

        <MainContent>
          <div className="min-h-screen flex flex-col">
            <header className="sticky top-0 flex-shrink-0 z-30 h-14 md:h-16 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-full items-center justify-between px-4 md:px-6">
                {/* 手機版顯示 Logo */}
                <div className="flex items-center gap-2 md:hidden">
                  <Image
                    src="/1waySEO_icon.svg"
                    alt="1waySEO"
                    width={28}
                    height={28}
                    className="rounded-md"
                  />
                  <span className="text-lg font-bold">1waySEO</span>
                </div>
                <div className="hidden md:flex items-center gap-4 flex-1"></div>

                <div className="flex items-center gap-2 md:gap-3">
                  {/* 新文章按鈕 - 手機版隱藏（已在底部導航） */}
                  <div className="hidden md:block">
                    <NewArticleButton />
                  </div>

                  <ArticleQuotaDisplay compact />

                  <UILanguageSelector />

                  <ThemeToggle />

                  <div className="hidden md:block h-6 w-px bg-border" />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src="" alt="User avatar" />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-56"
                      align="end"
                      forceMount
                    >
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link
                          href="/dashboard/settings"
                          className="cursor-pointer"
                        >
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

            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </div>
        </MainContent>
      </div>
    </DashboardLayoutClient>
  );
}
