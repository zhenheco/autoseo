"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Globe,
  PenSquare,
  FileText,
  CreditCard,
  MoreHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Handshake,
  Shield,
  Users,
  Mail,
  LogOut,
  Languages,
} from "lucide-react";
import { useState } from "react";

const SUPER_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// 主要導航項目（顯示在底部）
const mainNavItems = [
  {
    title: "網站",
    href: "/dashboard/websites",
    icon: Globe,
  },
  {
    title: "寫文章",
    href: "/dashboard/articles",
    icon: PenSquare,
  },
  {
    title: "管理",
    href: "/dashboard/articles/manage",
    icon: FileText,
  },
  {
    title: "訂閱",
    href: "/dashboard/subscription",
    icon: CreditCard,
  },
];

// 更多選單中的項目
const moreNavItems = [
  {
    title: "聯盟夥伴",
    href: "/dashboard/affiliate",
    icon: Handshake,
  },
];

const adminItems = [
  {
    title: "提領審核",
    href: "/dashboard/admin/withdrawals",
    icon: Shield,
  },
  {
    title: "聯盟管理",
    href: "/dashboard/admin/affiliates",
    icon: Users,
  },
  {
    title: "翻譯管理",
    href: "/dashboard/admin/translations",
    icon: Languages,
  },
];

interface MobileBottomNavProps {
  userEmail?: string;
  onLogout?: () => void;
}

export function MobileBottomNav({
  userEmail = "user@example.com",
  onLogout,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase());

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          );
        })}

        {/* 更多選單 */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                "text-muted-foreground hover:text-foreground",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">更多</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader>
              <SheetTitle className="text-left">更多選項</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}

              {isSuperAdmin && (
                <>
                  <div className="my-3 border-t" />
                  <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">
                    管理後台
                  </p>
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSheetOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </>
              )}

              <div className="my-3 border-t" />

              {/* 客服信箱 */}
              <a
                href="mailto:service@1wayseo.com"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Mail className="h-5 w-5" />
                <span>客服信箱</span>
              </a>

              {/* 登出 */}
              {onLogout && (
                <button
                  onClick={() => {
                    setSheetOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>登出</span>
                </button>
              )}

              {/* 用戶資訊 */}
              <div className="mt-4 px-4 py-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">登入帳號</p>
                <p className="text-sm font-medium truncate">{userEmail}</p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
