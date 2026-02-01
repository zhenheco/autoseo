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
  Mail,
  LogOut,
  Languages,
  ExternalLink,
  Users,
  Ticket,
  History,
} from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

const SUPER_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
  const t = useTranslations("nav");

  // 主要導航項目（顯示在底部）
  const mainNavItems = [
    {
      title: t("websites"),
      href: "/dashboard/websites",
      icon: Globe,
    },
    {
      title: t("writeArticle"),
      href: "/dashboard/articles",
      icon: PenSquare,
    },
    {
      title: t("manage"),
      href: "/dashboard/articles/manage",
      icon: FileText,
    },
    {
      title: t("subscription"),
      href: "/dashboard/subscription",
      icon: CreditCard,
    },
  ];

  // 更多選單中的項目
  const moreNavItems = [
    {
      title: t("affiliate"),
      href: "https://affiliate.1wayseo.com",
      icon: Handshake,
      external: true,
    },
  ];

  const adminItems = [
    {
      title: t("subscriptionManagement"),
      href: "/dashboard/admin/subscriptions",
      icon: Users,
    },
    {
      title: t("promoCodeManagement"),
      href: "/dashboard/admin/promo-codes",
      icon: Ticket,
    },
    {
      title: t("operationLogs"),
      href: "/dashboard/admin/logs",
      icon: History,
    },
    {
      title: t("translations"),
      href: "/dashboard/admin/translations",
      icon: Languages,
    },
  ];

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
              <span className="text-[10px] font-medium">{t("more")}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader>
              <SheetTitle className="text-left">{t("moreOptions")}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = !item.external && pathname === item.href;

                // 外部連結使用 <a> 標籤
                if (item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSheetOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.title}</span>
                      <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                    </a>
                  );
                }

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
                    {t("adminPanel")}
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
                <span>{t("customerService")}</span>
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
                  <span>{t("logout")}</span>
                </button>
              )}

              {/* 用戶資訊 */}
              <div className="mt-4 px-4 py-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">{t("loggedInAccount")}</p>
                <p className="text-sm font-medium truncate">{userEmail}</p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
