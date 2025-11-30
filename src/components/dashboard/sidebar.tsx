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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "./dashboard-layout-client";

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

interface SidebarProps {
  userEmail?: string;
}

export function Sidebar({ userEmail = "user@example.com" }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 bg-slate-900 border-r border-white/10",
        collapsed ? "w-20" : "w-48",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="1WaySEO"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-bold bg-gradient-to-r from-cyber-cyan-400 to-cyber-violet-400 bg-clip-text text-transparent">
                1WaySEO
              </span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5"
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
                  "hover:bg-white/5",
                  isActive
                    ? "bg-cyber-violet-500/10 text-cyber-violet-400"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyber-cyan-500 to-cyber-violet-500 rounded-r" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed && "justify-center",
            )}
          >
            <Avatar className="h-9 w-9 ring-2 ring-cyber-violet-500/30">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-gradient-to-br from-cyber-violet-500 to-cyber-magenta-500 text-white text-sm">
                U
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-300 truncate">
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
