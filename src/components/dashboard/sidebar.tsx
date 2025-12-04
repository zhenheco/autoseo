"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Globe,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  PenSquare,
  FileText,
  Handshake,
  Shield,
  Users,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "./dashboard-layout-client";

const SUPER_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const navItems = [
  {
    title: "網站管理",
    href: "/dashboard/websites",
    icon: Globe,
  },
  {
    title: "寫新文章",
    href: "/dashboard/articles",
    icon: PenSquare,
  },
  {
    title: "文章管理",
    href: "/dashboard/articles/manage",
    icon: FileText,
  },
  {
    title: "訂閱方案",
    href: "/dashboard/subscription",
    icon: CreditCard,
  },
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
];

interface SidebarProps {
  userEmail?: string;
}

export function Sidebar({ userEmail = "user@example.com" }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase());

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 bg-sidebar border-r border-sidebar-foreground/10",
        collapsed ? "w-20" : "w-48",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-foreground/10">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="1waySEO"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-sidebar-foreground">
                1waySEO
              </span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-foreground/10"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative",
                  "hover:bg-sidebar-foreground/10",
                  isActive
                    ? "bg-sidebar-foreground/10 text-primary"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}

          {isSuperAdmin && (
            <>
              <div className="my-3 border-t border-sidebar-foreground/10" />
              {!collapsed && (
                <p className="px-3 py-1 text-xs font-semibold text-sidebar-foreground/50 uppercase">
                  管理後台
                </p>
              )}
              {adminItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative",
                      "hover:bg-sidebar-foreground/10",
                      isActive
                        ? "bg-sidebar-foreground/10 text-primary"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                    )}
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* 聯絡我們 */}
        <div className="px-4 py-2 border-t border-sidebar-foreground/10">
          <a
            href="mailto:service@1wayseo.com"
            className={cn(
              "flex items-center gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors",
              collapsed && "justify-center",
            )}
          >
            <Mail className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-xs">service@1wayseo.com</span>}
          </a>
        </div>

        <div className="p-4 border-t border-sidebar-foreground/10">
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed && "justify-center",
            )}
          >
            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                U
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {userEmail}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
