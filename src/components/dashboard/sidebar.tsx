"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "./dashboard-layout-client";

const navItems = [
  {
    title: "文章管理",
    href: "/dashboard/articles",
    icon: FileText,
  },
  {
    title: "網站管理",
    href: "/dashboard/websites",
    icon: Globe,
  },
  {
    title: "訂閱方案",
    href: "/dashboard/subscription",
    icon: CreditCard,
  },
  {
    title: "設定",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

interface SidebarProps {
  userEmail?: string;
}

export function Sidebar({ userEmail = "user@example.com" }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 bg-sidebar border-r border-sidebar-foreground/10",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-foreground/10">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-sidebar-foreground">
                Auto Pilot
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
        </nav>

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
