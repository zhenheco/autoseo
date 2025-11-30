import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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
import { User, Settings, Gift } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import {
  DashboardLayoutClient,
  MainContent,
} from "@/components/dashboard/dashboard-layout-client";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { TokenBalanceDisplay } from "@/components/billing/TokenBalanceDisplay";
import { NewArticleButton } from "@/components/articles/NewArticleButton";

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
      <div className="h-screen overflow-hidden bg-background">
        <Sidebar userEmail={user.email} />

        <MainContent>
          <div className="h-screen flex flex-col overflow-hidden">
            <header className="flex-shrink-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-full items-center justify-between px-6">
                <div className="flex items-center gap-4 flex-1"></div>

                <div className="flex items-center gap-3">
                  <NewArticleButton />

                  <Link href="/dashboard/referrals">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Gift className="h-4 w-4" />
                      <span className="hidden sm:inline">好友推薦</span>
                    </Button>
                  </Link>

                  <TokenBalanceDisplay compact />

                  <div className="h-6 w-px bg-border" />

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

            <main className="flex-1 overflow-auto p-6">{children}</main>
          </div>
        </MainContent>
      </div>
    </DashboardLayoutClient>
  );
}
