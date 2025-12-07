"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function DashboardLayoutClient({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function MainContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "transition-all duration-300",
        // 手機版：無左側 padding，有底部 padding（給底部導航空間）
        "pb-16 md:pb-0",
        // 平板以上：根據 sidebar 狀態調整左側 padding
        collapsed ? "md:pl-20" : "md:pl-48",
      )}
    >
      {children}
    </div>
  );
}
